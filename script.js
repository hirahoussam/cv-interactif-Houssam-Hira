import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- 1. FIREBASE SETUP ---
setLogLevel('Debug');

// Global variables provided by the environment (if applicable)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

if (Object.keys(firebaseConfig).length > 0) {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    
    async function authAndInit() {
        try {
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
                console.log("Firebase: Signed in with custom token.");
            } else {
                await signInAnonymously(auth);
                console.log("Firebase: Signed in anonymously.");
            }
        } catch (error) {
            console.error("Firebase Auth Error:", error);
        }
    }
    authAndInit();
} else {
    console.warn("Firebase configuration not available. Running in local mode.");
}

// --- 2. APPLICATION LOGIC ---

// 2.1. SINGLE PAGE APPLICATION (SPA) ROUTING
const views = {
    'profile': document.getElementById('profile-view'),
    'skills': document.getElementById('skills-view'),
    'learning': document.getElementById('learning-view'),
    'projects': document.getElementById('projects-view'),
    'education': document.getElementById('education-view'),
    'contact': document.getElementById('contact-view'),
};
const navLinks = document.querySelectorAll('.nav-link');
const defaultView = 'profile';

function hideAllViews() {
    Object.values(views).forEach(view => {
        view.style.display = 'none';
        view.style.opacity = '0';
        view.style.transform = 'translateY(20px)';
    });
    navLinks.forEach(link => link.classList.remove('active'));
}

function navigate(hash) {
    const route = (hash || window.location.hash || `#${defaultView}`).substring(1).toLowerCase();
    
    hideAllViews();

    const targetView = views[route];
    
    if (targetView) {
        setTimeout(() => {
            targetView.style.display = 'block';
            targetView.offsetHeight; 
            targetView.style.opacity = '1';
            targetView.style.transform = 'translateY(0)';
        }, 50);

        navLinks.forEach(link => {
            if (link.getAttribute('href') === `#${route}`) {
                link.classList.add('active');
            }
        });
    } else {
        window.location.hash = `#${defaultView}`;
    }
}

window.addEventListener('hashchange', () => navigate(window.location.hash));
document.addEventListener('DOMContentLoaded', () => navigate(window.location.hash));

// 2.2. BINARY CANVAS EFFECT
(function() {
    const canvas = document.getElementById('binary-canvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');

    const state = {
        W: 0, H: 0, font_size: 14, columns: 0, drops: [],
    };
    
    function initializeCanvas() {
        state.W = window.innerWidth;
        state.H = window.innerHeight;
        canvas.width = state.W;
        canvas.height = state.H;

        state.columns = Math.floor(state.W / state.font_size);
        state.drops = [];
        for (let x = 0; x < state.columns; x++) {
            state.drops[x] = 1;
        }
    }

    function draw() {
        ctx.fillStyle = 'rgba(10, 10, 10, 0.08)';
        ctx.fillRect(0, 0, state.W, state.H);

        ctx.fillStyle = '#008822';
        ctx.font = state.font_size + 'px Roboto Mono';

        for (let i = 0; i < state.drops.length; i++) {
            const text = Math.floor(Math.random() * 2);
            ctx.fillText(text, i * state.font_size, state.drops[i] * state.font_size);

            if (state.drops[i] * state.font_size > state.H && Math.random() > 0.985) {
                state.drops[i] = 0;
            }
            state.drops[i]++;
        }
    }

    initializeCanvas();
    window.addEventListener('resize', initializeCanvas);
    setInterval(draw, 50);
})();

// 2.3. GEMINI API & TTS INTEGRATIONS
const apiKey = ""; // Insert your API Key here
const loadingIndicator = document.getElementById('llm-loading-indicator');

async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            console.warn(`Attempt ${i + 1} failed. Retrying...`);
            throw new Error(`HTTP error! status: ${response.status}`);
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Utility: Base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// Utility: PCM to WAV Blob
function pcmToWav(pcm16, sampleRate = 24000) {
    const numChannels = 1;
    const byteRate = sampleRate * 2;
    const buffer = new ArrayBuffer(44 + pcm16.length * 2);
    const view = new DataView(buffer);

    view.setUint32(0, 0x52494646, false); // RIFF
    view.setUint32(4, 36 + pcm16.length * 2, true);
    view.setUint32(8, 0x57415645, false); // WAVE
    view.setUint32(12, 0x666d7420, false); // fmt
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    view.setUint32(36, 0x64617461, false); // data
    view.setUint32(40, pcm16.length * 2, true);

    for (let i = 0; i < pcm16.length; i++) {
        view.setInt16(44 + i * 2, pcm16[i], true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
}

// Make function available globally for the HTML button
window.textToSpeech = async function(text, button) {
    if(!loadingIndicator) return;
    loadingIndicator.classList.remove('hidden');
    button.disabled = true;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
    
    const payload = {
        contents: [{
            parts: [{ text: `Say this professional summary: ${text}` }]
        }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }
            }
        },
        model: "gemini-2.5-flash-preview-tts"
    };

    try {
        const response = await fetchWithRetry(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        const part = result?.candidates?.[0]?.content?.parts?.[0];
        const audioData = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType;

        if (audioData && mimeType && mimeType.startsWith("audio/L16")) {
            const sampleRateMatch = mimeType.match(/rate=(\d+)/);
            const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000;
            
            const pcmData = base64ToArrayBuffer(audioData);
            const pcm16 = new Int16Array(pcmData);
            const wavBlob = pcmToWav(pcm16, sampleRate);
            const audioUrl = URL.createObjectURL(wavBlob);
            
            const audio = new Audio(audioUrl);
            audio.play();

            audio.onended = () => {
                button.disabled = false;
                button.innerHTML = '<span class="text-base">🔊</span><span>Read Summary</span>';
            };
            button.innerHTML = '<span class="text-base">⏸️</span><span>Playing...</span>';
        } else {
            console.error("TTS generation failed");
            alert('Failed to generate audio. Check console.');
        }
    } catch (error) {
        console.error("TTS Error:", error);
    } finally {
        loadingIndicator.classList.add('hidden');
        if (!button.innerHTML.includes('Playing')) button.disabled = false;
    }
};

// Listen for the specific button click in the DOM
document.addEventListener('click', function(e) {
    if (e.target && e.target.closest('#read-summary-btn')) {
        const btn = e.target.closest('#read-summary-btn');
        const text = document.getElementById('profile-summary-text').innerText;
        window.textToSpeech(text, btn);
    }
});