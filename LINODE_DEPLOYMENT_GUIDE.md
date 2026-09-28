# 🚀 Ledgera — Linode Ubuntu Deployment Guide
## Self-Hosted MongoDB (No Atlas Required)

> **Target Stack**: Linode Ubuntu 22.04 LTS · Node.js 20 · MongoDB 7 · Nginx · PM2

---

## 📋 Table of Contents

1. [What Needs to Change](#1-what-needs-to-change-in-ledgera)
2. [Linode Server Setup](#2-linode-server-initial-setup)
3. [Install MongoDB Self-Hosted](#3-install-mongodb-self-hosted)
4. [Secure MongoDB with Auth](#4-secure-mongodb-with-authentication)
5. [Install Node.js](#5-install-nodejs)
6. [Deploy Ledgera App](#6-deploy-ledgera-app)
7. [Build the React Frontend](#7-build-the-react-frontend)
8. [Setup PM2 Process Manager](#8-setup-pm2-process-manager)
9. [Setup Nginx Reverse Proxy](#9-setup-nginx-reverse-proxy)
10. [Configure Firewall](#10-configure-firewall-ufw)
11. [Environment Variables](#11-environment-variables-on-linode)
12. [MongoDB Backup Strategy](#12-mongodb-backup-strategy)
13. [Migrate Data from Atlas](#13-migrate-existing-data-from-atlas)
14. [SSL with Let's Encrypt](#14-ssl-with-lets-encrypt-optional-but-recommended)
15. [Maintenance Cheatsheet](#15-maintenance-cheatsheet)

---

## 1. What Needs to Change in Ledgera

These are the **exact changes** you need to make to the Ledgera codebase and config when switching from MongoDB Atlas to self-hosted.

### 1.1 — `.env` File Changes

**Current (Atlas):**
```env
MONGODB_URI=mongodb+srv://user:pass@cluster0.l0r9b.mongodb.net/Ledgera?appName=Cluster0
NODE_ENV=development
APP_URL=http://localhost:3000
PORT=5000
```

**New (Self-Hosted on Linode):**
```env
MONGODB_URI=mongodb://ledgera_user:YourStrongPassword@localhost:27017/Ledgera
NODE_ENV=production
APP_URL=https://yourdomain.com
PORT=5000
JWT_SECRET=generate_a_long_random_secret_here
OPENROUTER_API_KEY=sk-or-v1-your-key-here
WALLET_API_KEY=your-wallet-api-key-here
```

> Key differences:
> - mongodb+srv:// becomes mongodb:// (no SRV, no Atlas)
> - localhost:27017 — MongoDB runs on the same server
> - NODE_ENV=production — enables serving static React build
> - APP_URL — your real domain or Linode IP

---

### 1.2 — `server/server.js` Changes

The console log still says "MongoDB Atlas". Change **line 72** to be more generic:

```diff
- console.log('✅ Connected to MongoDB Atlas - Ledgera Database');
+ console.log('✅ Connected to MongoDB - Ledgera Database');
```

This is cosmetic only — the actual Mongoose connection code requires **no changes** since it already reads from `process.env.MONGODB_URI`.

---

### 1.3 — `client/vite.config.js` Changes

The Vite config is only used in **development mode**. In production on Linode, Vite is NOT running — the server already serves the built `client/dist` folder as static files (already handled in `server.js` lines 55–64). So **no changes needed** to `vite.config.js` for production.

---

### 1.4 — CORS Configuration in `server/server.js`

Currently the server has an open CORS policy (`app.use(cors())`). In production, restrict it to your domain. Change line 25:

```diff
- app.use(cors());
+ app.use(cors({
+   origin: process.env.APP_URL || 'http://localhost:3000',
+   credentials: true
+ }));
```

---

### 1.5 — Upload Files Path

The server serves uploads from `server/uploads/`. On Linode, make sure this directory exists:

```bash
mkdir -p /var/www/ledgera/server/uploads
chmod 755 /var/www/ledgera/server/uploads
```

---

## 2. Linode Server Initial Setup

### 2.1 Create the Linode

1. Go to https://cloud.linode.com
2. Click **Create** → **Linode**
3. Choose:
   - **Image**: Ubuntu 22.04 LTS
   - **Region**: Pick closest to you (e.g., Singapore for Sri Lanka)
   - **Plan**: Shared CPU → **Nanode 1GB** ($5/mo) or **Linode 2GB** ($12/mo) recommended
   - **Root Password**: Set a strong root password
4. Click **Create Linode** and wait ~1 min

### 2.2 Connect via SSH

```bash
ssh root@YOUR_LINODE_IP
```

### 2.3 Create a Non-Root User

```bash
adduser ledgera
usermod -aG sudo ledgera
su - ledgera
```

### 2.4 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 3. Install MongoDB Self-Hosted

```bash
# Step 1: Import MongoDB GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Step 2: Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Step 3: Reload package list
sudo apt update

# Step 4: Install MongoDB
sudo apt install -y mongodb-org

# Step 5: Start MongoDB
sudo systemctl start mongod

# Step 6: Enable MongoDB to start on boot
sudo systemctl enable mongod

# Step 7: Verify it's running
sudo systemctl status mongod
```

You should see `Active: active (running)` in green.

---

## 4. Secure MongoDB with Authentication

By default, MongoDB has **no authentication**. You MUST add a password before deploying.

### 4.1 Connect to MongoDB Shell

```bash
mongosh
```

### 4.2 Create Admin User

```javascript
use admin

db.createUser({
  user: "admin",
  pwd: "YourAdminPassword123!",
  roles: [{ role: "userAdminAnyDatabase", db: "admin" }]
})
```

### 4.3 Create Ledgera App User

```javascript
use Ledgera

db.createUser({
  user: "ledgera_user",
  pwd: "YourStrongPassword456!",
  roles: [{ role: "readWrite", db: "Ledgera" }]
})

exit
```

### 4.4 Enable Auth in MongoDB Config

```bash
sudo nano /etc/mongod.conf
```

Find the `security` section and add:

```yaml
security:
  authorization: enabled
```

Also confirm `net` section is binding to localhost only:

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1
```

### 4.5 Restart MongoDB

```bash
sudo systemctl restart mongod
```

### 4.6 Test the Connection

```bash
mongosh --authenticationDatabase Ledgera -u ledgera_user -p "YourStrongPassword456!" Ledgera
```

If you see `Ledgera>` prompt, it's working correctly.

---

## 5. Install Node.js

```bash
# Install Node.js 20 (LTS) via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version   # Should output v20.x.x
npm --version    # Should output 10.x.x
```

---

## 6. Deploy Ledgera App

### 6.1 Upload Your Code

**Option A — Git (Recommended)**

```bash
sudo mkdir -p /var/www/ledgera
sudo chown ledgera:ledgera /var/www/ledgera
cd /var/www/ledgera
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .
```

**Option B — SCP from your Windows machine**

Run this on your **local Windows machine**:

```powershell
scp -r "F:\Onedrive\Tharindu\Researches\Ledgera\*" ledgera@YOUR_LINODE_IP:/var/www/ledgera/
```

> Exclude `node_modules` and `.env` — never copy these. Add them on the server manually.

### 6.2 Install Dependencies

```bash
cd /var/www/ledgera
npm install --production
npm --prefix client install
```

---

## 7. Build the React Frontend

In production, the Express server serves pre-built static files from `client/dist/`. The `server.js` already handles this at lines 55–64 when `NODE_ENV=production`.

```bash
cd /var/www/ledgera
npm run build
```

This runs `vite build` inside `client/` and outputs to `client/dist/`.

---

## 8. Setup PM2 Process Manager

PM2 keeps your app running 24/7 and auto-restarts on crashes.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start Ledgera
cd /var/www/ledgera
pm2 start server/server.js --name ledgera

# Save config and enable on boot
pm2 save
pm2 startup systemd
```

PM2 outputs a command — **copy and run it exactly**, e.g.:
```
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ledgera --hp /home/ledgera
```

### Useful PM2 Commands

```bash
pm2 status          # Check if running
pm2 logs ledgera    # View live logs
pm2 restart ledgera # Restart the app
pm2 stop ledgera    # Stop the app
```

---

## 9. Setup Nginx Reverse Proxy

Nginx handles incoming HTTP traffic and forwards it to Node.js on port 5000.

### 9.1 Install Nginx

```bash
sudo apt install -y nginx
```

### 9.2 Create Nginx Config for Ledgera

```bash
sudo nano /etc/nginx/sites-available/ledgera
```

Paste this (replace `yourdomain.com` with your domain or Linode IP):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Increase upload size limit (for bill images)
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Longer timeout for AI/OCR routes
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Serve uploaded files directly via Nginx (more efficient)
    location /uploads/ {
        alias /var/www/ledgera/server/uploads/;
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

### 9.3 Enable the Site

```bash
sudo ln -s /etc/nginx/sites-available/ledgera /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 10. Configure Firewall (UFW)

```bash
sudo ufw enable

# Allow SSH (do this FIRST or you'll be locked out)
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Block direct access to Node and MongoDB ports
sudo ufw deny 5000
sudo ufw deny 27017

# Check status
sudo ufw status
```

---

## 11. Environment Variables on Linode

Create your `.env` file on the server:

```bash
nano /var/www/ledgera/.env
```

Paste (fill in your real values):

```env
# ─── DATABASE CONFIGURATION ──────────────────────────────────────────────────
MONGODB_URI=mongodb://ledgera_user:YourStrongPassword456!@localhost:27017/Ledgera

# ─── AUTHENTICATION ─────────────────────────────────────────────────────────
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=paste_your_64_byte_hex_here

# ─── SERVER SETTINGS ────────────────────────────────────────────────────────
PORT=5000
NODE_ENV=production

# ─── APP URL ────────────────────────────────────────────────────────────────
APP_URL=https://yourdomain.com

# ─── AI OCR CONFIGURATION (OPENROUTER) ──────────────────────────────────────
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# ─── BUDGETBAKERS WALLET API ────────────────────────────────────────────────
WALLET_API_KEY=your-wallet-api-key-here
```

**Generate a secure JWT secret:**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Secure the .env file:**

```bash
chmod 600 /var/www/ledgera/.env
```

---

## 12. MongoDB Backup Strategy

Since you're self-hosting, **you are responsible for backups**. Atlas did this automatically.

### 12.1 Manual Backup

```bash
mkdir -p /home/ledgera/backups

mongodump \
  --authenticationDatabase Ledgera \
  -u ledgera_user \
  -p "YourStrongPassword456!" \
  --db Ledgera \
  --out /home/ledgera/backups/$(date +%Y-%m-%d)
```

### 12.2 Automated Daily Backup with Cron

```bash
nano /home/ledgera/backup.sh
```

Paste:

```bash
#!/bin/bash
BACKUP_DIR="/home/ledgera/backups"
DATE=$(date +%Y-%m-%d_%H-%M)
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

mongodump \
  --authenticationDatabase Ledgera \
  -u ledgera_user \
  -p "YourStrongPassword456!" \
  --db Ledgera \
  --out "$BACKUP_DIR/$DATE"

# Delete backups older than 7 days
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +$KEEP_DAYS -exec rm -rf {} +

echo "Backup completed: $DATE"
```

```bash
chmod +x /home/ledgera/backup.sh
crontab -e
```

Add this line:

```
0 2 * * * /home/ledgera/backup.sh >> /home/ledgera/backup.log 2>&1
```

### 12.3 Restore from Backup

```bash
mongorestore \
  --authenticationDatabase Ledgera \
  -u ledgera_user \
  -p "YourStrongPassword456!" \
  --db Ledgera \
  /home/ledgera/backups/2026-09-26_02-00/Ledgera
```

---

## 13. Migrate Existing Data from Atlas

### 13.1 Export from Atlas (on your local machine)

```bash
mongodump \
  --uri="mongodb+srv://tharindudilshan0825:YOUR_PASS@cluster0.l0r9b.mongodb.net/Ledgera" \
  --out ./atlas_backup
```

### 13.2 Upload Backup to Linode (from Windows)

```powershell
scp -r ".\atlas_backup" ledgera@YOUR_LINODE_IP:/home/ledgera/
```

### 13.3 Import into Self-Hosted MongoDB

```bash
mongorestore \
  --authenticationDatabase Ledgera \
  -u ledgera_user \
  -p "YourStrongPassword456!" \
  --db Ledgera \
  /home/ledgera/atlas_backup/Ledgera
```

---

## 14. SSL with Let's Encrypt (Optional but Recommended)

Only if you have a domain name pointed to your Linode IP:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Verify auto-renewal works
sudo certbot renew --dry-run
```

Certbot automatically updates your Nginx config to serve HTTPS on port 443.

---

## 15. Maintenance Cheatsheet

### Update the App

```bash
cd /var/www/ledgera
git pull
npm install --production
npm --prefix client install
npm run build
pm2 restart ledgera
```

### View Logs

```bash
pm2 logs ledgera                              # App logs
sudo tail -f /var/log/nginx/error.log         # Nginx errors
sudo tail -f /var/log/mongodb/mongod.log      # MongoDB logs
```

### MongoDB Shell Access

```bash
mongosh --authenticationDatabase Ledgera -u ledgera_user -p "YourStrongPassword456!" Ledgera
```

### Restart Everything

```bash
sudo systemctl restart mongod
pm2 restart ledgera
sudo systemctl restart nginx
```

---

## Summary: All Things That Change

| Component | Before (Atlas) | After (Linode Self-Hosted) |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://...atlas.net` | `mongodb://user:pass@localhost:27017/Ledgera` |
| `NODE_ENV` | `development` | `production` |
| `APP_URL` | `http://localhost:3000` | `https://yourdomain.com` |
| DB Hosting | Atlas cloud (managed) | MongoDB on same Linode VPS |
| DB Backups | Atlas auto-backup | Manual cron + `mongodump` |
| Frontend Serving | Vite dev server (port 3000) | Express serves `client/dist` |
| Process Manager | Manual `npm start` | PM2 (auto-restart, always on) |
| Reverse Proxy | None | Nginx (port 80/443 → 5000) |
| SSL | None | Let's Encrypt (free) |
| Code in `server.js` line 72 | Log says "MongoDB Atlas" | Change log text (cosmetic) |
| CORS in `server.js` line 25 | Open `cors()` | Restrict to `APP_URL` |

---

> **Tip**: For Ledgera, a **Linode 2GB ($12/mo)** instance runs MongoDB + Node.js + Nginx comfortably.

> **Security**: Never expose port 27017 to the internet. MongoDB must always bind to `127.0.0.1` only.
