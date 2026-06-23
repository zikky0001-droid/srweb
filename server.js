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

const recordingsDir = path.join(
    __dirname,
    'recordings'
);

if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, {
        recursive: true
    });
}

app.use(
    '/videos',
    express.static(recordingsDir)
);

app.get('/ping', (req, res) => {
    res.json({
        status: 'alive',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        engine: 'Playwright',
        format: 'WebM',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/record', async (req, res) => {

    const {
        url,
        duration = 10,
        scroll = false,
        speed = '1x',
        json = false
    } = req.query;

    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL required'
        });
    }

    if (
        !url.startsWith('http://') &&
        !url.startsWith('https://')
    ) {
        return res.status(400).json({
            success: false,
            error:
                'URL must start with http:// or https://'
        });
    }

    const durationSec = Math.min(
        Math.max(Number(duration) || 10, 1),
        120
    );

    const speeds = {
        '1x': 250,
        '1.5x': 375,
        '2x': 500
    };

    const scrollSpeed =
        speeds[speed] || speeds['1x'];

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

        const context =
            await browser.newContext({
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

        const page =
            await context.newPage();

        const video =
            page.video();

        console.log(
            `Recording ${url}`
        );

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        await page.waitForTimeout(
            3000
        );

        const durationMs =
            durationSec * 1000;

        if (scroll === 'true') {

            await page.evaluate(
    async ({
        durationMs,
        scrollSpeed
    }) => {

        const end =
            Date.now() +
            durationMs;

        let direction = 1;

        while (
            Date.now() < end
        ) {

            window.scrollBy({
                top:
                    scrollSpeed *
                    direction,
                behavior:
                    'smooth'
            });

            if (
                window.innerHeight +
                    window.scrollY >=
                document.body
                    .scrollHeight
            ) {
                direction = -1;
            }

            if (
                window.scrollY <= 0
            ) {
                direction = 1;
            }

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        1000
                    )
            );
        }

    },
    {
        durationMs,
        scrollSpeed
    }
);
        } else {

            await page.waitForTimeout(
                durationMs
            );

        }

        await context.close();

        const tempPath =
            await video.path();

        await browser.close();

        const filename =
            `recording_${Date.now()}.webm`;

        const finalPath =
            path.join(
                recordingsDir,
                filename
            );

        fs.renameSync(
            tempPath,
            finalPath
        );

        const stats =
            fs.statSync(finalPath);

        const size =
            (
                stats.size /
                1024 /
                1024
            ).toFixed(2);

        const downloadUrl =
            `${req.protocol}://${req.get(
                'host'
            )}/videos/${filename}`;

        setTimeout(() => {
            fs.unlink(
                finalPath,
                () => {}
            );
        }, 300000);

        if (json === 'true') {

            return res.json({
                success: true,
                filename,
                duration: durationSec,
                scroll:
                    scroll === 'true',
                speed:
                    speed in speeds
                        ? speed
                        : '1x',
                size: `${size} MB`,
                downloadUrl
            });

        }

        res.download(
            finalPath,
            filename
        );

    } catch (err) {

        console.error(err);

        if (browser) {
            try {
                await browser.close();
            } catch {}
        }

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.get('/', (req, res) => {

    res.json({
        name: 'SRWEB',
        engine: 'Playwright',
        format: 'WebM',

        parameters: {
            url: 'Website URL',
            duration:
        'Recording duration in seconds (1-120)',
            scroll:
        'Enable scrolling (true or false)',
            speed:
        'The scrolling speed changer (1x, 1.5x, or 2x)',
            json:
        'Return JSON response (true or false)'
},

        endpoints: {

            ping:
                '/ping',

            status:
                '/api/status',

            basic:
                '/api/record?url=https://example.com',

            json:
                '/api/record?url=https://example.com&json=true',

            duration:
                '/api/record?url=https://example.com&duration=20',

            scroll:
                '/api/record?url=https://example.com&scroll=true',

            speed1x:
                '/api/record?url=https://example.com&scroll=true&speed=1x',

            speed15x:
                '/api/record?url=https://example.com&scroll=true&speed=1.5x',

            speed2x:
                '/api/record?url=https://example.com&scroll=true&speed=2x',

            full:
                '/api/record?url=https://example.com&duration=20&scroll=true&speed=1.5x&json=true'
        }
    });

});

app.listen(PORT, () => {
    console.log(
        `SRWEB running on port ${PORT}`
    );
});

