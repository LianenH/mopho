import { Chuck } from 'https://cdn.jsdelivr.net/npm/webchuck/+esm';

const DEFAULT_CODE = `
global float inputVelocity;
global float paramThreshold;
global float paramDensity;

ModalBar chime => Gain g => NRev rev => dac;
1 => chime.preset;
5.0 => g.gain;
0.1 => rev.mix;

function void triggerNote(float velocity) {
    Math.random2f(500, 1500) => chime.freq;
    velocity => chime.noteOn;
}

while(true) {
    if (inputVelocity > paramThreshold) {
        triggerNote(inputVelocity);
        
        float waitTime;
        if (paramDensity > 0) {
            1.0 / paramDensity => waitTime;
        } else {
            0.1 => waitTime;
        }
        
        Math.random2f(waitTime * 0.5, waitTime * 1.5)::second => now;
    } else {
        0.05::second => now;
    }
}
`;

class App {
    constructor() {
        this.chuck = null;
        this.isReady = false;
        this.sensorData = { alpha: 0, smoothedAlpha: 0 };
        this.params = { threshold: 0.0, density: 10 };
        
        this.ui = {
            btn: document.getElementById('toggleBtn'),
            status: document.getElementById('status'),
            debug: document.getElementById('sensor-debug'),
            p1: document.getElementById('param1'),
            p2: document.getElementById('param2'),
            textArea: document.getElementById('codeEditor')
        };
        
        if (typeof CodeMirror !== 'undefined') {
            this.editor = CodeMirror.fromTextArea(this.ui.textArea, {
                mode: 'text/x-c++src',
                theme: 'monokai',
                lineNumbers: true
            });
            this.editor.setValue(DEFAULT_CODE);
        } else {
            this.ui.textArea.value = DEFAULT_CODE;
        }
        
        this.bindEvents();
    }

    getCode() {
        return this.editor ? this.editor.getValue() : this.ui.textArea.value;
    }

    bindEvents() {
        this.ui.btn.addEventListener('click', () => {
            if (!this.isReady) {
                this.init();
            } else {
                this.reloadCode();
            }
        });
        
        this.ui.p1.addEventListener('input', (e) => {
            const val = e.target.value / 100.0;
            this.params.threshold = val;
            if (this.chuck) this.chuck.setFloat('paramThreshold', val);
        });

        this.ui.p2.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.params.density = val;
            if (this.chuck) this.chuck.setFloat('paramDensity', val);
        });

        if (this.editor) {
            this.editor.on('change', () => { if (this.isReady) this.reloadCode(); });
        } else {
            this.ui.textArea.addEventListener('input', () => { if (this.isReady) this.reloadCode(); });
        }
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
        } catch (e) {
            console.error(e);
        }

        window.addEventListener('devicemotion', (e) => this.handleMotion(e));

        this.ui.btn.disabled = true;
        this.ui.status.innerText = "LOADING...";

        try {
            this.chuck = await Chuck.init([]);

            if (this.chuck.context && this.chuck.context.state === 'suspended') {
                await this.chuck.context.resume();
            }
            
            this.isReady = true;
            this.ui.btn.innerText = "UPDATE CODE";
            this.ui.btn.disabled = false;
            this.ui.status.innerText = "ONLINE";
            
            this.reloadCode();
            
            await this.chuck.runCode(`
                SinOsc s => dac; 0.1 => s.gain; 
                880 => s.freq; 0.2::second => now;
            `);
            
            this.loop();
        } catch (e) {
            console.error(e);
            this.ui.status.innerText = "ERROR";
            this.ui.btn.disabled = false;
            alert(e.message);
        }
    }

    handleMotion(e) {
        const rawAlpha = Math.abs(e.rotationRate ? e.rotationRate.alpha : 0);
        this.sensorData.alpha = rawAlpha || 0;
        
        this.ui.debug.innerText = "SENSOR: " + this.sensorData.alpha.toFixed(1);
    }

    loop() {
        this.sensorData.smoothedAlpha += (this.sensorData.alpha - this.sensorData.smoothedAlpha) * 0.1;
        
        let normalizedVelocity = this.sensorData.smoothedAlpha / 300.0;
        if (normalizedVelocity > 1.0) normalizedVelocity = 1.0;

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
        
        this.ui.status.innerText = "UPDATED";
    }
}

window.onload = () => new App();