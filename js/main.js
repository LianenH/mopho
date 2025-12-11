/* js/main.js - RIPPLE INTERACTION EDITION */
import { audioEngine } from "./audioEngine.js";
import { visualizer } from "./visuals.js";

const SUPABASE_URL = 'https://zglucpcifwibdphnavsa.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnbHVjcGNpZndpYmRwaG5hdnNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg5NzAsImV4cCI6MjA4MDg0NDk3MH0.NLesbKu9M31zKjlux8m6sUQ-3yaE6zvY7W-hv1Li1gk';  

let state = {
    isReady: false,
    supabase: null,
    channel: null
};

// === 1. 初始化 Supabase ===
if (window.supabase) {
    state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// === 2. 点击屏幕：加入网络并触发涟漪 ===
const overlay = document.getElementById('overlay');
if (overlay) {
    overlay.addEventListener('click', async () => {
        if (state.isReady) return;
        
        console.log("🌊 Joining the ocean...");
        
        try {
            await audioEngine.init();
            // 加载一个空灵的声音
            await audioEngine.updateInstrument({}); 
            
            initNetwork();
            
            state.isReady = true;
            visualizer.setMode("IDLE");
            overlay.style.display = 'none';

            // 🔥 核心：我进来了，大喊一声 "HELLO"
            // 这会触发我自己和所有人的涟漪
            announceArrival();
            
        } catch (e) {
            alert("Error: " + e.message);
        }
    });
}

function initNetwork() {
    if (!state.supabase) return;

    state.channel = state.supabase.channel('room-1');

    state.channel
        .on('broadcast', { event: 'arrival' }, (payload) => {
            // 👂 听到有人进来了（或者我自己进来了）
            console.log("💧 Ripple detected!");
            triggerRipple();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log("🟢 Network Connected.");
            }
        });
}

// 广播我的到来
function announceArrival() {
    // 延迟一点点，确保连接建立
    setTimeout(() => {
        if (state.channel) {
            state.channel.send({
                type: 'broadcast',
                event: 'arrival',
                payload: { msg: 'New Device Joined' }
            });
            // 为了保险，我自己先响一声
            triggerRipple();
        }
    }, 500);
}

// 触发涟漪效果
function triggerRipple() {
    // 1. 视觉呼吸
    visualizer.flash();
    
    // 2. 声音：每个人延迟时间不同，形成扩散感
    // 比如 0ms - 1000ms 的随机延迟
    const delay = Math.random() * 1000;
    
    setTimeout(() => {
        // 触发一个随机音高的空灵音符
        audioEngine.triggerNote(400 + Math.random() * 400);
    }, delay);
}