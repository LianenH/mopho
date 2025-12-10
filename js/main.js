/* js/main.js - FINAL CLEAN VERSION */
import { audioEngine } from "./audioEngine.js";
import { visualizer } from "./visuals.js";
// import { acousticLink } from "./acousticLink.js"; // 暂时注释掉，防止报错

// === 1. 必须放在最前面：定义全局调试函数 ===
// 只有这样，控制台才能找到 window.conductorFire
window.conductorFire = function() {
    console.log("🔥 Command Triggered: GLOBAL PULSE");
    if(state && state.channel) {
        state.channel.send({
            type: 'broadcast',
            event: 'pulse',
            payload: { type: 'GLOBAL' }
        });
        console.log("✅ Signal sent to Supabase!");
    } else {
        console.error("❌ Network not ready. Click the screen first.");
    }
};

// === 2. Supabase 配置 (请填入你的 Key) ===
const SUPABASE_URL = 'https://zglucpcifwibdphnavsa.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnbHVjcGNpZndpYmRwaG5hdnNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg5NzAsImV4cCI6MjA4MDg0NDk3MH0.NLesbKu9M31zKjlux8m6sUQ-3yaE6zvY7W-hv1Li1gk'; 

let state = {
    isReady: false,
    supabase: null,
    channel: null
};

// === 3. 初始化 Supabase ===
// 我们已经在 index.html 用 script 标签加载了，所以这里直接用 window.supabase
if (window.supabase) {
    const { createClient } = window.supabase;
    state.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    console.error("Supabase library missing! Check index.html");
}

// === 4. 主逻辑：点击屏幕启动 ===
const overlay = document.getElementById('overlay');
if (overlay) {
    overlay.addEventListener('click', async () => {
        if (state.isReady) return;
        
        console.log("🚀 System Starting...");
        
        try {
            // A. 启动音频
            await audioEngine.init();
            
            // B. 启动默认乐器
            await audioEngine.updateInstrument({
                waveform: "SinOsc",
                cutoff: 800,
                release: 200
            });
            
            // C. 连接网络
            initNetwork();
            
            // D. 视觉反馈
            state.isReady = true;
            visualizer.setMode("IDLE");
            overlay.style.display = 'none';
            
        } catch (e) {
            console.error("Init Failed:", e);
            alert("启动失败，请检查控制台: " + e.message);
        }
    });
}

// === 5. 网络连接逻辑 ===
function initNetwork() {
    if (!state.supabase) return;

    console.log("📡 Connecting to channel...");
    state.channel = state.supabase.channel('room-1');

    state.channel
        .on('broadcast', { event: 'pulse' }, (payload) => {
            console.log('⚡ Received:', payload);
            triggerPulse("GLOBAL");
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log("🟢 Connected to Hive Mind. Ready.");
            }
        });
}

// === 6. 触发反馈 ===
function triggerPulse(source) {
    visualizer.flash();
    // 播放一个随机音高，证明声音引擎工作
    audioEngine.triggerNote(440 + Math.random() * 200);
}