const DEFAULT_CHUCK_CODE = `
global float inputVelocity;
global float paramThreshold;
global float paramDensity;

ModalBar chime => NRev rev => dac;
1 => chime.preset;
0.1 => rev.mix;

function void triggerNote(float velocity) {
    Math.random2f(2000, 4000) => chime.freq;
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
        this.params = { threshold: 0.1, density: 10 };
        
        this.ui = {
            btn: document.getElementById('toggleBtn'),
            status: document.getElementById('status'),
            p1: document.getElementById('param1'),
            p2: document.getElementById('param2')
        };
        
        this.editor = CodeMirror.fromTextArea(document.getElementById('codeEditor'), {
            mode: 'text/x-c++src',
            theme: 'monokai',
            lineNumbers: true
        });
        
        this.editor.setValue(DEFAULT_CHUCK_CODE);
        this.bindEvents();
    }

    bindEvents() {
        this.ui.btn.addEventListener('click', () => this.init());
        
        this.ui.p1.addEventListener('input', (e) => {
            const val = e.target.value / 100.0; // 0.0 - 1.0
            this.params.threshold = val;
            if (this.chuck) this.chuck.setFloat('paramThreshold', val);
        });

        this.ui.p2.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value); // 1 - 20
            this.params.density = val;
            if (this.chuck) this.chuck.setFloat('paramDensity', val);
        });

        this.editor.on('change', () => {
            if (this.isReady) {
                this.reloadCode();
            }
        });
    }

    async init() {
        if (typeof window.Chuck === 'undefined') {
            alert("err:missing the core");
            this.ui.status.innerText = "SYSTEM: LOAD FAILED";
            this.ui.btn.disabled = false;
            return;
        }
        if (this.isReady) {
            this.reloadCode();
            return;
        }

        try {
            this.ui.status.innerText = "SYSTEM: INITIALIZING...";
            this.ui.btn.disabled = true;
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                const state = await DeviceMotionEvent.requestPermission();
                if (state !== 'granted') {
                    alert("err:refusepermission");
                    this.ui.btn.disabled = false;
                    return;
                }
            }
            window.addEventListener('devicemotion', (e) => this.handleMotion(e));
            this.chuck = await window.Chuck.init([]);
            
            this.isReady = true;
            this.ui.btn.innerText = "UPDATE CODE";
            this.ui.btn.disabled = false;
            this.ui.status.innerText = "SYSTEM: ONLINE";
            
            this.reloadCode();
            this.loop();
            alert("success！");

        } catch (err) {
            alert("err:\n" + err.message);
            this.ui.status.innerText = "SYSTEM: ERROR";
            this.ui.btn.disabled = false;
            console.error(err);
        }
    }

    handleMotion(e) {
        const rawAlpha = Math.abs(e.rotationRate.alpha || 0);
        this.sensorData.alpha = rawAlpha;
    }

    loop() {
        this.sensorData.smoothedAlpha += (this.sensorData.alpha - this.sensorData.smoothedAlpha) * 0.1;
        
        // Normalize (Assuming max rotation speed ~300 deg/s)
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
        
        const code = this.editor.getValue();
        await this.chuck.runCode(code);
        
        // Sync params immediately after reload
        this.chuck.setFloat('paramThreshold', this.params.threshold);
        this.chuck.setFloat('paramDensity', this.params.density);
        
        this.ui.status.innerText = "SYSTEM: CODE UPDATED";
    }
}

window.onload = () => new App();