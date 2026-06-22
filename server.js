import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import puppeteer from 'puppeteer-core';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';

// ✅ Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ Log current directory for debugging
console.log(`📁 Current directory: ${__dirname}`);
console.log(`📁 Files in directory:`, fs.readdirSync(__dirname));

// ============================================
// FIND CHROME
// ============================================

function findChromePath() {
    const possiblePaths = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
    ];
    
    for (const chromePath of possiblePaths) {
        if (chromePath && fs.existsSync(chromePath)) {
            console.log(`✅ Found Chrome at: ${chromePath}`);
            return chromePath;
        }
    }
    
    console.warn('⚠️ Chrome not found!');
    return null;
}

const CHROME_PATH = findChromePath();

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "http:", "*"],
            connectSrc: ["'self'"]
        }
    }
}));

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept']
}));

app.use(compression());
app.use(express.json());

// ✅ FIXED: Serve static files from the current directory
app.use(express.static(__dirname));
// Also try serving from /app if needed
app.use('/static', express.static(path.join(__dirname, 'static')));

// ============================================
// CREATE RECORDINGS DIRECTORY
// ============================================

const recordingsDir = path.join(__dirname, 'recordings');
if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
}

// ============================================
// PING ENDPOINT
// ============================================

app.get('/ping', (req, res) => {
    res.status(200).json({ 
        status: 'alive', 
        timestamp: new Date().toISOString() 
    });
});

// ============================================
// 🎬 RECORD WEBSITE API
// ============================================

app.get('/api/record', async (req, res) => {
    const { url, duration = 10, format = 'mp4' } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return res.status(400).json({ error: 'URL must start with http:// or https://' });
    }
    
    console.log(`🎬 Recording: ${url} for ${duration}s in ${format} format`);
    
    let browser = null;
    let recorder = null;
    
    try {
        if (!CHROME_PATH) {
            throw new Error('Chrome not found!');
        }
        
        console.log(`🔧 Launching Chrome: ${CHROME_PATH}`);
        
        browser = await puppeteer.launch({
            executablePath: CHROME_PATH,
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        });
        
        const page = await browser.newPage();
        
        await page.setViewport({
            width: 1280,
            height: 720,
            deviceScaleFactor: 1,
        });
        
        const config = {
            followNewTab: true,
            fps: 25,
            videoFrame: {
                width: 1280,
                height: 720,
            },
            videoCodec: 'libx264',
            videoPreset: 'ultrafast',
            videoBitrate: 1000,
            autopad: {
                color: 'black'
            },
            recordDurationLimit: parseInt(duration),
        };
        
        recorder = new PuppeteerScreenRecorder(page, config);
        
        const timestamp = Date.now();
        const filename = `recording_${timestamp}.${format}`;
        const savePath = path.join(recordingsDir, filename);
        
        await recorder.start(savePath);
        
        console.log(`🌐 Navigating to: ${url}`);
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        await page.waitForTimeout(2000);
        
        console.log(`⏱️ Recording for ${duration} seconds...`);
        await new Promise(resolve => setTimeout(resolve, (parseInt(duration) * 1000) + 2000));
        
        try {
            await recorder.stop();
        } catch (e) {
            console.log('Recorder already stopped');
        }
        
        await browser.close();
        
        if (!fs.existsSync(savePath)) {
            throw new Error('Recording file not created');
        }
        
        const fileStats = fs.statSync(savePath);
        const fileSize = fileStats.size / (1024 * 1024);
        
        console.log(`✅ Recording complete: ${filename} (${fileSize.toFixed(2)} MB)`);
        
        res.setHeader('Content-Type', `video/${format}`);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', fileStats.size);
        res.setHeader('X-Video-Size', fileSize.toFixed(2));
        res.setHeader('X-Video-Duration', duration);
        
        const fileStream = fs.createReadStream(savePath);
        fileStream.pipe(res);
        
        fileStream.on('end', () => {
            fs.unlink(savePath, (err) => {
                if (err) console.warn('Could not delete temp file:', err);
                else console.log('🗑️ Temp file deleted');
            });
        });
        
    } catch (error) {
        console.error('❌ Recording error:', error);
        
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }
        
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Recording failed',
                message: error.message
            });
        }
    }
});

// ============================================
// 📱 WHATSAPP INTEGRATION
// ============================================

app.post('/api/whatsapp/webhook', async (req, res) => {
    try {
        const { message, from, to, mediaUrl } = req.body;
        console.log(`📱 WhatsApp message from ${from}:`, message);
        res.json({ status: 'received', message: 'Message received' });
    } catch (error) {
        console.error('❌ WhatsApp webhook error:', error);
        res.status(500).json({ error: 'Webhook error', message: error.message });
    }
});

app.post('/api/whatsapp/send', async (req, res) => {
    try {
        const { to, message, mediaUrl } = req.body;
        if (!to || !message) {
            return res.status(400).json({ error: 'To and message are required' });
        }
        console.log(`📤 Sending WhatsApp message to ${to}:`, message);
        res.json({
            status: 'sent',
            to: to,
            message: message,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ WhatsApp send error:', error);
        res.status(500).json({ error: 'Send failed', message: error.message });
    }
});

// ============================================
// STATUS ENDPOINT
// ============================================

app.get('/api/status', (req, res) => {
    let recordings = 0;
    try {
        recordings = fs.readdirSync(recordingsDir).length;
    } catch (e) {}
    
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        recordings: recordings,
        chrome: CHROME_PATH || 'Not found ❌',
        version: '1.0.0'
    });
});

// ============================================
// ✅ FIXED: Serve index.html for all routes
// ============================================

// Serve the main page
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    console.log(`📄 Serving index.html from: ${indexPath}`);
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        console.error('❌ index.html not found!');
        res.status(404).send('index.html not found');
    }
});

// Catch-all for SPA - serve index.html
app.get('*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api/') || req.path === '/ping') {
        return res.status(404).json({ error: 'Not found' });
    }
    
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Page not found');
    }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`🚀 SRWEB running on port ${PORT}`);
    console.log(`📚 Server started at ${new Date().toISOString()}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📹 Recordings directory: ${recordingsDir}`);
    console.log(`🔧 Chrome: ${CHROME_PATH || 'NOT FOUND ❌'}`);
    console.log(`📁 Serving files from: ${__dirname}`);
});


