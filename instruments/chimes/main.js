import { Chuck } from 'https://cdn.jsdelivr.net/npm/webchuck/+esm';

function getMetalSound(freq) {
    return `
    SinOsc fund => ADSR env => NRev rev => dac;
    SinOsc over => env;
    
    env => Delay d => d => rev;

    ${freq.toFixed(2)} => float f;
    
    f => fund.freq;
    f * 2.76 => over.freq;
    
    0.4 => fund.gain;
    0.1 => over.gain;
    
    0.2 => rev.mix;
    
    120::ms => d.max => d.delay;
    0.6 => d.gain;
    
    (2::ms, 200::ms, 0.0, 0::ms) => env.set;
    
    1 => env.keyOn;
    200::ms => now;
    `;
}

const DISPLAY_TEMPLATE = `
// Metal Chime Generator
SinOsc fund => ADSR env => NRev rev => dac;
SinOsc over => env; // Overtone
env => Delay d => d => rev; // Sparkle

FREQ => fund.freq;
FREQ * 2.76 => over.freq; // 2.76 is physical bar ratio

0.2 => rev.mix;
120::ms => d.delay;
0.6 => d.gain;
`;

const btn = document.getElementById('toggleBtn');
const statusDiv = document.getElementById('status');
const debugDiv = document.getElementById('sensor-debug');
const dirDiv = document.getElementById('direction-debug');
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
        
        this.chimeIndex = 20;
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
            
            await this.chuck.runCode(getMetalSound(1000));
            
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
        const alpha = r.alpha || 0;
        this.sensorData.alpha = alpha;
        
        debugDiv.innerText = "SPD: " + Math.abs(alpha).toFixed(0);
    }

    loop() {
        this.sensorData.smoothedAlpha += (this.sensorData.alpha - this.sensorData.smoothedAlpha) * 0.1;
        
        const velocity = Math.abs(this.sensorData.smoothedAlpha);
        const direction = Math.sign(this.sensorData.smoothedAlpha);
        
        let normalizedVelocity = velocity / 150.0;
        if (normalizedVelocity > 1.0) normalizedVelocity = 1.0;

        if (direction > 0) dirDiv.innerText = "DIR: >>>";
        else dirDiv.innerText = "DIR: <<<";

        if (normalizedVelocity > this.params.threshold) {
            btn.style.backgroundColor = "#333";
            btn.style.color = "#fff";
            
            const now = Date.now();
            let delay = 500 / this.params.density;
            
            delay = delay * (1.0 - (normalizedVelocity * 0.5));
            if (delay < 40) delay = 40;
            
            if (now - this.lastTriggerTime > delay) {
                if (this.chuck) {
                    if (direction > 0) {
                        this.chimeIndex++;
                    } else {
                        this.chimeIndex--;
                    }

                    if (this.chimeIndex < 0) this.chimeIndex = 0;
                    if (this.chimeIndex >= this.totalChimes) this.chimeIndex = this.totalChimes - 1;

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