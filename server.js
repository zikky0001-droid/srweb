/**
 * SRWEB - Screen Record Websites
 * Single file: API Server + Frontend Serving
 */

const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');  // ← Changed from puppeteer-core
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Serve static files (HTML, CSS, JS from current directory)
app.use(express.static(__dirname));

// ============================================
// CONFIGURATION
// ============================================
const RECORDINGS_DIR = path.join(__dirname, 'recordings');
const MAX_DURATION = 60;
const DEFAULT_DURATION = 30;

if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

// ============================================
// RECORD WEBSITE FUNCTION
// ============================================
async function recordWebsite(url, duration = DEFAULT_DURATION) {
    let browser = null;
    let recorder = null;
    
    try {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        console.log(`[SRWEB] Recording: ${url} (${duration}s)`);
        
        // Launch browser with Puppeteer's bundled Chromium
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1280,720'
            ]
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        const recorderConfig = {
            followNewTab: true,
            fps: 25,
            videoFrame: { width: 1280, height: 720 },
            videoCrf: 18,
            videoCodec: 'libx264',
            videoPreset: 'ultrafast',
            videoBitrate: 1000,
            recordDurationLimit: duration
        };
        
        recorder = new PuppeteerScreenRecorder(page, recorderConfig);
        
        const timestamp = Date.now();
        const safeUrl = url.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
        const filename = `${timestamp}_${safeUrl}.mp4`;
        const filePath = path.join(RECORDINGS_DIR, filename);
        
        await recorder.start(filePath);
        await new Promise(resolve => setTimeout(resolve, duration * 1000));
        await recorder.stop();
        await browser.close();
        
        const stats = fs.statSync(filePath);
        
        return {
            success: true,
            filename: filename,
            filePath: filePath,
            duration: duration,
            url: url,
            size: stats.size,
            sizeMB: (stats.size / (1024 * 1024)).toFixed(2)
        };
        
    } catch (error) {
        console.error('[SRWEB] Error:', error);
        if (recorder) { try { await recorder.stop(); } catch (e) {} }
        if (browser) { try { await browser.close(); } catch (e) {} }
        throw error;
    }
}

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        chromium: 'bundled' // Using Puppeteer's bundled Chromium
    });
});

// Record website - returns video file
app.post('/api/record', async (req, res) => {
    try {
        const { url, duration } = req.body;
        
        if (!url) {
            return res.status(400).json({ success: false, error: 'URL is required' });
        }
        
        const recordDuration = Math.min(parseInt(duration) || DEFAULT_DURATION, MAX_DURATION);
        const result = await recordWebsite(url, recordDuration);
        
        res.download(result.filePath, result.filename, (err) => {
            try { fs.unlinkSync(result.filePath); } catch (e) {}
        });
        
    } catch (error) {
        console.error('[API] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Record website - returns JSON with base64 video
app.post('/api/record-json', async (req, res) => {
    try {
        const { url, duration } = req.body;
        
        if (!url) {
            return res.status(400).json({ success: false, error: 'URL is required' });
        }
        
        const recordDuration = Math.min(parseInt(duration) || DEFAULT_DURATION, MAX_DURATION);
        const result = await recordWebsite(url, recordDuration);
        
        const videoBuffer = fs.readFileSync(result.filePath);
        const base64Video = videoBuffer.toString('base64');
        
        try { fs.unlinkSync(result.filePath); } catch (e) {}
        
        res.json({
            success: true,
            data: {
                url: result.url,
                duration: result.duration,
                sizeMB: result.sizeMB,
                video: base64Video,
                mimeType: 'video/mp4'
            }
        });
        
    } catch (error) {
        console.error('[API] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// SERVE FRONTEND (if index.html exists)
// ============================================
const frontendPath = path.join(__dirname, 'index.html');
if (fs.existsSync(frontendPath)) {
    app.get('/', (req, res) => {
        res.sendFile(frontendPath);
    });
}

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log(`\n🚀 SRWEB Server running on http://localhost:${PORT}`);
    console.log(`📹 Chromium: Bundled with Puppeteer`);
    console.log(`📁 Recordings: ${RECORDINGS_DIR}\n`);
});
