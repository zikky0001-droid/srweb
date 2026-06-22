/**
 * SRWEB - Screen Record Websites
 * Single file: API Server + Frontend Serving
 */

const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
// FIND CHROME EXECUTABLE
// ============================================
function findChrome() {
    const commonPaths = [
        process.env.CHROME_PATH,
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/chrome',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
    ].filter(Boolean);
    
    for (const p of commonPaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    
    try {
        const whichResult = execSync('which google-chrome || which chromium-browser || which chromium || which chrome', { encoding: 'utf8' });
        const trimmed = whichResult.trim();
        if (trimmed && fs.existsSync(trimmed)) {
            return trimmed;
        }
    } catch (e) {}
    
    return null;
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
        
        const chromePath = findChrome();
        if (!chromePath) {
            throw new Error('Chrome/Chromium not found. Please install Chrome or set CHROME_PATH.');
        }
        
        console.log(`[SRWEB] Chrome: ${chromePath}`);
        console.log(`[SRWEB] Recording: ${url} (${duration}s)`);
        
        browser = await puppeteer.launch({
            executablePath: chromePath,
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
        chrome: findChrome() ? 'installed' : 'not found'
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
    console.log(`📹 Chrome: ${findChrome() || '❌ NOT FOUND'}`);
    console.log(`📁 Recordings: ${RECORDINGS_DIR}\n`);
});