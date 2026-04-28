require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'citadel_secret_key_123';

// ─── MONGODB CONNECTION ───
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// ─── MODELS ───
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'admin' },
    recoveryKey: String
});
const User = mongoose.model('User', UserSchema);

const SiteDataSchema = new mongoose.Schema({
    hero: Array,
    events: Array,
    sermons: Array,
    gallery: Array,
    global: Object
}, { minimize: false });
const SiteData = mongoose.model('SiteData', SiteDataSchema);

// ─── CORS ───
function isAllowedOrigin(origin) {
    if (!origin || origin === 'null') return true;
    // Allow localhost for development
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
    // Allow any netlify.app subdomain
    if (/^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin)) return true;
    // Allow any onrender.com subdomain (for testing)
    if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin)) return true;
    // Allow custom FRONTEND_URL if set
    if (process.env.FRONTEND_URL) {
        const allowed = process.env.FRONTEND_URL.replace(/\/$/, ''); // strip trailing slash
        if (origin === allowed) return true;
    }
    return false;
}

app.use(cors({
    origin: function (origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        console.log('CORS blocked origin:', origin);
        callback(new Error('CORS: origin not allowed - ' + origin));
    },
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));

// ─── AUTH MIDDLEWARE ───
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// ─── HEALTH CHECK ───
app.get('/', (req, res) => res.json({ status: 'ok', message: 'Citadel API is running' }));

// ─── AUTH ───
// ─── TOKEN BLACKLIST (in-memory - forces immediate logout on revoke) ───
const revokedTokens = new Set();

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const user = await User.findOne({ email: email.toLowerCase() });
        if (user && user.password === password) {
            const token = jwt.sign(
                { id: user._id, email: user.email, role: user.role },
                SECRET_KEY,
                { expiresIn: '24h' }
            );
            res.json({ token, role: user.role, userId: user._id.toString() });
        } else {
            res.status(401).json({ error: 'Invalid email or password' });
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── TOKEN VERIFY (heartbeat endpoint - returns 401 if revoked) ───
app.get('/api/auth/verify', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    if (revokedTokens.has(token)) return res.status(401).json({ error: 'Token revoked' });
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        // Check if this user's ID was revoked (delete user -> immediate logout)
        if (revokedTokens.has('user:' + user.id)) {
            return res.status(401).json({ error: 'Account revoked' });
        }
        res.json({ valid: true, role: user.role });
    });
});

// ─── SITE DATA ───
app.get('/api/data', async (req, res) => {
    try {
        const data = await SiteData.findOne() || { hero: [], events: [], sermons: [], gallery: [], global: {} };
        res.json(data);
    } catch (err) {
        console.error('Data fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

app.post('/api/data', authenticateToken, async (req, res) => {
    try {
        let data = await SiteData.findOne();
        if (!data) data = new SiteData(req.body);
        else Object.assign(data, req.body);
        await data.save();
        res.json({ success: true });
    } catch (err) {
        console.error('Data save error:', err);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// ─── UPLOADS (Cloudinary) ───
if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });
}
const storage = new CloudinaryStorage({
    cloudinary,
    params: { folder: 'citadel', resource_type: 'auto' }
});
const upload = multer({ storage });

app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: req.file.path });
});

// ─── USER MANAGEMENT ───
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const users = await User.find({}, { password: 0, recoveryKey: 0 });
        res.json(users.map(u => ({ id: u._id, email: u.email, role: u.role })));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.post('/api/users', authenticateToken, async (req, res) => {
    try {
        const { email, password, role } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) return res.status(409).json({ error: 'User already exists' });
        const user = await User.create({ email: email.toLowerCase(), password, role: role || 'admin' });
        res.json({ success: true, id: user._id, email: user.email, role: user.role });
    } catch (err) {
        console.error('Create user error:', err);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        if (req.params.id === req.user.id) {
            return res.status(400).json({ error: 'Cannot revoke your own access' });
        }
        // Store revoked user ID so their heartbeat returns 401 immediately
        // The verify endpoint checks revokedTokens; we store the userId as well
        revokedTokens.add('user:' + req.params.id);
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Failed to revoke user' });
    }
});

// ─── CONTACT FORM ───
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and message are required' });
    }
    const mailOptions = {
        from: '"' + (process.env.EMAIL_FROM_NAME || 'Citadel of Truth') + '" <' + process.env.EMAIL_FROM + '>',
        to: process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_FROM,
        replyTo: email,
        subject: 'Citadel Contact: ' + (subject || 'New Message'),
        text: 'Name: ' + name + '\nEmail: ' + email + '\nSubject: ' + (subject || 'N/A') + '\n\n' + message
    };
    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: "Message sent! We'll be in touch." });
    } catch (err) {
        console.error('SMTP Error:', err);
        res.status(500).json({ error: 'Failed to send email. Please try again later.' });
    }
});

app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Return success even if not found to prevent email enumeration
            return res.json({ success: true, message: 'If the email exists, a recovery code has been sent.' });
        }
        
        // Generate a 6-digit recovery code
        const recoveryCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.recoveryKey = recoveryCode;
        await user.save();
        
        const mailOptions = {
            from: '"' + (process.env.EMAIL_FROM_NAME || 'Citadel of Truth') + '" <' + process.env.EMAIL_FROM + '>',
            to: user.email,
            subject: 'Citadel Command Centre - Recovery Code',
            text: 'You requested a password reset.\n\nYour 6-digit recovery code is: ' + recoveryCode + '\n\nPlease enter this code on the Command Centre to set your new password.'
        };
        
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Recovery code sent to your email.' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Failed to process password reset. Please try again later.' });
    }
});

app.post('/api/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || user.recoveryKey !== code) {
            return res.status(400).json({ error: 'Invalid or expired recovery code' });
        }
        
        res.json({ success: true, message: 'Code verified successfully.' });
    } catch (err) {
        console.error('Verify code error:', err);
        res.status(500).json({ error: 'Failed to verify code.' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        if (!email || !code || !newPassword) {
            return res.status(400).json({ error: 'Email, code, and new password are required' });
        }
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || user.recoveryKey !== code) {
            return res.status(400).json({ error: 'Invalid or expired recovery code' });
        }
        
        user.password = newPassword;
        user.recoveryKey = undefined; // Clear the key
        await user.save();
        
        res.json({ success: true, message: 'Password has been reset successfully.' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Failed to reset password.' });
    }
});

// ─── START ───
app.listen(PORT, () => console.log('Server running on port ' + PORT));
