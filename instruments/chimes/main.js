import { Chuck } from 'https://cdn.jsdelivr.net/npm/webchuck/+esm';

const CHIMES_CODE = `
global float velocity;

ModalBar bar => Gain g => NRev rev => dac;

1 => bar.preset;
10.0 => g.gain;
0.1 => rev.mix;

function void play(float vel) {
    Math.random2f(800, 2000) => bar.freq;
    
    if (vel < 0.4) 0.4 => vel;
    
    vel => bar.noteOn;
}

while(true) {
    if (velocity > 0.02) {
        play(velocity);
        
        150.0 - (velocity * 120.0) => float delayMs;
        if (delayMs < 50) 50 => delayMs;
        
        Math.random2f(delayMs * 0.8, delayMs * 1.2)::ms => now;
    } else {
        20::ms => now;
    }
}
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
        this.params = { threshold: 0.0, density: 10 };
        
        if (typeof CodeMirror !== 'undefined' && textArea) {
            this.editor = CodeMirror.fromTextArea(textArea, {
                mode: 'text/x-c++src', theme: 'monokai', lineNumbers: true
            });
            this.editor.setValue(CHIMES_CODE);
        } else if (textArea) {
            textArea.value = CHIMES_CODE;
        }
        
        this.bindEvents();
    }

    getCode() {
        if (this.editor) return this.editor.getValue();
        if (textArea) return textArea.value;
        return CHIMES_CODE;
    }

    bindEvents() {
        btn.addEventListener('click', () => {
            if (!this.isReady) this.init();
            else this.reloadCode();
        });
        
        p1.addEventListener('input', (e) => {
            const val = e.target.value / 100.0;
            this.params.threshold = val;
            if (this.chuck) this.chuck.setFloat('paramThreshold', val);
        });

        p2.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.params.density = val;
            if (this.chuck) this.chuck.setFloat('paramDensity', val);
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
            btn.innerText = "UPDATE CODE";
            btn.disabled = false;
            statusDiv.innerText = "ONLINE";
            
            this.reloadCode();

            await this.chuck.runCode(`
                SinOsc s => dac; 0.3 => s.gain; 
                1000 => s.freq; 0.1::second => now; 
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
        const rawAlpha = Math.abs(r.alpha || 0);
        this.sensorData.alpha = rawAlpha;
        
        debugDiv.innerText = "VAL: " + rawAlpha.toFixed(0);
    }

    loop() {
        this.sensorData.smoothedAlpha += (this.sensorData.alpha - this.sensorData.smoothedAlpha) * 0.1;
        
        let normalizedVelocity = this.sensorData.smoothedAlpha / 100.0;
        
        if (normalizedVelocity < 0.05) normalizedVelocity = 0;
        if (normalizedVelocity > 1.0) normalizedVelocity = 1.0;

        if (normalizedVelocity > 0.1) {
            btn.style.backgroundColor = "#222";
            btn.style.color = "#fff";
        } else {
            btn.style.backgroundColor = "#fff";
            btn.style.color = "#000";
        }

        if (this.chuck) {
            this.chuck.setFloat('inputVelocity', normalizedVelocity);
        }

        requestAnimationFrame(() => this.loop());
    }

    async reloadCode() {
        if (!this.chuck) return;
        this.chuck.removeLastShred();
        const code = this.getCode();
        await this.chuck.runCode(code);
        this.chuck.setFloat('paramThreshold', this.params.threshold);
        this.chuck.setFloat('paramDensity', this.params.density);
        statusDiv.innerText = "UPDATED";
    }
}

window.onload = () => new App();