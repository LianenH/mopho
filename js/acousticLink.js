let ggwave = null;
let context = null;
let parameters = null;
let instance = null;

export const acousticLink = {
    async init({ onPacketReceived }) {
        if (!window.ggwave) return;

        ggwave = window.ggwave;
        parameters = ggwave.getDefaultParameters();
        parameters.sampleRateInp = 48000;
        parameters.sampleRateOut = 48000;

        instance = ggwave.init(parameters);

        context = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });

        await context.audioWorklet.addModule('https://cdn.jsdelivr.net/npm/ggwave@0.0.3/ggwave-processor.js');

        const node = new AudioWorkletNode(context, 'ggwave-processor', {
            processorOptions: {
                txDataLength: 64,
                rxDataLength: 64
            }
        });

        node.port.onmessage = (event) => {
            if (event.data.data) {
                const res = ggwave.decode(instance, event.data.data);
                if (res) {
                    onPacketReceived(res);
                }
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = context.createMediaStreamSource(stream);
        source.connect(node);
    },

    transmit(message) {
        if (!instance || !context) return;

        const data = ggwave.encode(instance, message, 10, 10);

        const buffer = context.createBuffer(1, data.length, context.sampleRate);
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            channel[i] = data[i];
        }

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start();
    }
};
