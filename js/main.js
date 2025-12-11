/* js/main.js - CICADA + RIPPLE HYBRID */
import { audioEngine } from "./audioEngine.js";
import { visualizer } from "./visuals.js";

const SUPABASE_URL = 'https://zglucpcifwibdphnavsa.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnbHVjcGNpZndpYmRwaG5hdnNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg5NzAsImV4cCI6MjA4MDg0NDk3MH0.NLesbKu9M31zKjlux8m6sUQ-3yaE6zvY7W-hv1Li1gk'; 

// === 生物钟参数 ===
const BIO = {
    SPEED: 0.008,      // 蝉鸣速度 (越慢越有禅意)
    COUPLING: 0.05,    // 互相影响的程度 (同步速度)
    BROADCAST: 0.4     // 广播概率
};

let state = {
    isReady: false,
    supabase: null,
    channel: null,
    phase: Math.random(), // 每个人的初始相位不同
    isRunning: false
};

// === 1. 初始化 Supabase ===
if (window.supabase) {
    state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// === 2. 启动逻辑 ===
const overlay = document.getElementById('overlay');
if (overlay) {
    overlay.addEventListener('click', async () => {
        if (state.isReady) return;
        
        console.log("🦗 Entering the swarm...");
        try {
            await audioEngine.init();
            await audioEngine.updateInstrument({}); 
            initNetwork();
            
            state.isReady = true;
            state.isRunning = true; // 启动蝉鸣循环
            visualizer.setMode("IDLE");
            overlay.style.display = 'none';

            // 📣 激发事件：告诉大家“我来了”，引发涟漪
            announceArrival();
            // 启动生物钟循环
            requestAnimationFrame(cicadaLoop);
            
        } catch (e) {
            alert("Error: " + e.message);
        }
    });
}

// === 3. 网络与群体智能 ===
function initNetwork() {
    if (!state.supabase) return;
    state.channel = state.supabase.channel('room-1');

    state.channel
        .on('broadcast', { event: 'chirp' }, () => {
            // 🦗 听到别的蝉叫了：调整我的相位 (Kuramoto Coupling)
            // 这会让大家慢慢自动同步
            if (state.isRunning) state.phase += BIO.COUPLING;
        })
        .on('broadcast', { event: 'arrival' }, () => {
            // 🌊 听到有人进来了：触发大涟漪
            triggerRipple();
            // 🔥 关键：强制重置相位，让全场瞬间对齐 (Re-sync)
            state.phase = 0.9; 
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') console.log("🟢 Connected.");
        });
}

// === 4. 蝉鸣循环 (The Cicada Loop) ===
function cicadaLoop() {
    if (state.isRunning) {
        // 自然增长
        state.phase += BIO.SPEED;

        // 阈值检测
        if (state.phase >= 1.0) {
            state.phase -= 1.0;
            
            // 触发一次轻微的背景蝉鸣
            triggerCicada();
            
            // 告诉周围 (概率性广播)
            if (state.channel && Math.random() < BIO.BROADCAST) {
                state.channel.send({ type: 'broadcast', event: 'chirp', payload: {} });
            }
        }
    }
    requestAnimationFrame(cicadaLoop);
}

// === 5. 两种声音形态 ===

// 形态 A: 背景蝉鸣 (轻微、日常、同步)
function triggerCicada() {
    // 视觉：微弱闪烁
    // 声音：较高音，较轻
    // 这里我们用 AudioEngine 触发一个高频音
    audioEngine.triggerNote(600 + Math.random() * 100);
}

// 形态 B: 入场涟漪 (强烈、激发、低沉)
function triggerRipple() {
    console.log("🌊 BIG RIPPLE!");
    // 视觉：强烈呼吸 (由 visuals.js 处理)
    visualizer.flash();
    
    // 声音：宏大的回声，带随机延迟
    // 模拟水波扩散
    const delay = Math.random() * 800; 
    setTimeout(() => {
        // 触发一个更低沉、更有力的根音
        audioEngine.triggerNote(300); 
    }, delay);
}

// 广播我的到来
function announceArrival() {
    setTimeout(() => {
        if (state.channel) {
            state.channel.send({
                type: 'broadcast',
                event: 'arrival',
                payload: {}
            });
            triggerRipple(); // 自己也响
        }
    }, 500);
}