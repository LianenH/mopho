import { Chuck } from 'https://cdn.jsdelivr.net/npm/webchuck/+esm';

let theChuck;

const chuckCode = `
SinOsc mod => SinOsc car => ADSR env => NRev rev => dac;

2 => car.sync;
440.0 => float baseFreq;
1.0 => float ratio;
200.0 => float index;

0.1 => rev.mix;
env.set(5::ms, 10::ms, 0.0, 0::ms);

global float inputFreq;
global Event trigger;

function void soundLoop() {
    while(true) {
        inputFreq => baseFreq;
        baseFreq => car.freq;
        baseFreq * ratio => mod.freq;
        index => mod.gain;

        trigger => now;

        Math.random2f(0.99, 1.01) * baseFreq => car.freq;
        1 => env.keyOn;
        50::ms => now;
        1 => env.keyOff;
    }
}
spork ~ soundLoop();
while(true) { 1::second => now; }
`;

export const audioEngine = {
    async init() {
        theChuck = await Chuck.init([]);
        await theChuck.runCode(chuckCode);
        theChuck.setFloat("inputFreq", 440);
    },

    updatePitch(freq) {
        if(theChuck) theChuck.setFloat("inputFreq", freq);
    },

    triggerSound() {
        if(theChuck) theChuck.broadcastEvent("trigger");
    }
};
