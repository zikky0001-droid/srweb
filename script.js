/**
 * SRWEB Frontend - Screen Record Website
 */

const API_URL = ''; // Empty = same origin

// DOM Elements
const urlInput = document.getElementById('urlInput');
const durationInput = document.getElementById('durationInput');
const recordBtn = document.getElementById('recordBtn');
const status = document.getElementById('status');
const statusText = document.getElementById('statusText');
const result = document.getElementById('result');
const videoPlayer = document.getElementById('videoPlayer');
const resultUrl = document.getElementById('resultUrl');
const resultDuration = document.getElementById('resultDuration');
const resultSize = document.getElementById('resultSize');
const downloadBtn = document.getElementById('downloadBtn');

let currentVideoBlob = null;

// ============================================
// API FUNCTIONS
// ============================================

async function recordWebsite(url, duration) {
    const response = await fetch('/api/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, duration })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Recording failed');
    }
    
    return response;
}

async function checkHealth() {
    try {
        const response = await fetch('/api/health');
        return await response.json();
    } catch (error) {
        return { status: 'offline', chrome: 'unknown' };
    }
}

// ============================================
// UI FUNCTIONS
// ============================================

function showStatus(message) {
    status.classList.remove('hidden');
    statusText.textContent = message;
}

function hideStatus() {
    status.classList.add('hidden');
}

function showResult(url, duration, sizeMB, videoBlob) {
    currentVideoBlob = videoBlob;
    const videoUrl = URL.createObjectURL(videoBlob);
    videoPlayer.src = videoUrl;
    resultUrl.textContent = url;
    resultDuration.textContent = duration;
    resultSize.textContent = sizeMB;
    result.classList.remove('hidden');
}

function hideResult() {
    result.classList.add('hidden');
    if (videoPlayer.src) {
        URL.revokeObjectURL(videoPlayer.src);
        videoPlayer.src = '';
    }
    currentVideoBlob = null;
}

function setLoading(isLoading) {
    recordBtn.disabled = isLoading;
    recordBtn.innerHTML = isLoading 
        ? '<span class="icon">⏳</span> Recording...' 
        : '<span class="icon">🔴</span> Start Recording';
}

// ============================================
// EVENT HANDLERS
// ============================================

recordBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    const duration = parseInt(durationInput.value) || 15;
    
    if (!url) {
        alert('Please enter a URL');
        return;
    }
    
    hideResult();
    showStatus('🔍 Checking Chrome...');
    setLoading(true);
    
    try {
        const health = await checkHealth();
        if (health.chrome === 'not found') {
            throw new Error('Chrome/Chromium not available on server');
        }
        
        showStatus(`📹 Recording ${url} for ${duration}s...`);
        
        const response = await recordWebsite(url, duration);
        const videoBlob = await response.blob();
        const contentDisposition = response.headers.get('content-disposition');
        const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
        const sizeMB = (videoBlob.size / (1024 * 1024)).toFixed(2);
        
        hideStatus();
        showResult(url, duration, sizeMB, videoBlob);
        
    } catch (error) {
        hideStatus();
        alert(`❌ Error: ${error.message}`);
        console.error('[SRWEB] Error:', error);
    } finally {
        setLoading(false);
    }
});

downloadBtn.addEventListener('click', () => {
    if (!currentVideoBlob) return;
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(currentVideoBlob);
    a.download = `srweb_${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});

// ============================================
// INITIALIZATION
// ============================================

async function init() {
    try {
        const health = await checkHealth();
        console.log('[SRWEB] Server status:', health);
        
        if (health.chrome === 'not found') {
            statusText.textContent = '⚠️ Chrome not installed on server';
            status.classList.remove('hidden');
            recordBtn.disabled = true;
        }
    } catch (error) {
        console.error('[SRWEB] Cannot connect to server:', error);
        statusText.textContent = '⚠️ Cannot connect to server. Is it running?';
        status.classList.remove('hidden');
    }
}

init();