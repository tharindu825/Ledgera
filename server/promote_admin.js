// One-time script to promote a specific user to admin
// Run: node server/promote_admin.js
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

async function promoteAdmin() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const User = require('./models/User');

    // Promote cvsushi14@gmail.com to admin
    const targetEmail = 'cvsushi14@gmail.com';
    const user = await User.findOne({ email: targetEmail });

    if (!user) {
        console.log(`❌ User with email "${targetEmail}" not found`);
        process.exit(1);
    }

    user.role = 'admin';
    user.accessGranted = true;
    user.accessExpiresAt = null;
    await user.save();

    console.log(`✅ Promoted "${user.name}" (${user.email}) to ADMIN with permanent access`);

    // Also grant access to all other existing users
    const result = await User.updateMany(
        { _id: { $ne: user._id }, accessGranted: { $ne: true } },
        { $set: { accessGranted: true, accessExpiresAt: null } }
    );
    console.log(`✅ Granted access to ${result.modifiedCount} other existing users`);

    await mongoose.disconnect();
    process.exit(0);
}

promoteAdmin().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
