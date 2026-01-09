import { Chuck } from 'https://cdn.jsdelivr.net/npm/webchuck/+esm';

function getPhysicalChime(freq, pan, velocity) {
    return `
    ModalBar m => Pan2 p => dac;

    1 => m.preset;
    0.4 => m.stickHardness; 
    
    0.15 => m.gain;
    
    ${freq.toFixed(2)} => m.freq;
    ${pan.toFixed(2)} => p.pan;
    
    ${velocity.toFixed(2)} => m.noteOn;
    
    2500::ms => now;
    `;
}

const DISPLAY_TEMPLATE = `
// Optimized ModalBar (No Reverb)
ModalBar m => Pan2 p => dac;

1 => m.preset; 
0.4 => m.stickHardness;

// Low gain for safety
0.15 => m.gain; 

FREQ => m.freq;
VELOCITY => m.noteOn;

// Shorter decay to save CPU
2500::ms => now;
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
        this.totalBars = 50; 
        
        this.params = { friction: 0.94, sensitivity: 1.2 };
        this.lastTriggerTime = 0;
        
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
        const accX = e.acceleration ? e.acceleration.x : 0;
        if (Math.abs(accX) < 0.15) return;
        this.velocity -= accX * (0.05 * this.params.sensitivity);
    }

    loop() {
        const MAX_SPEED = 2.0;
        if (this.velocity > MAX_SPEED) this.velocity = MAX_SPEED;
        if (this.velocity < -MAX_SPEED) this.velocity = -MAX_SPEED;

        this.virtualPos += this.velocity;
        this.velocity *= this.params.friction;
        
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
        const now = Date.now();
        
        if (currentIdx !== prevIdx) {
            if (Math.abs(this.velocity) > 0.05) {
                // Throttle to prevent CPU explosion (Max 20 notes/sec)
                if (now - this.lastTriggerTime > 50) {
                    this.triggerBar(currentIdx, Math.abs(this.velocity));
                    this.lastTriggerTime = now;
                    
                    cursorDiv.style.opacity = "1";
                    cursorDiv.style.boxShadow = "0 0 20px #0ff";
                    setTimeout(() => {
                        cursorDiv.style.opacity = "0.5";
                        cursorDiv.style.boxShadow = "none";
                    }, 50);
                }
            }
        }

        const pct = (this.virtualPos / this.totalBars) * 100;
        cursorDiv.style.left = pct + "%";
        debugDiv.innerText = "VEL: " + this.velocity.toFixed(2);

        requestAnimationFrame(() => this.loop());
    }
    
    triggerBar(index, vel) {
        if (!this.chuck) return;
        
        const t = index / this.totalBars;
        const freq = 3000 * Math.pow(0.1, t); // 3000Hz -> 300Hz
        const pan = (t * 2.0) - 1.0;
        
        let force = vel;
        if (force > 0.8) force = 0.8;
        if (force < 0.3) force = 0.3; 
        
        const code = getPhysicalChime(freq, pan, force);
        this.chuck.runCode(code);
    }
}

window.onload = () => new App();