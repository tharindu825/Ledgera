# 🚀 Ledgera AI Grocery Billing & Budget Planner

An intelligent grocery expense tracker and budget planner featuring AI-powered bill scanning (OCR), smart categorization, and predictive financial insights.

## ✨ Features

-   **📸 AI Receipt Scanning**: Upload images of grocery bills to automatically extract items, prices, and stores.
-   **🤖 Smart Categorization**: Automatic classification of items into categories like Food, Meat, Dairy, Household, etc.
-   **📈 Predictive Analytics**: linear regression-based expense forecasting for next month.
-   **👨‍👩‍👧‍👦 Family Budgeting**: Set budget goals based on family size and monthly income.
-   **💸 Debt & Repayment Tracking**: Manage loans and repayments with automated balance syncing.
-   **📊 Dashboard & Insights**: Real-time spending alerts, health scores, and category breakdowns.

## 🛠️ Technology Stack

-   **Frontend**: React (Vite), Chart.js, Lucide Icons, Axios.
-   **Backend**: Node.js, Express.
-   **Database**: MongoDB Atlas.
-   **AI Engine**: OpenRouter (Gemini/Llama) for OCR and smart insights.

## 🚀 Quick Start

### 1. Prerequisites
-   Node.js (v18+)
-   MongoDB Atlas account
-   OpenRouter API Key

### 2. Setup Environment
Create a `.env` file in the root directory:
```env
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PORT=5000
NODE_ENV=development
OPENROUTER_API_KEY=your_key
```

### 3. Installation
```bash
# Install all dependencies
npm run install-all
```

### 4. Running Development
```bash
# Start both client and server
npm run dev
```

## 🚢 Deployment

The system is configured for single-server production deployment.

1.  **Build the Frontend**:
    ```bash
    npm run build
    ```
2.  **Set Environment Variables**:
    Ensure `NODE_ENV=production` is set on your host.
3.  **Start the Server**:
    ```bash
    npm start
    ```

---
Built with ❤️ for AI Grocery Management.
