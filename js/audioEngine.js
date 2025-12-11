/* js/audioEngine.js - ETHEREAL FM EDITION */
import { Chuck } from 'https://cdn.jsdelivr.net/npm/webchuck/+esm';

let theChuck;
let currentShredID = null;

export const audioEngine = {
    async init() {
        if (!theChuck) {
            console.log("Loading WebChucK...");
            theChuck = await Chuck.init([]);
            console.log("WebChucK Ready.");
        }
    },

    async updateInstrument(config) {
        if (!theChuck) return;
        if (currentShredID) await theChuck.removeShred(currentShredID);

        // === 🎵 声音设计的核心代码 ===
        const code = `
            // 1. 信号链 (Signal Chain)
            // 调制器 -> 载波器 -> 滤波器 -> 包络 -> 混响 -> 延迟 -> 输出
            SinOsc mod => SinOsc car => LPF filt => ADSR env => NRev rev => Echo echo => dac;

            // 2. FM 核心参数 (制造玻璃/钟声质感)
            2 => car.sync; // FM 模式
            1.414 => float ratio; // 非整数比率产生金属泛音
            300.0 => float modIndex; // 调制深度

            // 3. 效果器设置 (制造空间感)
            0.15 => rev.mix;   // 混响量 (15% 湿声)
            0.2 => echo.mix;   // 延迟量
            0.5::second => echo.max => echo.delay; // 500ms 延迟
            0.3 => echo.feedback; 

            // 4. 包络设置 (短促的敲击，悠长的余音)
            env.set(5::ms, 80::ms, 0.3, 1500::ms); // 1.5秒的释放时间
            
            // 5. 滤波器 (让声音不刺耳)
            2000.0 => filt.freq;

            // 6. 五声调式音阶 (C Minor Pentatonic)
            // 无论随机选哪个，合在一起都是好听的和弦
            [261.6, 311.1, 349.2, 392.0, 466.2, 523.2, 622.3, 698.5, 784.0] @=> float scale[];

            // 全局变量
            global float inputPitch; // 依然保留，虽然我们主要用自动选音
            global Event noteOn;

            while(true) {
                // 等待触发
                noteOn => now;

                // === 关键：从音阶中随机选一个音 ===
                Math.random2(0, scale.size()-1) => int idx;
                scale[idx] => float targetFreq;
                
                // 设置频率
                targetFreq => car.freq;
                targetFreq * ratio => mod.freq;
                modIndex => mod.gain;

                // 随机化一点力度
                Math.random2f(0.4, 0.6) => car.gain;

                // 触发声音
                1 => env.keyOn;
                
                // 保持一瞬间
                50::ms => now;
                1 => env.keyOff;

                // 最小间隔，防止由于网络延迟导致的连击
                100::ms => now;
            }
        `;

        currentShredID = await theChuck.runCode(code);
    },

    // 触发函数
    triggerNote(freq) {
        if (theChuck) {
            // 注意：虽然这里传了 freq，但 ChucK 代码里我们会忽略它
            // 转而使用内部的“五声调式”随机选音，以保证好听
            // 这样无论谁加入，都是和谐的。
            theChuck.broadcastEvent("noteOn");
        }
    }
};