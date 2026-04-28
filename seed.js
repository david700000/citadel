// Run this once on first deploy to create the superadmin user:
// node seed.js
require('dotenv').config();
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'admin' },
    recoveryKey: String
});
const User = mongoose.model('User', UserSchema);

async function seed() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ email: process.env.SUPERADMIN_EMAIL });
    if (existing) {
        console.log('Superadmin already exists:', existing.email);
    } else {
        await User.create({
            email: process.env.SUPERADMIN_EMAIL,
            password: process.env.SUPERADMIN_PASSWORD,
            role: 'superadmin'
        });
        console.log('Superadmin created:', process.env.SUPERADMIN_EMAIL);
    }

    await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
