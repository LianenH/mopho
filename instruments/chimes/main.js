import { Chuck } from 'https://cdn.jsdelivr.net/npm/webchuck/+esm';

function getPhysicalChime(freq, pan, velocity) {
    return `
    ModalBar m => Gain g => NRev rev => Pan2 p => dac;

    1 => m.preset;
    
    0.6 => m.stickHardness;
    Math.random2f(0.2, 0.8) => m.strikePosition;
    
    4.0 => g.gain;
    
    ${freq.toFixed(2)} => m.freq;
    ${pan.toFixed(2)} => p.pan;
    
    0.35 => rev.mix;
    
    ${velocity.toFixed(2)} => m.noteOn;
    
    5::second => now;
    `;
}

const DISPLAY_TEMPLATE = `
// Final Polish
ModalBar m => Gain g => NRev rev => Pan2 p => dac;

1 => m.preset; 
0.6 => m.stickHardness; // Softer, no clicking
4.0 => g.gain; // Reduced to prevent clipping

FREQ => m.freq;
VELOCITY => m.noteOn;
0.35 => rev.mix; // Lush reverb

5::second => now;
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
        
        this.virtualPos = 25.0;
        this.velocity = 0.0;
        this.totalBars = 50; 
        
        this.params = { friction: 0.94, sensitivity: 1.2 };
        
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
        
        if (currentIdx !== prevIdx) {
            if (Math.abs(this.velocity) > 0.05) {
                this.triggerBar(currentIdx, Math.abs(this.velocity));
                
                if (Math.random() > 0.6) {
                    const offset = Math.random() > 0.5 ? 1 : -1;
                    const neighbor = currentIdx + offset;
                    if (neighbor >=0 && neighbor < this.totalBars) {
                        setTimeout(() => {
                            this.triggerBar(neighbor, Math.abs(this.velocity) * 0.4);
                        }, Math.random() * 40);
                    }
                }
                
                cursorDiv.style.opacity = "1";
                cursorDiv.style.boxShadow = "0 0 20px #ffd700";
                setTimeout(() => {
                    cursorDiv.style.opacity = "0.5";
                    cursorDiv.style.boxShadow = "none";
                }, 50);
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
        // Wide Range: 3500Hz -> 200Hz
        const freq = 3500 * Math.pow(0.06, t);
        
        const pan = (t * 2.0) - 1.0;
        
        let force = vel;
        if (force > 0.8) force = 0.8;
        if (force < 0.2) force = 0.2; 
        
        const code = getPhysicalChime(freq, pan, force);
        this.chuck.runCode(code);
    }
}

window.onload = () => new App();