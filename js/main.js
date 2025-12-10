/* main.js - Serverless Edition */
// 引入 Supabase (从 CDN)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
import { audioEngine } from "./audioEngine.js";
import { acousticLink } from "./acousticLink.js";
import { visualizer } from "./visuals.js";

// === 🔴 这里填你刚刚复制的 Supabase 信息 ===
const SUPABASE_URL = 'https://zglucpcifwibdphnavsa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnbHVjcGNpZndpYmRwaG5hdnNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg5NzAsImV4cCI6MjA4MDg0NDk3MH0.NLesbKu9M31zKjlux8m6sUQ-3yaE6zvY7W-hv1Li1gk';
// ==========================================

const CONFIG = {
    DEAFNESS_DURATION: 500
};

let state = {
    isReady: false,
    isDeaf: false,
    supabase: null,
    channel: null
};

// 初始化 Supabase
state.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('overlay').addEventListener('click', async () => {
    if (state.isReady) return;
    
    try {
        console.log("Initializing Bio-System...");
        await audioEngine.init();
        await acousticLink.init({
            onPacketReceived: handleNearbySignal
        });
        
        // 启动网络连接
        initNetwork();
        
        state.isReady = true;
        visualizer.setMode("IDLE");
        document.getElementById('overlay').style.display = 'none';
        
        window.addEventListener('deviceorientation', handleMotion);
    } catch (e) {
        console.error(e);
        alert("Init Failed. Check Console.");
    }
});

function initNetwork() {
    // 订阅一个叫 'orchestra' 的公共频道
    state.channel = state.supabase.channel('room-1');

    state.channel
        .on('broadcast', { event: 'pulse' }, (payload) => {
            // 收到别人的广播
            console.log('Received broadcast:', payload);
            if (payload.type === 'GLOBAL') {
                triggerPulse("GLOBAL");
            }
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log("Connected to Hive Mind (Supabase)");
            }
        });
}

// 模拟指挥官功能 (你可以做个隐藏按钮来触发这个)
// 在控制台输入: window.conductorFire() 即可全场同步
window.conductorFire = () => {
    if(state.channel) {
        state.channel.send({
            type: 'broadcast',
            event: 'pulse',
            payload: { type: 'GLOBAL' }
        });
    }
};

function handleNearbySignal(data) {
    if (state.isDeaf || !state.isReady) return;
    triggerPulse("LOCAL");
}

function handleMotion(event) {
    if (!state.isReady) return;
    const pitch = 200 + Math.abs(event.beta) * 5; 
    audioEngine.updatePitch(pitch);
}

function triggerPulse(source) {
    visualizer.flash();
    audioEngine.triggerSound();
    
    // 如果是近场触发，也通过声音广播出去
    if (source === "GLOBAL" || source === "LOCAL") {
        acousticLink.transmit("P");
    }

    state.isDeaf = true;
    setTimeout(() => {
        state.isDeaf = false;
    }, CONFIG.DEAFNESS_DURATION);
}