import { Chuck } from 'https://cdn.jsdelivr.net/npm/webchuck/+esm';

function getMetalSound(freq) {
    return `
    SinOsc car => ADSR env => dac;
    SinOsc mod => blackhole;

    ${freq.toFixed(2)} => float f;
    
    f => car.freq;
    f * 1.414 => mod.freq;
    
    mod => car;
    2 => car.sync;
    
    500 => mod.gain;
    
    0.3 => car.gain;
    
    (1::ms, 150::ms, 0.0, 0::ms) => env.set;
    
    1 => env.keyOn;
    150::ms => now;
    `;
}

const DISPLAY_TEMPLATE = `
// FM Metal Chime Template
SinOsc car => ADSR env => dac;
SinOsc mod => blackhole;

// Frequency injected by JS
FREQ => car.freq;

// Metal ratio (root 2)
FREQ * 1.414 => mod.freq;

// Phase Modulation
mod => car;
2 => car.sync;
`;

const btn = document.getElementById('toggleBtn');
const statusDiv = document.getElementById('status');
const debugDiv = document.getElementById('sensor-debug');
const p1 = document.getElementById('param1');
const p2 = document.getElementById('param2');
const textArea = document.getElementById('codeEditor');

class App {
    constructor() {
        this.chuck = null;
        this.isReady = false;
        
        this.sensorData = { alpha: 0, smoothedAlpha: 0 };
        this.params = { threshold: 0.05, density: 10 };
        this.lastTriggerTime = 0;
        
        this.chimeIndex = 0;
        this.totalChimes = 40;
        
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
            const val = (e.target.value / 100.0) * 0.5;
            this.params.threshold = val;
        });

        p2.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.params.density = val;
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
            btn.disabled = false;
            statusDiv.innerText = "ONLINE";
            
            const testCode = getMetalSound(1000);
            await this.chuck.runCode(testCode);
            
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
        const rawAlpha = Math.abs(r.alpha || 0);
        this.sensorData.alpha = rawAlpha;
        debugDiv.innerText = "VAL: " + rawAlpha.toFixed(0);
    }

    loop() {
        this.sensorData.smoothedAlpha += (this.sensorData.alpha - this.sensorData.smoothedAlpha) * 0.1;
        
        let normalizedVelocity = this.sensorData.smoothedAlpha / 150.0;
        if (normalizedVelocity > 1.0) normalizedVelocity = 1.0;

        if (normalizedVelocity > this.params.threshold) {
            btn.style.backgroundColor = "#333";
            btn.style.color = "#fff";
            
            const now = Date.now();
            let delay = 500 / this.params.density;
            
            delay = delay * (1.0 - (normalizedVelocity * 0.5));
            if (delay < 40) delay = 40;
            
            if (now - this.lastTriggerTime > delay) {
                if (this.chuck) {
                    this.chimeIndex++;
                    if (this.chimeIndex >= this.totalChimes) {
                        this.chimeIndex = 0;
                    }

                    const startFreq = 2500;
                    const endFreq = 600;
                    const step = (startFreq - endFreq) / this.totalChimes;
                    const currentFreq = startFreq - (this.chimeIndex * step);
                    
                    const code = getMetalSound(currentFreq);
                    this.chuck.runCode(code);
                    
                    this.lastTriggerTime = now;
                }
            }

        } else {
            btn.style.backgroundColor = "#fff";
            btn.style.color = "#000";
        }

        requestAnimationFrame(() => this.loop());
    }
}

window.onload = () => new App();