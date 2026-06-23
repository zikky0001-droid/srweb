import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(compression());
app.use(cors());
app.use(express.json());

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

const recordingsDir = path.join(__dirname, 'recordings');

if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
}

app.use('/videos', express.static(recordingsDir));

/* ---------------- PING ---------------- */
app.get('/ping', (req, res) => {
    res.json({
        status: 'alive',
        timestamp: new Date().toISOString()
    });
});

/* ---------------- STATUS ---------------- */
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        engine: 'Playwright',
        format: 'WebM',
        timestamp: new Date().toISOString()
    });
});

/* ---------------- RECORD API ---------------- */
app.get('/api/record', async (req, res) => {

    const {
        url,
        duration = 10,
        scroll = false,
        json = false
    } = req.query;

    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL required'
        });
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return res.status(400).json({
            success: false,
            error: 'URL must start with http:// or https://'
        });
    }

    const durationNum = parseInt(duration, 10);

if (isNaN(durationNum)) {
    return res.status(400).json({
        success: false,
        error: 'Duration must be a valid number'
    });
}

if (durationNum < 10) {
    return res.status(400).json({
        success: false,
        error: 'Minimum duration is 10 seconds'
    });
}

if (durationNum > 120) {
    return res.status(400).json({
        success: false,
        error: 'Maximum duration is 120 seconds'
    });
}

const durationSec = durationNum;

    let browser;

    try {

        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--mute-audio'
            ]
        });

        const context = await browser.newContext({
            viewport: {
                width: 1280,
                height: 720
            },
            recordVideo: {
                dir: recordingsDir,
                size: {
                    width: 1280,
                    height: 720
                }
            }
        });

        const page = await context.newPage();
        const video = page.video();

        console.log(`Recording ${url}`);

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // ✅ reduced loading delay (1 sec)
        await page.waitForTimeout(1000);

        const durationMs = durationSec * 1000;

        if (scroll === 'true') {

            // ---------- SMART DELAY BEFORE SCROLL ----------
            let prepDelay = 7000;

            if (durationSec >= 15) prepDelay = 10000;
            if (durationSec >= 20) prepDelay = 12000;
            if (durationSec >= 30) prepDelay = 13000;

            const safeDelay = Math.min(prepDelay, durationMs / 2);

            await page.waitForTimeout(safeDelay);

            const scrollTime = durationMs - safeDelay;

            await page.evaluate(async (scrollTime) => {

                const end = Date.now() + scrollTime;
                let direction = 1;

                while (Date.now() < end) {

                    window.scrollBy({
                        top: 240 * direction,
                        behavior: 'smooth'
                    });

                    const atBottom =
                        window.innerHeight + window.scrollY >= document.body.scrollHeight;

                    const atTop = window.scrollY <= 0;

                    if (atBottom) direction = -1;
                    if (atTop) direction = 1;

                    await new Promise(resolve => setTimeout(resolve, 300));
                }

            }, scrollTime);

        } else {

            await page.waitForTimeout(durationMs);
        }

        await context.close();

        const tempPath = await video.path();
        await browser.close();

        const filename = `recording_${Date.now()}.webm`;
        const finalPath = path.join(recordingsDir, filename);

        fs.renameSync(tempPath, finalPath);

        const stats = fs.statSync(finalPath);
        const size = (stats.size / 1024 / 1024).toFixed(2);

        const downloadUrl = `${req.protocol}://${req.get('host')}/videos/${filename}`;

        setTimeout(() => {
            fs.unlink(finalPath, () => {});
        }, 300000);

        if (json === 'true') {
            return res.json({
                success: true,
                filename,
                duration: durationSec,
                scroll: scroll === 'true',
                size: `${size} MB`,
                downloadUrl
            });
        }

        res.download(finalPath, filename);

    } catch (err) {

        console.error(err);

        if (browser) {
            try { await browser.close(); } catch {}
        }

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* ---------------- HOME ---------------- */
app.get('/', (req, res) => {
    res.json({
        name: 'SRWEB',
        engine: 'Playwright',
        format: 'WebM',

        parameters: {
            url: 'Website URL',
            duration: 'Recording duration in seconds (1-120)',
            scroll: 'Enable scrolling (true or false)',
            json: 'Return JSON response (true or false)'
        },

        endpoints: {
            ping: '/ping',
            status: '/api/status',
            basic: '/api/record?url=https://example.com',
            json: '/api/record?url=https://example.com&json=true',
            duration: '/api/record?url=https://example.com&duration=20',
            scroll: '/api/record?url=https://example.com&scroll=true',
            full: '/api/record?url=https://example.com&duration=20&scroll=true&json=true'
        }
    });
});

app.listen(PORT, () => {
    console.log(`SRWEB running on port ${PORT}`);
});

