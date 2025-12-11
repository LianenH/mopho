/* js/audioEngine.js - FIXED VERSION */
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
        // ChucK Code: FM Synthesis with Pentatonic Scale
        const code = `
            SinOsc mod => SinOsc car => LPF filt => ADSR env => NRev rev => Echo echo => dac;
            2 => car.sync;
            1.414 => float ratio;
            300.0 => float modIndex;
            0.15 => rev.mix;
            0.2 => echo.mix;
            0.5::second => echo.max => echo.delay;
            env.set(5::ms, 80::ms, 0.3, 1500::ms);
            2000.0 => filt.freq;
            [261.6, 311.1, 349.2, 392.0, 466.2, 523.2, 622.3, 698.5, 784.0] @=> float scale[];
            global float inputPitch;
            global Event noteOn;
            while(true) {
                noteOn => now;
                Math.random2(0, scale.size()-1) => int idx;
                scale[idx] => float targetFreq;
                targetFreq => car.freq;
                targetFreq * ratio => mod.freq;
                modIndex => mod.gain;
                Math.random2f(0.4, 0.6) => car.gain;
                1 => env.keyOn;
                50::ms => now;
                1 => env.keyOff;
                100::ms => now;
            }
        `;
        currentShredID = await theChuck.runCode(code);
    },
    triggerNote(freq) {
        if (theChuck) theChuck.broadcastEvent("noteOn");
    }
};