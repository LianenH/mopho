/* js/audioEngine.js */
import { Chuck } from 'https://cdn.jsdelivr.net/npm/webchuck/+esm';
import { synthCompiler } from './dynamicSynth.js'; // 确保这个文件还在

let theChuck;
let currentShredID = null;

export const audioEngine = {
    async init() {
        if (!theChuck) {
            console.log("🎵 Loading WebChucK...");
            theChuck = await Chuck.init([]);
            console.log("🎵 WebChucK Ready.");
        }
    },

    async updateInstrument(config) {
        if (!theChuck) return;
        if (currentShredID) {
            await theChuck.removeShred(currentShredID);
        }
        // 如果 synthCompiler 还没准备好，用个简单的备用
        const code = synthCompiler ? synthCompiler.compile(config) : `
            SinOsc osc => ADSR env => dac;
            0.5 => osc.gain;
            env.set(10::ms, 50::ms, 0.5, 200::ms);
            global float inputPitch;
            global Event noteOn;
            while(true) {
                noteOn => now;
                inputPitch => osc.freq;
                1 => env.keyOn;
                100::ms => now;
                1 => env.keyOff;
                200::ms => now;
            }
        `;
        currentShredID = await theChuck.runCode(code);
    },

    triggerNote(freq) {
        if (theChuck) {
            theChuck.setFloat("inputPitch", freq);
            theChuck.broadcastEvent("noteOn");
        }
    }
};