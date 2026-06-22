const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');

const app = express();
const PORT = process.env.PORT || 10000;

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
app.use(express.static(path.join(__dirname)));

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
    
    // Validate URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return res.status(400).json({ error: 'URL must start with http:// or https://' });
    }
    
    console.log(`🎬 Recording: ${url} for ${duration}s in ${format} format`);
    
    let browser = null;
    let recorder = null;
    
    try {
        // Launch browser
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });
        
        const page = await browser.newPage();
        
        // Set viewport
        await page.setViewport({
            width: 1280,
            height: 720,
            deviceScaleFactor: 1,
        });
        
        // Setup recorder
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
        
        // Generate filename
        const timestamp = Date.now();
        const filename = `recording_${timestamp}.${format}`;
        const savePath = path.join(recordingsDir, filename);
        
        // Start recording
        await recorder.start(savePath);
        
        // Navigate to URL
        console.log(`🌐 Navigating to: ${url}`);
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        // Wait for content
        await page.waitForTimeout(2000);
        
        // Wait for recording duration
        console.log(`⏱️ Recording for ${duration} seconds...`);
        await new Promise(resolve => setTimeout(resolve, (parseInt(duration) * 1000) + 2000));
        
        // Stop recorder
        try {
            await recorder.stop();
        } catch (e) {
            console.log('Recorder already stopped');
        }
        
        // Close browser
        await browser.close();
        
        // Check file exists
        if (!fs.existsSync(savePath)) {
            throw new Error('Recording file not created');
        }
        
        const fileStats = fs.statSync(savePath);
        const fileSize = fileStats.size / (1024 * 1024);
        
        console.log(`✅ Recording complete: ${filename} (${fileSize.toFixed(2)} MB)`);
        
        // Send file
        res.setHeader('Content-Type', `video/${format}`);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', fileStats.size);
        res.setHeader('X-Video-Size', fileSize.toFixed(2));
        res.setHeader('X-Video-Duration', duration);
        
        const fileStream = fs.createReadStream(savePath);
        fileStream.pipe(res);
        
        // Clean up after send
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

// WhatsApp Webhook endpoint (for receiving messages)
app.post('/api/whatsapp/webhook', async (req, res) => {
    try {
        const { message, from, to, mediaUrl } = req.body;
        
        console.log(`📱 WhatsApp message from ${from}:`, message);
        
        // Process the message
        if (message && message.toLowerCase().includes('record')) {
            // Extract URL from message
            const urlMatch = message.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
                const websiteUrl = urlMatch[0];
                console.log(`🎬 Recording request for: ${websiteUrl}`);
                
                // Send acknowledgment
                res.json({
                    status: 'processing',
                    message: `Recording ${websiteUrl}...`,
                    url: websiteUrl
                });
                
                // Here you would trigger the recording and send back the video
                // This could be done asynchronously with a webhook callback
                
                return;
            }
        }
        
        res.json({ status: 'received', message: 'Message received' });
        
    } catch (error) {
        console.error('❌ WhatsApp webhook error:', error);
        res.status(500).json({ error: 'Webhook error', message: error.message });
    }
});

// WhatsApp send message endpoint
app.post('/api/whatsapp/send', async (req, res) => {
    try {
        const { to, message, mediaUrl } = req.body;
        
        if (!to || !message) {
            return res.status(400).json({ error: 'To and message are required' });
        }
        
        console.log(`📤 Sending WhatsApp message to ${to}:`, message);
        
        // Here you would integrate with WhatsApp Business API or Twilio
        // Example using Twilio:
        /*
        const client = require('twilio')(accountSid, authToken);
        const msg = await client.messages.create({
            body: message,
            from: 'whatsapp:+14155238886',
            to: `whatsapp:${to}`
        });
        */
        
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
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        recordings: fs.readdirSync(recordingsDir).length,
        version: '1.0.0'
    });
});

// ============================================
// SERVE FRONTEND
// ============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`🚀 SRWEB running on port ${PORT}`);
    console.log(`📚 Server started at ${new Date().toISOString()}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📹 Recordings directory: ${recordingsDir}`);
});

module.exports = app;

