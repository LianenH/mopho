import { Chuck } from 'https://cdn.jsdelivr.net/npm/webchuck/+esm';

// 【关键修改】这里不再用 ModalBar，改用 SinOsc (正弦波)
// 如果这个能响，说明音频没问题，是之前的乐器太复杂了
const DEFAULT_CODE = `
global float inputVelocity;
global float paramThreshold;
global float paramDensity;

// 简单的正弦波 (像救护车的声音)
SinOsc osc => dac;
0.0 => osc.gain; // 初始静音

function void triggerNote(float velocity) {
    // 随机音高
    Math.random2f(440, 880) => osc.freq;
    // 声音瞬间变大
    0.5 => osc.gain;
    // 100ms 后声音消失
    100::ms => now;
    0.0 => osc.gain;
}

while(true) {
    if (inputVelocity > paramThreshold) {
        triggerNote(inputVelocity);
        
        // 简单的延时逻辑
        100::ms => now;
    } else {
        10::ms => now;
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
        this.ui.btn.disabled = true;
        this.ui.status.innerText = "STARTING AUDIO ENGINE...";

        try {
            // 1. 传感器权限
            if (typeof DeviceMotionEvent !== 'undefined' && 
                typeof DeviceMotionEvent.requestPermission === 'function') {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission !== 'granted') throw new Error("Permission denied");
            }

            window.addEventListener('devicemotion', (e) => this.handleMotion(e));
            
            // 2. 初始化 Chuck
            this.chuck = await Chuck.init([]);

            // 【关键修改】强制唤醒 AudioContext
            // 有些浏览器初始化后是 'suspended' (挂起) 状态，必须手动 resume
            if (this.chuck.context && this.chuck.context.state === 'suspended') {
                console.log("Forcing AudioContext resume...");
                await this.chuck.context.resume();
            }
            
            this.isReady = true;
            this.ui.btn.innerText = "UPDATE CODE";
            this.ui.btn.disabled = false;
            this.ui.status.innerText = "SYSTEM ONLINE";
            
            // 3. 运行代码
            this.reloadCode();

            // 4. 【测试声】启动时立刻响一声，证明音频是好的
            // 运行一段一次性的代码
            await this.chuck.runCode(`
                SinOsc s => dac; 
                0.2 => s.gain; 
                880 => s.freq; 
                0.5::second => now;
            `);
            
            this.loop();
        } catch (e) {
            console.error(e);
            this.ui.status.innerText = "ERROR: " + e.message;
            this.ui.btn.disabled = false;
            alert("Error: " + e.message);
        }
    }

    handleMotion(e) {
        const rawAlpha = Math.abs(e.rotationRate.alpha || 0);
        this.sensorData.alpha = rawAlpha;
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
        
        this.ui.status.innerText = "CODE UPDATED";
    }
}

window.onload = () => new App();