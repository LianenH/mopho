import { Chuck } from 'https://cdn.jsdelivr.net/npm/webchuck/+esm';

function getChimeSound(freq, pan, reverbAmount) {
    return `
    SinOsc car => ADSR env => NRev rev => Pan2 p => dac;
    SinOsc mod => car; // FM Synthesis

    // Parameters
    ${freq.toFixed(2)} => float f;
    ${pan.toFixed(2)} => float panVal;
    ${reverbAmount.toFixed(2)} => float revMix;

    // Carrier
    f => car.freq;
    0.3 => car.gain;

    // Modulator (The metal texture)
    // Ratio 3.5 creates bell-like inharmonic partials
    f * 3.5 => mod.freq;
    200 => mod.gain;
    2 => car.sync; // FM Sync

    // Panning (Low notes left, High notes right)
    panVal => p.pan;

    // Reverb
    revMix => rev.mix;

    // Envelope (Sharp attack, long release)
    (1::ms, 20::ms, 0.4, 3000::ms) => env.set;

    1 => env.keyOn;
    10::ms => now;
    1 => env.keyOff;
    3000::ms => now;
    `;
}

const DISPLAY_TEMPLATE = `
// FM Metal Chime (Polyphonic)
SinOsc car => ADSR env => NRev rev => Pan2 p => dac;
SinOsc mod => car; 

FREQ => car.freq;
FREQ * 3.5 => mod.freq; // Inharmonic Ratio

PAN => p.pan;
REVERB => rev.mix;

(1::ms, 20::ms, 0.4, 3000::ms) => env.set;
`;

const btn = document.getElementById('toggleBtn');
const statusDiv = document.getElementById('status');
const debugDiv = document.getElementById('debug-info');
const cursorDiv = document.getElementById('visual-cursor');
const p1 = document.getElementById('param1');
const p2 = document.getElementById('param2');
const textArea = document.getElementById('codeEditor');

class App {
    constructor() {
        this.chuck = null;
        this.isReady = false;
        
        // Physics State
        this.virtualPos = 20.0; // 0 to 40
        this.velocity = 0.0;
        this.totalBars = 40;
        
        this.params = { friction: 0.9, reverb: 0.5 };
        
        if (typeof CodeMirror !== 'undefined' && textArea) {
            this.editor = CodeMirror.fromTextArea(textArea, {
                mode: 'text/x-c++src', theme: 'monokai', lineNumbers: true
            });
            this.editor.setValue(DISPLAY_TEMPLATE);
        } else if (textArea) {
            textArea.value = DISPLAY_TEMPLATE;
        }
        
        this.bindEvents();
    }

    bindEvents() {
        btn.addEventListener('click', () => {
            this.init();
        });
        
        p1.addEventListener('input', (e) => {
            // Friction/Drag: Lower value = more slippery
            // Map 1-100 to 0.8 - 0.99
            const val = 1.0 - (e.target.value / 1000.0);
            this.params.friction = val;
        });

        p2.addEventListener('input', (e) => {
            const val = e.target.value / 100.0;
            this.params.reverb = val;
        });
    }

    async init() {
        try {
            if (typeof DeviceMotionEvent !== 'undefined' && 
                typeof DeviceMotionEvent.requestPermission === 'function') {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission !== 'granted') {
                    alert("Permission Denied");
                    return;
                }
            }
        } catch (e) { console.error(e); }

        window.addEventListener('devicemotion', (e) => this.handleMotion(e));

        btn.disabled = true;
        statusDiv.innerText = "LOADING...";

        try {
            this.chuck = await Chuck.init([]);
            
            if (this.chuck.context && this.chuck.context.state === 'suspended') {
                await this.chuck.context.resume();
            }

            this.isReady = true;
            btn.innerText = "RUNNING";
            btn.style.background = "#fff";
            btn.disabled = false;
            statusDiv.innerText = "ONLINE";
            
            // Warm up
            await this.chuck.runCode(`
                SinOsc s => dac; 0.1 => s.gain; 
                880 => s.freq; 0.1::second => now; 
                0.0 => s.gain;
            `);
            
            this.loop();
        } catch (e) {
            console.error(e);
            statusDiv.innerText = "ERROR";
            btn.disabled = false;
            alert(e.message);
        }
    }

    handleMotion(e) {
        const r = e.rotationRate || {};
        // Use alpha (Z-axis rotation) for horizontal swiping
        const inputForce = r.alpha || 0;
        
        // Apply physics impulse
        // Sensitivity scaling
        this.velocity += inputForce * 0.005; 
    }

    loop() {
        // 1. Apply Physics (Inertia & Friction)
        this.virtualPos += this.velocity;
        this.velocity *= this.params.friction; // Drag
        
        // 2. Boundary Bounce (Keep cursor inside 0-40)
        if (this.virtualPos < 0) {
            this.virtualPos = 0;
            this.velocity *= -0.5; // Bounce
        }
        if (this.virtualPos > this.totalBars) {
            this.virtualPos = this.totalBars;
            this.velocity *= -0.5; // Bounce
        }
        
        // 3. Collision Detection
        // Did we cross an integer boundary?
        const currentIdx = Math.floor(this.virtualPos);
        const prevIdx = Math.floor(this.virtualPos - this.velocity);
        
        if (currentIdx !== prevIdx) {
            // We crossed a bar! Trigger sound.
            // Determine range of bars crossed (for very fast swipes)
            const start = Math.min(prevIdx, currentIdx);
            const end = Math.max(prevIdx, currentIdx);
            
            // Limit chords to prevent CPU overload on crazy swipes
            const count = end - start;
            if (count < 5) {
                // Trigger the specific bar(s)
                this.triggerBar(currentIdx);
            }
        }

        // 4. Visual Update
        const pct = (this.virtualPos / this.totalBars) * 100;
        cursorDiv.style.left = pct + "%";
        debugDiv.innerText = "BAR: " + currentIdx;

        requestAnimationFrame(() => this.loop());
    }
    
    triggerBar(index) {
        if (!this.chuck) return;
        
        // Map index (0-40) to Frequency (Exponential Curve)
        // High -> Low or Low -> High
        // Real chimes usually go High (short) to Low (long)
        
        // Start: 2000Hz, End: 400Hz
        // Exponential mapping looks more natural
        const t = index / this.totalBars;
        const freq = 2000 * Math.pow(0.2, t);
        
        // Stereo Panning
        // 0 -> -1.0 (Left), 40 -> 1.0 (Right)
        const pan = (t * 2.0) - 1.0;
        
        // Trigger
        const code = getChimeSound(freq, pan, this.params.reverb);
        this.chuck.runCode(code);
        
        // Visual Flash
        document.body.style.backgroundColor = "#111";
        setTimeout(() => document.body.style.backgroundColor = "#050505", 20);
    }
}

window.onload = () => new App();