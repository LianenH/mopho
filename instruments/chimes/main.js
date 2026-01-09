import { Chuck } from 'https://cdn.jsdelivr.net/npm/webchuck/+esm';

function getChimeSound(freq, pan) {
    return `
    SinOsc car => ADSR env => NRev rev => Pan2 p => dac;
    SinOsc mod => car; 

    ${freq.toFixed(2)} => float f;
    ${pan.toFixed(2)} => float panVal;

    f => car.freq;
    
    // Low Gain to prevent clipping
    0.05 => car.gain;

    f * 3.5 => mod.freq;
    200 => mod.gain;
    2 => car.sync;

    panVal => p.pan;
    0.1 => rev.mix;

    (1::ms, 30::ms, 0.2, 2000::ms) => env.set;

    1 => env.keyOn;
    15::ms => now;
    1 => env.keyOff;
    2000::ms => now;
    `;
}

const DISPLAY_TEMPLATE = `
// FM Chime (Anti-Clipping)
SinOsc car => ADSR env => NRev rev => Pan2 p => dac;
SinOsc mod => car; 

FREQ => car.freq;
FREQ * 3.5 => mod.freq;

// Gain lowered significantly to allow polyphony
0.05 => car.gain;

PAN => p.pan;
(1::ms, 30::ms, 0.2, 2000::ms) => env.set;
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
            // Friction: 0.80 to 0.99
            const val = 1.0 - (e.target.value / 2000.0);
            this.params.friction = val;
        });

        p2.addEventListener('input', (e) => {
            // Sensitivity
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
        // Linear Acceleration X (Left/Right movement)
        // This is physically moving the phone, not tilting
        const accX = e.acceleration ? e.acceleration.x : 0;
        
        // Deadzone to stop drift
        if (Math.abs(accX) < 0.2) return;
        
        // Apply Force (F = ma)
        // Invert X because usually moving right moves content left
        this.velocity -= accX * (0.05 * this.params.sensitivity);
    }

    loop() {
        // Speed Limit (Prevent "Teleporting" through bars)
        const MAX_SPEED = 1.5;
        if (this.velocity > MAX_SPEED) this.velocity = MAX_SPEED;
        if (this.velocity < -MAX_SPEED) this.velocity = -MAX_SPEED;

        this.virtualPos += this.velocity;
        this.velocity *= this.params.friction;
        
        // Boundaries (Bounce)
        if (this.virtualPos < 0) {
            this.virtualPos = 0;
            this.velocity *= -0.5;
        }
        if (this.virtualPos > this.totalBars) {
            this.virtualPos = this.totalBars;
            this.velocity *= -0.5;
        }
        
        // Trigger Logic
        const currentIdx = Math.floor(this.virtualPos);
        const prevIdx = Math.floor(this.virtualPos - this.velocity);
        
        if (currentIdx !== prevIdx) {
            // Only trigger if we moved enough (debounce)
            this.triggerBar(currentIdx);
        }

        // UI Update
        const pct = (this.virtualPos / this.totalBars) * 100;
        cursorDiv.style.left = pct + "%";
        debugDiv.innerText = "VEL: " + this.velocity.toFixed(2);

        requestAnimationFrame(() => this.loop());
    }
    
    triggerBar(index) {
        if (!this.chuck) return;
        
        // Exponential Pitch Mapping
        const t = index / this.totalBars;
        const freq = 2000 * Math.pow(0.25, t);
        const pan = (t * 2.0) - 1.0;
        
        const code = getChimeSound(freq, pan);
        this.chuck.runCode(code);
    }
}

window.onload = () => new App();