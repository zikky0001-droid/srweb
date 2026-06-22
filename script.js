// ============== DOM ELEMENTS ==============
const recordUrl = document.getElementById('recordUrl');
const recordBtn = document.getElementById('recordBtn');
const recordDuration = document.getElementById('recordDuration');
const recordFormat = document.getElementById('recordFormat');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');
const progressPercent = document.getElementById('progressPercent');
const historyList = document.getElementById('historyList');
const recordingsCount = document.getElementById('recordingsCount');
const themeToggle = document.getElementById('themeToggle');
const toastContainer = document.getElementById('toastContainer');

// WhatsApp elements
const whatsappNumber = document.getElementById('whatsappNumber');
const whatsappMessage = document.getElementById('whatsappMessage');
const whatsappSendBtn = document.getElementById('whatsappSendBtn');

// Navigation
const homeBtn = document.getElementById('homeBtn');
const recordNavBtn = document.getElementById('recordNavBtn');
const whatsappNavBtn = document.getElementById('whatsappNavBtn');
const statusNavBtn = document.getElementById('statusNavBtn');
const statusSection = document.getElementById('statusSection');
const whatsappSection = document.getElementById('whatsappSection');

// ============== STATE ==============
let recordingHistory = JSON.parse(localStorage.getItem('recordingHistory')) || [];
let isRecording = false;

// ============== INITIALIZE ==============
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 SRWEB Frontend loaded');
    loadTheme();
    renderHistory();
    updateStatus();
    setupEventListeners();
});

// ============== THEME ==============
function loadTheme() {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-theme');
        themeToggle.querySelector('i').className = 'fas fa-sun';
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const icon = themeToggle.querySelector('i');
    if (document.body.classList.contains('light-theme')) {
        icon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'light');
    } else {
        icon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'dark');
    }
}

// ============== TOAST ==============
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 'info-circle';
    toast.innerHTML = `<i class="fas fa-${icon}"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============== RECORDING ==============
async function startRecording() {
    console.log('🎬 startRecording() called');
    
    if (isRecording) {
        console.log('⚠️ Already recording');
        return;
    }
    
    const url = recordUrl.value.trim();
    const duration = recordDuration.value;
    const format = recordFormat.value;
    
    console.log(`📝 URL: ${url}, Duration: ${duration}, Format: ${format}`);
    
    if (!url) {
        showToast('Please enter a website URL', 'error');
        return;
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showToast('URL must start with http:// or https://', 'error');
        return;
    }
    
    isRecording = true;
    recordBtn.disabled = true;
    recordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recording...';
    
    progressSection.style.display = 'block';
    progressFill.style.width = '0%';
    progressLabel.textContent = 'Starting recording...';
    progressPercent.textContent = '0%';
    
    try {
        const apiUrl = `/api/record?url=${encodeURIComponent(url)}&duration=${duration}&format=${format}`;
        console.log(`📡 Fetching: ${apiUrl}`);
        
        const response = await fetch(apiUrl);
        
        console.log(`📡 Response status: ${response.status}`);
        
        if (!response.ok) {
            let errorMsg = 'Recording failed';
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || errorMsg;
            } catch (e) {}
            throw new Error(errorMsg);
        }
        
        // Get content disposition for filename
        const contentDisposition = response.headers.get('content-disposition');
        let filename = `recording.${format}`;
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match) filename = match[1];
        }
        
        console.log(`📄 Filename: ${filename}`);
        
        // Simulate progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            if (progress > 90) clearInterval(interval);
            updateProgress(progress, 'Downloading...');
        }, 300);
        
        // Get file as blob
        const blob = await response.blob();
        clearInterval(interval);
        updateProgress(100, 'Complete!');
        
        // Download
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        
        // Save to history
        const entry = {
            id: Date.now(),
            url: url,
            duration: duration,
            format: format,
            filename: filename,
            date: new Date().toISOString()
        };
        recordingHistory.unshift(entry);
        localStorage.setItem('recordingHistory', JSON.stringify(recordingHistory));
        renderHistory();
        updateStatus();
        
        showToast('✅ Recording complete!', 'success');
        
    } catch (error) {
        console.error('❌ Recording error:', error);
        showToast('❌ ' + error.message, 'error');
        updateProgress(0, 'Failed');
    }
    
    isRecording = false;
    recordBtn.disabled = false;
    recordBtn.innerHTML = '<i class="fas fa-play"></i> Record';
    
    setTimeout(() => {
        progressSection.style.display = 'none';
    }, 3000);
}

function updateProgress(percent, label) {
    progressFill.style.width = percent + '%';
    progressLabel.textContent = label || 'Processing...';
    progressPercent.textContent = percent + '%';
}

// ============== HISTORY ==============
function renderHistory() {
    if (recordingHistory.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-video"></i>
                <p>No recordings yet. Start recording!</p>
            </div>
        `;
        return;
    }
    
    historyList.innerHTML = recordingHistory.map(entry => `
        <div class="history-item">
            <div class="info">
                <span class="url">${entry.url}</span>
                <span class="meta">
                    ${new Date(entry.date).toLocaleString()} • 
                    ${entry.duration}s • 
                    ${entry.format.toUpperCase()}
                </span>
            </div>
            <div class="actions">
                <button class="btn-download" onclick="downloadRecording('${entry.filename}')">
                    <i class="fas fa-download"></i>
                </button>
                <button class="btn-delete" onclick="deleteRecording(${entry.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function downloadRecording(filename) {
    showToast('Download: ' + filename, 'info');
}

function deleteRecording(id) {
    recordingHistory = recordingHistory.filter(entry => entry.id !== id);
    localStorage.setItem('recordingHistory', JSON.stringify(recordingHistory));
    renderHistory();
    updateStatus();
    showToast('Recording deleted', 'info');
}

// ============== STATUS ==============
async function updateStatus() {
    recordingsCount.textContent = recordingHistory.length;
    
    try {
        const response = await fetch('/api/status');
        if (response.ok) {
            const data = await response.json();
            document.getElementById('serverStatus').textContent = 'Online ✅';
            console.log('📊 Status:', data);
        }
    } catch (error) {
        document.getElementById('serverStatus').textContent = 'Offline ❌';
        console.warn('⚠️ Status fetch failed');
    }
}

// ============== WHATSAPP ==============
async function sendWhatsApp() {
    const number = whatsappNumber.value.trim();
    const message = whatsappMessage.value.trim();
    
    if (!number) {
        showToast('Please enter a phone number', 'error');
        return;
    }
    
    if (!message) {
        showToast('Please enter a message', 'error');
        return;
    }
    
    try {
        whatsappSendBtn.disabled = true;
        whatsappSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        
        const response = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: number, message })
        });
        
        if (!response.ok) throw new Error('Send failed');
        
        showToast('✅ WhatsApp message sent!', 'success');
        whatsappMessage.value = '';
        
    } catch (error) {
        showToast('❌ ' + error.message, 'error');
    } finally {
        whatsappSendBtn.disabled = false;
        whatsappSendBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Send';
    }
}

// ============== NAVIGATION ==============
function navigateTo(section) {
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    
    document.getElementById('statusSection').style.display = 'none';
    document.getElementById('whatsappSection').style.display = 'none';
    document.querySelector('.hero-section').style.display = 'block';
    document.querySelector('.history-section').style.display = 'block';
    
    if (section === 'home') {
        homeBtn.classList.add('active');
    } else if (section === 'record') {
        recordNavBtn.classList.add('active');
        document.querySelector('.hero-section').scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'whatsapp') {
        whatsappNavBtn.classList.add('active');
        document.getElementById('whatsappSection').style.display = 'block';
        document.querySelector('.hero-section').style.display = 'none';
        document.querySelector('.history-section').style.display = 'none';
    } else if (section === 'status') {
        statusNavBtn.classList.add('active');
        document.getElementById('statusSection').style.display = 'block';
        document.querySelector('.hero-section').style.display = 'none';
        document.querySelector('.history-section').style.display = 'none';
    }
}

// ============== EVENT LISTENERS ==============
function setupEventListeners() {
    console.log('🔗 Setting up event listeners...');
    
    // ✅ Record button - main
    if (recordBtn) {
        recordBtn.addEventListener('click', startRecording);
        console.log('✅ Record button attached');
    } else {
        console.warn('⚠️ Record button not found');
    }
    
    // ✅ Record URL - Enter key
    if (recordUrl) {
        recordUrl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') startRecording();
        });
    }
    
    // ✅ Theme toggle
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // ✅ Navigation
    if (homeBtn) {
        homeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo('home');
        });
    }
    
    if (recordNavBtn) {
        recordNavBtn.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo('record');
        });
    }
    
    if (whatsappNavBtn) {
        whatsappNavBtn.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo('whatsapp');
        });
    }
    
    if (statusNavBtn) {
        statusNavBtn.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo('status');
        });
    }
    
    // ✅ WhatsApp send
    if (whatsappSendBtn) {
        whatsappSendBtn.addEventListener('click', sendWhatsApp);
    }
    
    if (whatsappMessage) {
        whatsappMessage.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendWhatsApp();
        });
    }
    
    console.log('✅ All event listeners setup complete');
}

// ============== EXPOSE TO HTML ==============
window.startRecording = startRecording;
window.downloadRecording = downloadRecording;
window.deleteRecording = deleteRecording;
window.sendWhatsApp = sendWhatsApp;

