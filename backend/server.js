require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
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
    .then(() => console.log('🚀 Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

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

// ─── MIDDLEWARE ───
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// ─── ROUTES ───
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'admin.html')));

// API: Auth
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (user && user.password === password) { // Simple check for now, should use hash
        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, role: user.role });
    } else {
        res.status(401).json({ error: "Invalid email or password" });
    }
});

// API: Data
app.get('/api/data', async (req, res) => {
    const data = await SiteData.findOne() || { hero: [], events: [], sermons: [], gallery: [], global: {} };
    res.json(data);
});

app.post('/api/data', authenticateToken, async (req, res) => {
    let data = await SiteData.findOne();
    if (!data) data = new SiteData(req.body);
    else Object.assign(data, req.body);
    await data.save();
    res.json({ success: true });
});

// API: Uploads
const storage = process.env.CLOUDINARY_URL ? 
    new CloudinaryStorage({ cloudinary, params: { folder: 'citadel', resource_type: 'auto' } }) :
    multer.diskStorage({
        destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
        filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
    });
const upload = multer({ storage });

app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const imageUrl = process.env.CLOUDINARY_URL ? req.file.path : '/uploads/' + req.file.filename;
    res.json({ url: imageUrl });
});

// ─── SMTP / EMAIL ───
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: process.env.EMAIL_FROM,
        subject: `Citadel Contact: ${subject}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`
    };
    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: "Message sent! We'll be in touch." });
    } catch (err) {
        console.error("❌ SMTP Error:", err);
        res.status(500).json({ error: "Failed to send email. Check server logs." });
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
