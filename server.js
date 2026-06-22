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

const recordingsDir =
    path.join(__dirname, 'recordings');

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
        format: 'webm',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/record', async (req, res) => {

    const {
        url,
        duration = 10,
        json = false
    } = req.query;

    if (!url) {
        return res.status(400).json({
            error: 'URL required'
        });
    }

    if (
        !url.startsWith('http://') &&
        !url.startsWith('https://')
    ) {
        return res.status(400).json({
            error:
                'URL must begin with http:// or https://'
        });
    }

    let browser;

    try {

        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-background-networking',
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

        console.log(`Recording ${url}`);

        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        await page.waitForTimeout(
            Number(duration) * 1000
        );

        const video = page.video();

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

        const fileSize =
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
                size: `${fileSize} MB`,
                duration,
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
        endpoints: {
            record:
                '/api/record?url=https://example.com',
            api:
                '/api/record?url=https://example.com&json=true',
            status:
                '/api/status'
        }
    });
});

app.listen(PORT, () => {
    console.log(
        `SRWEB running on port ${PORT}`
    );
});
