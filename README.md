<div align="center">
  <p>
    <img src="./icon1.png" alt="ZRECORD visual 1" width="480">
    &nbsp;&nbsp;
    <img src="./icon2.png" alt="ZRECORD visual 2" width="480">
  </p>

  <h1>🎥 ZRECORD</h1>
  <p><strong>Record Websites. Capture the Experience.</strong></p>
  <p>A browser-based website recorder powered by Node.js, Express, Playwright and Chromium.</p>
  <p>
    <a href="https://github.com/zikky0001-droid/srweb">GitHub Repository</a> ·
    <a href="#api-reference">API Reference</a> ·
    <a href="#installation">Installation</a> ·
    <a href="#deployment">Deployment</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white" alt="Node.js 20+">
    <img src="https://img.shields.io/badge/Express.js-4.x-000000?logo=express&logoColor=white" alt="Express.js">
    <img src="https://img.shields.io/badge/Playwright-Chromium-2EAD33?logo=playwright&logoColor=white" alt="Playwright">
    <img src="https://img.shields.io/badge/Deployment-Render-46E3B7?logo=render&logoColor=black" alt="Render">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License">
  </p>
</div>

---

> **Project status — no longer maintained**  
> ZRECORD (repository and source name: **SRWEB**) was tested on Render and was functional during the period in which it was tested. It is no longer actively maintained or developed. Render was the only hosting platform used for testing; other platforms and deployment environments were not tested. The current availability of any previous deployment, dependency compatibility and continued operation are not guaranteed. This repository is preserved for reference, learning and experimentation.

## 📌 Project identity

| Item | Details |
|---|---|
| Product / display name | **ZRECORD** |
| Repository name | **SRWEB** |
| GitHub repository | [`zikky0001-droid/srweb`](https://github.com/zikky0001-droid/srweb) |
| Description | Screen Record Websites |
| Developer | **DEV • ZIKKY 🤍** |
| Runtime | Node.js 20 or newer |
| Hosting tested | Render only |
| License | MIT — see [`LICENSE`](./LICENSE) |

**Naming note:** ZRECORD is the product name used in this documentation. SRWEB is the GitHub repository name and the name still used in parts of the existing source code and interface. The repository has not been renamed.

## ✨ About ZRECORD

**ZRECORD** is a website-recording project that uses an automated browser to capture a website session and produce a video file. A recording request supplies a website URL and recording options. The Node.js server uses Playwright to launch headless Chromium, open the target page, record the browser session and return the resulting WebM video.

The project contains a browser interface built with HTML, CSS and JavaScript, together with an Express server that provides the recording API and service-status routes. The browser automation and video generation happen on the server rather than on the visitor's device.

The source repository is named **SRWEB** (`zikky0001-droid/srweb`). The current HTML interface still displays SRWEB branding in several places; this README uses ZRECORD as the product name without implying that the source files have been renamed.

## 🧭 How it works

1. **Submit a website address** — provide a URL beginning with `http://` or `https://`.
2. **Send a recording request** — the Express endpoint checks the API key, URL and requested duration.
3. **Launch the browser** — Playwright starts headless Chromium with a 1280 × 720 viewport.
4. **Capture the page** — Chromium records the page for the selected duration. Optional scroll mode moves down and back up the page while the recording is running.
5. **Receive the recording** — the server finalizes a WebM file and either returns it as a download or responds with JSON metadata and a temporary download URL.

## 🚀 Features present in the source

- Automated website recording through Playwright and headless Chromium.
- WebM video output at 1280 × 720.
- API recording duration from 10 to 120 seconds.
- Optional automatic page scrolling.
- Direct video download or JSON metadata response.
- Health-check and service-status endpoints.
- Browser interface with dark/light theme switching.
- Browser-side recording-history entries stored in `localStorage`.
- Progress indicator and toast notifications in the interface.
- Express middleware for compression, CORS and security headers.
- Docker-based deployment configuration prepared for Render.

> **Implementation note:** The source includes interface controls that are not fully connected to the current backend. Some controls advertise functionality that the API does not implement. Review [Known limitations](#known-limitations) before using or extending the project.

## 🧰 Technology stack

| Technology | Role in the project |
|---|---|
| Node.js 20+ | JavaScript runtime |
| Express 4 | HTTP server and API routes |
| Playwright | Browser automation and video recording |
| Chromium | Website rendering and capture |
| HTML | Browser interface structure |
| CSS | Interface styling and responsive layout |
| JavaScript | Frontend interactions and server logic |
| Docker | Container-based runtime |
| Render | Hosting platform used for testing |

## 📁 Repository structure

```text
srweb/
├── .dockerignore
├── .gitignore
├── Dockerfile
├── LICENSE
├── README.md
├── icon1.png
├── icon2.png
├── index.html
├── package.json
├── render.yaml
├── script.js
├── server.js
└── style.css
```

At runtime, `server.js` creates a `recordings/` directory for generated video files. The directory is excluded from Git by `.gitignore` and is not included in the source repository archive.

## ⚙️ Installation

### Requirements

- Node.js 20 or newer.
- npm.
- A Playwright-compatible Chromium installation.

The supplied Dockerfile uses the Playwright image `mcr.microsoft.com/playwright:v1.61.0-jammy`, which provides the browser environment used by the container configuration.

### Clone the repository

```bash
git clone https://github.com/zikky0001-droid/srweb.git
cd srweb
```

### Install dependencies

```bash
npm install
```

For a local environment that does not use the supplied Docker image, install the Chromium browser required by Playwright:

```bash
npx playwright install chromium
```

### Start the server

```bash
npm start
```

The server listens on `process.env.PORT`, or port `10000` when no `PORT` value is supplied.

**Important:** In the current source, the `GET /` route returns JSON service information. It does not serve `index.html`. The static interface files (`index.html`, `style.css` and `script.js`) are not mounted as static routes by `server.js`, so starting the API server alone does not make the interface available at `/`. The interface must be served separately or the server integration must be updated.

## 🐳 Docker

The repository includes a Dockerfile based on the official Playwright image:

```dockerfile
FROM mcr.microsoft.com/playwright:v1.61.0-jammy
```

Build the image:

```bash
docker build -t zrecord .
```

Run the container:

```bash
docker run --rm -p 10000:10000 -e PORT=10000 zrecord
```

The container starts `node server.js`. Chromium is launched in headless mode with container-oriented arguments, including `--no-sandbox` and `--disable-dev-shm-usage`.

## ☁️ Deployment

### Render

The included `render.yaml` defines a Docker web service with the following configuration:

| Setting | Configured value |
|---|---|
| Service name | `srweb` |
| Runtime | Docker |
| Region | Oregon |
| Plan in YAML | Free |
| Dockerfile | `./Dockerfile` |
| Environment | `NODE_ENV=production` |
| Health check | `/ping` |

To deploy the repository through Render, connect the GitHub repository and use the included Blueprint configuration, or create a Docker web service that uses the repository's Dockerfile.

**Testing scope:** The project was tested on Render only and was functional during that testing period. No claim is made that deployment has been tested on Vercel, Railway, VPS hosting, or any other platform. Render configuration, plan availability and platform behaviour can change independently of this repository.

## 🔌 API reference

The endpoints below are defined in `server.js` in the supplied source snapshot. The server uses Express and all listed routes use the `GET` method unless otherwise noted.

### `GET /`

Returns JSON service information, including the service name, browser engine, output format, authentication information, supported parameters and example recording URLs.

**Security warning:** The current implementation includes the configured API key in this public root response. The same key is hardcoded in `server.js`, rather than loaded from an environment variable. This is not secure authentication for a public production service. Do not treat the current API-key implementation as suitable for protecting a publicly exposed service.

### `GET /ping`

A lightweight health-check route. It returns an `alive` status and a timestamp. This is the health-check path configured in `render.yaml`.

Example:

```bash
curl https://YOUR-RENDER-SERVICE.onrender.com/ping
```

Example response:

```json
{
  "status": "alive",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

The timestamp above is illustrative.

### `GET /api/status`

Returns the current service status, recording engine and output format.

Example:

```bash
curl https://YOUR-RENDER-SERVICE.onrender.com/api/status
```

Example response:

```json
{
  "status": "online",
  "engine": "Playwright",
  "format": "WebM",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

The timestamp above is illustrative. This route reports the configured service response; it should not be treated as a complete diagnostic of every browser-recording dependency.

### `GET /api/record`

Starts a website recording. The endpoint requires the `apiKey` query parameter and accepts the following options:

| Parameter | Required | Default | Description |
|---|---:|---|---|
| `apiKey` | Yes | None | Must match the key currently hardcoded in `server.js`. |
| `url` | Yes | None | Target website URL. The current validation checks that it begins with `http://` or `https://`. |
| `duration` | No | `10` | Recording length in seconds. Accepted range: `10`–`120`. |
| `scroll` | No | `false` | Set to `true` to enable automatic page scrolling. |
| `json` | No | `false` | Set to `true` to return JSON metadata instead of the video file directly. |

Example request:

```text
/api/record?apiKey=YOUR_CURRENT_SERVER_KEY&url=https%3A%2F%2Fexample.com&duration=20&scroll=true&json=true
```

`YOUR_CURRENT_SERVER_KEY` is a placeholder, not a configured credential. In this source snapshot, the key is hardcoded in `server.js`; there is no environment-variable setting for it. The key should be moved to a private environment variable and removed from the public root response before the service is exposed for general use.

#### JSON response

When `json=true`, a successful request returns a response with this structure:

```json
{
  "success": true,
  "filename": "recording_0000000000000.webm",
  "duration": 20,
  "scroll": true,
  "json": true,
  "size": "1.23 MB",
  "downloadUrl": "https://your-host.example/videos/recording_0000000000000.webm"
}
```

The filename, size and download URL are examples; actual values depend on the recording and hosting environment.

#### Direct download

When `json` is not `true`, the endpoint sends the generated WebM file as a download response.

### `GET /videos/:filename`

The server exposes the recordings directory through Express static-file middleware at `/videos`. A successfully generated video can be accessed using the `downloadUrl` returned by JSON mode.

The server schedules a generated recording for deletion after approximately **300 seconds (five minutes)**. The storage is temporary and is not intended to be a permanent video library.

## 🧪 Example API checks

Set the base URL to the actual Render service address before running these commands.

Check service health:

```bash
curl https://YOUR-RENDER-SERVICE.onrender.com/ping
```

Check the API status:

```bash
curl https://YOUR-RENDER-SERVICE.onrender.com/api/status
```

Request a recording in JSON mode:

```bash
curl --get "https://YOUR-RENDER-SERVICE.onrender.com/api/record" \
  --data-urlencode "apiKey=YOUR_CURRENT_SERVER_KEY" \
  --data-urlencode "url=https://example.com" \
  --data-urlencode "duration=20" \
  --data-urlencode "scroll=true" \
  --data-urlencode "json=true"
```

Replace the placeholders with the actual service URL and the key configured in the source. The existing hardcoded-key implementation is insecure and should be corrected before public use.

## 🎞️ Recording behaviour

The backend currently:

- Launches Chromium in headless mode.
- Uses a viewport and recording size of 1280 × 720.
- Navigates to the target using `waitUntil: 'domcontentloaded'` with a 30-second navigation timeout.
- Waits briefly after page navigation before recording.
- Records video in WebM format using Playwright's browser video recording.
- Optionally scrolls down and back up the page while recording.
- Saves the generated file to the local `recordings/` directory.
- Schedules the generated file for deletion after five minutes.

The target website's own behaviour can affect the result. Pages may block automated browsers, require authentication, display dynamic content, or depend on resources that do not load in the recording environment. A successful API response does not guarantee that every page will be captured exactly as it appears in a normal browser session.

## ⚠️ Known limitations

The following limitations are visible in the supplied repository source. They describe this source snapshot and may differ from any changes made outside the uploaded archive.

1. **WebM output only.** The backend uses Playwright's video recording and saves `.webm` files. It does not implement conversion to MP4, AVI or MOV.
2. **Frontend format selector is not connected to output conversion.** The interface offers MP4, WebM, AVI and MOV options, but `server.js` does not read or process a `format` parameter. The generated file remains WebM.
3. **Frontend duration mismatch.** The HTML offers a five-second option, but the API rejects durations below ten seconds. The API accepts values from 10 to 120 seconds; the frontend offers only 5, 10, 15, 30 and 60 seconds.
4. **Frontend request omits the API key.** `script.js` calls `/api/record` with the URL, duration and format, but does not send the required `apiKey` parameter. As written, the normal frontend recording request does not satisfy the backend authentication check.
5. **Frontend and backend are not joined by the Express server.** `server.js` returns JSON from `/` and does not serve `index.html`, `style.css` or `script.js` as static assets. The frontend needs separate static hosting or additional server integration.
6. **Navigation ID mismatch.** The HTML uses `whatsappBtn` and `statusBtn` for two navigation links, while the JavaScript searches for `whatsappNavBtn` and `statusNavBtn`. Those handlers therefore do not attach to the corresponding current HTML elements.
7. **WhatsApp route is absent.** The frontend attempts to call `/api/whatsapp/send`, but no matching route is implemented in `server.js` in this source snapshot. The WhatsApp send control is therefore not backed by this server.
8. **History is browser-side metadata.** The frontend stores history entries in `localStorage`; it is not a server-side video archive. The current `downloadRecording()` function displays a toast message rather than retrieving the previously recorded file.
9. **Progress is simulated.** The frontend increments a progress indicator while waiting for the response; it does not receive real-time recording progress from the backend.
10. **Temporary local storage.** Videos are written to the server's local `recordings/` directory and deleted after about five minutes. The Render YAML does not configure a persistent disk.
11. **Basic URL validation.** The API checks the URL's `http://` or `https://` prefix but does not implement a comprehensive destination or network-address policy. Do not treat this as a hardened public URL-fetching service.
12. **No rate limiting or concurrency management is implemented in the supplied server.** Multiple simultaneous recording requests may consume substantial server resources.

## 🔐 Security considerations

This repository is no longer maintained. The current source should be treated as an experimental or historical implementation, not as a hardened public production service.

- The recording API key is hardcoded in `server.js`.
- The root endpoint returns the configured key in its JSON response.
- The recording key is transmitted as a query parameter, which can be retained in request logs, browser history or monitoring systems.
- CORS is enabled without an origin allowlist in the current source.
- URL validation is basic and does not provide a complete protection against requests to unintended internal or local destinations.
- There is no built-in request throttling or concurrency limit.
- The `/videos` path serves generated recordings without a separate access-control check; anyone with a valid recording URL may be able to retrieve the file until it is deleted.

Before adapting this project for public use, authentication, secret handling, destination validation, access controls, rate limiting, resource limits and storage lifecycle management would need a security-focused review and implementation.

## 🧩 Environment and configuration

The current source reads one runtime setting directly:

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Port on which Express listens | `10000` |
| `NODE_ENV` | Set to `production` in the Render configuration and Docker image | Not explicitly defaulted in `server.js` |

The current API key is **not** read from an environment variable. It is hardcoded in `server.js` and exposed by the root JSON response. No additional secret-management variables are implemented in the supplied source.

## 🧑‍💻 Development notes

The package scripts include:

```bash
npm start
```

There are no test, lint or build scripts defined in the supplied `package.json`. The source archive does not include an automated test suite. Any changes should therefore be checked manually in a controlled environment, especially changes involving Playwright, Chromium, video output and temporary-file cleanup.

## 👤 Developer

**DEV • ZIKKY 🤍**  
GitHub: [@zikky0001-droid](https://github.com/zikky0001-droid)  
Repository: [zikky0001-droid/srweb](https://github.com/zikky0001-droid/srweb)

For project history or source-code context, use the GitHub repository. Since the project is no longer maintained, ongoing support, updates and compatibility fixes are not provided.

## 📜 License

This project is distributed under the **MIT License**. See the [`LICENSE`](./LICENSE) file for the complete license text.

```text
MIT License
Copyright (c) 2026 DEV • ZIKKY 🤍
```

---

<div align="center">
  <p><strong>ZRECORD</strong></p>
  <p><em>Screen Record Websites · Repository: SRWEB</em></p>
  <p>Built by DEV • ZIKKY 🤍</p>
</div>
