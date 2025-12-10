import { audioEngine } from "./audioEngine.js";
import { acousticLink } from "./acousticLink.js";
import { visualizer } from "./visuals.js";

const { createClient } = window.supabase;

import { audioEngine } from "./audioEngine.js";
import { visualizer } from "./visuals.js";

window.conductorFire = function() {
    console.log("🔥 Command Received: Firing Global Pulse...");
    if(state.channel) {
        state.channel.send({
            type: 'broadcast',
            event: 'pulse',
            payload: { type: 'GLOBAL' }
        });
        console.log("✅ Signal Sent to Supabase");
    } else {
        console.error("❌ Channel not connected. Wait for 'Connected to Hive Mind'.");
    }
};

const SUPABASE_URL = 'https://zglucpcifwibdphnavsa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnbHVjcGNpZndpYmRwaG5hdnNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg5NzAsImV4cCI6MjA4MDg0NDk3MH0.NLesbKu9M31zKjlux8m6sUQ-3yaE6zvY7W-hv1Li1gk';
let state = {
    isReady: false,
    supabase: null,
    channel: null
};

// 检查 Supabase 是否加载
if (!window.supabase) {
    alert("Supabase library failed to load. Check network.");
} else {
    const { createClient } = window.supabase;
    state.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// === 3. 初始化逻辑 ===
document.getElementById('overlay').addEventListener('click', async () => {
    if (state.isReady) return;
    
    console.log("🚀 Initializing System...");
    
    try {
        // A. 启动音频
        await audioEngine.init();
        
        // B. 启动乐器 (默认加载一个)
        await audioEngine.updateInstrument({
            waveform: "SinOsc",
            cutoff: 800,
            release: 200
        });

        // C. 暂时不启动声波通信 (ggwave)
        // await acousticLink.init({...}); 

        // D. 启动网络
        initNetwork();
        
        // E. 界面反馈
        state.isReady = true;
        visualizer.setMode("IDLE");
        document.getElementById('overlay').style.display = 'none';
        
    } catch (e) {
        console.error("Init Error:", e);
        alert("Error: " + e.message);
    }
});

function initNetwork() {
    console.log("📡 Connecting to Network...");
    state.channel = state.supabase.channel('room-1');

    state.channel
        .on('broadcast', { event: 'pulse' }, (payload) => {
            console.log('⚡ Received Signal:', payload);
            triggerPulse("GLOBAL");
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log("🟢 Connected to Hive Mind (Ready to fire)");
            }
        });
}

function triggerPulse(source) {
    console.log("💥 PULSE TRIGGERED by", source);
    visualizer.flash();
    // 触发声音 (随机频率)
    audioEngine.triggerNote(440 + Math.random() * 200);
}