import { Chuck } from 'https://cdn.jsdelivr.net/npm/webchuck/+esm';

const CHIMES_CODE = `
global float impact;
global Event fire;

// 使用 ADSR 包络，确保声音清晰响亮
SinOsc osc => ADSR env => NRev rev => dac;

0.5 => osc.gain;
0.1 => rev.mix;

// ADSR 设置: 瞬间起音，短衰减
(1::ms, 80::ms, 0.0, 0::ms) => env.set;

while(true) {
    // 1. 死等 JS 发送 "fire" 事件
    // 这样就避开了变量同步失败的问题
    fire => now;
    
    // 2. 收到指令，立刻发声
    Math.random2f(880, 1760) => osc.freq;
    1 => env.keyOn;
    
    // 3. 强制冷却一小会儿，防止爆音
    10::ms => now;
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
        this.params = { threshold: 0.05, density: 10 };
        
        // JS 端的计时器，用来控制发声频率
        this.lastTriggerTime = 0; 
        
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
            btn.innerText = "UPDATE CODE";
            btn.disabled = false;
            statusDiv.innerText = "ONLINE";
            
            this.reloadCode();

            // 测试音
            await this.chuck.runCode(`
                SinOsc s => dac; 0.2 => s.gain; 
                1000 => s.freq; 0.2::second => now; 
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
        
        let normalizedVelocity = this.sensorData.smoothedAlpha / 150.0;
        if (normalizedVelocity > 1.0) normalizedVelocity = 1.0;

        // UI 闪烁逻辑
        if (normalizedVelocity > this.params.threshold) {
            btn.style.backgroundColor = "#333";
            btn.style.color = "#fff";
            
            // --- JS 触发逻辑 ---
            // 我们在 JS 里计算“什么时候该响”
            // 这样就不用依赖 ChucK 的 float 同步了
            
            const now = Date.now();
            
            // 计算需要的间隔时间 (ms)
            // 密度 10 -> 间隔 50ms
            // 密度 1 -> 间隔 500ms
            // 速度越快 -> 间隔越短
            let baseDelay = 500 / this.params.density;
            let dynamicDelay = baseDelay * (1.0 - (normalizedVelocity * 0.5));
            if (dynamicDelay < 40) dynamicDelay = 40;
            
            // 随机化一点点
            dynamicDelay *= (0.8 + Math.random() * 0.4);

            if (now - this.lastTriggerTime > dynamicDelay) {
                if (this.chuck) {
                    // 1. 传力度
                    this.chuck.setFloat('impact', normalizedVelocity);
                    // 2. 这一句是关键：直接命令 ChucK 发声
                    this.chuck.broadcastEvent('fire');
                    this.lastTriggerTime = now;
                }
            }

        } else {
            btn.style.backgroundColor = "#fff";
            btn.style.color = "#000";
        }

        requestAnimationFrame(() => this.loop());
    }

    async reloadCode() {
        if (!this.chuck) return;
        this.chuck.removeLastShred();
        const code = this.getCode();
        await this.chuck.runCode(code);
        statusDiv.innerText = "UPDATED";
    }
}

window.onload = () => new App();