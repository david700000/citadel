require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;
const crypto = require('crypto');
const USERS_FILE = path.join(__dirname, 'users.json');

const SECRET_KEY = 'citadel_secret_key_123';

const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
};

const verifyPassword = (password, storedHash) => {
    const [salt, key] = storedHash.split(':');
    const hashBuffer = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');
    return crypto.timingSafeEqual(hashBuffer, keyBuffer);
};

const readUsers = () => {
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } 
    catch(err) { return []; }
};

const writeUsers = (users) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
};

const initUsers = () => {
    if(!fs.existsSync(USERS_FILE)) {
        writeUsers([{
            id: 'u1',
            email: 'david07israel@gmail.com',
            password: hashPassword('admin'),
            role: 'superadmin'
        }]);
    }
};
initUsers();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '')));

// Handle local uploads fallback
const localUploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(localUploadsDir)) {
    fs.mkdirSync(localUploadsDir);
}
app.use('/uploads', express.static(localUploadsDir));

// Route root path to the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'citadel-of-truth.html'));
});

// Configure Uploads
let upload;
if (process.env.CLOUDINARY_URL) {
    const storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: { folder: 'citadel', resource_type: 'auto' }
    });
    upload = multer({ storage: storage });
    console.log("Cloudinary mode enabled.");
} else {
    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, localUploadsDir),
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + path.extname(file.originalname));
        }
    });
    upload = multer({ storage: storage });
    console.log("Local upload mode enabled.");
}

const DATA_FILE = path.join(__dirname, 'data.json');

const readData = () => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return { events: [], sermons: [], hero: [], global: {} };
    }
};

const writeData = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error("Error writing data.json:", err);
    }
};

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const users = readUsers();
    const user = users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
    
    if (user && verifyPassword(password, user.password)) {
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, role: user.role });
    } else {
        res.status(401).json({ error: "Invalid email or password" });
    }
});

app.get('/api/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: "Forbidden" });
    const users = readUsers().map(u => ({ id: u.id, email: u.email, role: u.role }));
    res.json(users);
});

app.post('/api/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: "Forbidden" });
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const users = readUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        return res.status(400).json({ error: "User already exists" });
    }
    users.push({
        id: 'u' + Date.now(),
        email: email,
        password: hashPassword(password),
        role: role || 'admin'
    });
    writeUsers(users);
    res.json({ success: true });
});

app.delete('/api/users/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: "Forbidden" });
    if (req.user.id === req.params.id) return res.status(400).json({ error: "Cannot delete yourself" });
    let users = readUsers();
    users = users.filter(u => u.id !== req.params.id);
    writeUsers(users);
    res.json({ success: true });
});

app.get('/api/data', (req, res) => {
    res.json(readData());
});

app.post('/api/data', authenticateToken, (req, res) => {
    const newData = req.body;
    writeData(newData);
    res.json({ success: true });
});

const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const readMessages = () => {
    try { return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8')); } 
    catch(err) { return []; }
};
const writeMessages = (msgs) => {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(msgs, null, 2), 'utf8');
};

app.post('/api/contact', (req, res) => {
    const { name, email, subject, message } = req.body;
    if(!email || !message) return res.status(400).json({ error: "Missing fields" });
    const msgs = readMessages();
    msgs.push({
        id: Date.now().toString(),
        name,
        email,
        subject,
        message,
        date: new Date().toISOString()
    });
    writeMessages(msgs);
    res.json({ success: true, message: "Thank you for your message. We will get back to you soon!" });
});

app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const imageUrl = process.env.CLOUDINARY_URL ? req.file.path : '/uploads/' + req.file.filename;
    res.json({ url: imageUrl });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
