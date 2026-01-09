import { Chuck } from 'https://cdn.jsdelivr.net/npm/webchuck/+esm';

function getChimeSound(freq, pan) {
    return `
    // Soft FM Chime
    SinOsc car => LPF filter => ADSR env => NRev rev => Pan2 p => dac;
    SinOsc mod => car; 

    // Soften the tone
    ${freq.toFixed(2)} => float f;
    ${pan.toFixed(2)} => float panVal;

    f => car.freq;
    
    // VERY SAFE GAIN (Prevent clipping)
    0.02 => car.gain;

    // Harmonic Ratio (2.0 = Octave) - Much smoother
    f * 2.0 => mod.freq;
    // Modulation Index proportional to freq (Brightness)
    200 => mod.gain;
    2 => car.sync;

    // Cut off piercing highs
    3000 => filter.freq;

    panVal => p.pan;
    0.1 => rev.mix;

    // Longer release for ambience
    (2::ms, 50::ms, 0.1, 1000::ms) => env.set;

    1 => env.keyOn;
    10::ms => now;
    1 => env.keyOff;
    1000::ms => now;
    `;
}

const DISPLAY_TEMPLATE = `
// Soft FM Chime
SinOsc car => LPF filter => ADSR env => NRev rev => Pan2 p => dac;
SinOsc mod => car; 

FREQ => car.freq;
FREQ * 2.0 => mod.freq; // Smooth harmonic

0.02 => car.gain; // Safe volume
3000 => filter.freq; // Cut sharpness

PAN => p.pan;
(2::ms, 50::ms, 0.1, 1000::ms) => env.set;
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
        
        this.virtualPos = 20.0;
        this.velocity = 0.0;
        this.totalBars = 40;
        
        this.params = { friction: 0.95, sensitivity: 1.0 };
        
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
            const val = 1.0 - (e.target.value / 2000.0);
            this.params.friction = val;
        });

        p2.addEventListener('input', (e) => {
            const val = e.target.value / 50.0;
            this.params.sensitivity = val;
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
            
            await this.chuck.runCode(`
                SinOsc s => dac; 0.05 => s.gain; 
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
        const accX = e.acceleration ? e.acceleration.x : 0;
        if (Math.abs(accX) < 0.2) return;
        this.velocity -= accX * (0.05 * this.params.sensitivity);
    }

    loop() {
        // Speed Limit
        const MAX_SPEED = 2.0;
        if (this.velocity > MAX_SPEED) this.velocity = MAX_SPEED;
        if (this.velocity < -MAX_SPEED) this.velocity = -MAX_SPEED;

        this.virtualPos += this.velocity;
        this.velocity *= this.params.friction;
        
        // Boundaries
        if (this.virtualPos < 0) {
            this.virtualPos = 0;
            this.velocity *= -0.5;
        }
        if (this.virtualPos > this.totalBars) {
            this.virtualPos = this.totalBars;
            this.velocity *= -0.5;
        }
        
        const currentIdx = Math.floor(this.virtualPos);
        const prevIdx = Math.floor(this.virtualPos - this.velocity);
        
        // --- ANTI-BURST LOGIC ---
        // Only trigger if we actually crossed a bar AND moving fast enough
        // This prevents "jittering" on the edge of a bar causing machine-gun sounds
        if (currentIdx !== prevIdx) {
            if (Math.abs(this.velocity) > 0.05) {
                this.triggerBar(currentIdx);
                
                // Visual Feedback
                cursorDiv.style.opacity = "1";
                cursorDiv.style.boxShadow = "0 0 20px #fff";
                setTimeout(() => {
                    cursorDiv.style.opacity = "0.5";
                    cursorDiv.style.boxShadow = "0 0 15px #0f0";
                }, 50);
            }
        }

        const pct = (this.virtualPos / this.totalBars) * 100;
        cursorDiv.style.left = pct + "%";
        debugDiv.innerText = "VEL: " + this.velocity.toFixed(2);

        requestAnimationFrame(() => this.loop());
    }
    
    triggerBar(index) {
        if (!this.chuck) return;
        
        // Freq: 1500Hz -> 600Hz (Softer range)
        const t = index / this.totalBars;
        const freq = 1500 * Math.pow(0.4, t);
        const pan = (t * 2.0) - 1.0;
        
        const code = getChimeSound(freq, pan);
        this.chuck.runCode(code);
    }
}

window.onload = () => new App();