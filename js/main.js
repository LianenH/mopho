/* js/main.js - SELF STARTING VERSION */
import { audioEngine } from "./audioEngine.js";
import { visualizer } from "./visuals.js";
// Supabase Config
const SUPABASE_URL = 'https://zglucpcifwibdphnavsa.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnbHVjcGNpZndpYmRwaG5hdnNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg5NzAsImV4cCI6MjA4MDg0NDk3MH0.NLesbKu9M31zKjlux8m6sUQ-3yaE6zvY7W-hv1Li1gk'; 
// Bio Config
const BIO_CONFIG = { BASE_SPEED: 0.02, COUPLING: 0.1, BROADCAST_RATE: 0.5 };
let state = { isReady: false, supabase: null, channel: null, phase: Math.random(), isRunning: false };

// === 1. Test Function (Run this in console to verify sound!) ===
window.testSound = function() {
    console.log("🎵 Testing Sound Engine Direct...");
    audioEngine.triggerNote(440);
};

// === 2. Conductor Function ===
window.conductorFire = function() {
    console.log("🔥 ACTIVATING SWARM (Local + Network)...");
    // 1. Force start local loop immediately (Fix for single device)
    state.isRunning = true; 
    // 2. Play a sound immediately to confirm
    triggerPulse();
    // 3. Send to network
    if (state.channel) {
        state.channel.send({ type: 'broadcast', event: 'swarm_control', payload: { cmd: 'START' } });
    }
};

// === 3. Init Logic ===
if (window.supabase) {
    state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}
const overlay = document.getElementById('overlay');
if (overlay) {
    overlay.addEventListener('click', async () => {
        if (state.isReady) return;
        console.log("🚀 System Init...");
        try {
            // Must resume context on click
            await audioEngine.init();
            // Start instrument
            await audioEngine.updateInstrument({ cutoff: 2000, release: 1500 });
            initNetwork();
            state.isReady = true;
            visualizer.setMode("IDLE");
            overlay.style.display = 'none';
            // Start the loop logic
            requestAnimationFrame(fireflyLoop);
        } catch (e) {
            alert("Init Error: " + e.message);
        }
    });
}

function initNetwork() {
    if (!state.supabase) return;
    state.channel = state.supabase.channel('room-1');
    state.channel
        .on('broadcast', { event: 'swarm_control' }, (payload) => {
            if (payload.cmd === 'START') state.isRunning = true;
        })
        .on('broadcast', { event: 'flash' }, () => {
            if (state.isRunning) state.phase += BIO_CONFIG.COUPLING;
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') console.log("🟢 Connected.");
        });
}

function fireflyLoop() {
    if (state.isRunning) {
        state.phase += BIO_CONFIG.BASE_SPEED;
        if (state.phase >= 1.0) {
            state.phase -= 1.0;
            triggerPulse();
            if (Math.random() < BIO_CONFIG.BROADCAST_RATE && state.channel) {
                state.channel.send({ type: 'broadcast', event: 'flash', payload: {} });
            }
        }
    }
    requestAnimationFrame(fireflyLoop);
}

function triggerPulse() {
    visualizer.flash();
    // Trigger sound
    audioEngine.triggerNote(440);
}