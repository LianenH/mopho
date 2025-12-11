/* js/main.js - FIREFLY SYNC EDITION */
import { audioEngine } from "./audioEngine.js";
import { visualizer } from "./visuals.js";

const SUPABASE_URL = 'https://zglucpcifwibdphnavsa.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnbHVjcGNpZndpYmRwaG5hdnNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg5NzAsImV4cCI6MjA4MDg0NDk3MH0.NLesbKu9M31zKjlux8m6sUQ-3yaE6zvY7W-hv1Li1gk'; 

// === 生物钟参数 ===
const BIO_CONFIG = {
    BASE_SPEED: 0.015,   // 基础心跳速度 (约1秒一次)
    COUPLING: 0.1,       // 耦合强度 (受到别人影响的程度)
    BROADCAST_RATE: 0.3  // 广播概率 (防止网络拥堵，30%的几率告诉别人我亮了)
};

let state = {
    isReady: false,
    supabase: null,
    channel: null,
    // 生物钟状态
    phase: Math.random(), // 0.0 到 1.0 (随机初始相位)
    isRunning: false
};

// === 1. 定义全局调试/指挥函数 ===
window.conductorFire = function() {
    console.log("🔥 ACTIVATING SWARM...");
    if (state.channel) {
        // 指挥官发送 "START_SWARM" 指令，所有人开始循环
        state.channel.send({
            type: 'broadcast',
            event: 'swarm_control',
            payload: { cmd: 'START' }
        });
    }
};

// === 2. 初始化 Supabase ===
if (window.supabase) {
    const { createClient } = window.supabase;
    state.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// === 3. 界面点击启动 ===
const overlay = document.getElementById('overlay');
if (overlay) {
    overlay.addEventListener('click', async () => {
        if (state.isReady) return;
        
        try {
            await audioEngine.init();
            // 预加载一个好听的音色
            await audioEngine.updateInstrument({ cutoff: 2000, release: 1500 });
            
            initNetwork();
            
            state.isReady = true;
            visualizer.setMode("IDLE");
            overlay.style.display = 'none';
            
            // 启动本地生物钟循环 (但先不发声，等指挥官指令)
            requestAnimationFrame(fireflyLoop);
            
        } catch (e) {
            alert("Error: " + e.message);
        }
    });
}

// === 4. 网络连接与同步逻辑 ===
function initNetwork() {
    if (!state.supabase) return;

    state.channel = state.supabase.channel('room-1');

    state.channel
        .on('broadcast', { event: 'swarm_control' }, (payload) => {
            // 接收指挥官的宏观指令
            if (payload.cmd === 'START') {
                state.isRunning = true;
                console.log("🦋 Swarm Activated!");
            }
        })
        .on('broadcast', { event: 'flash' }, () => {
            // === 核心算法：收到别人的闪光，调整自己的相位 ===
            // 如果我还没闪，但我看到了别人闪，我就加快一点进度
            if (state.isRunning) {
                state.phase += BIO_CONFIG.COUPLING;
            }
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') console.log("🟢 Connected.");
        });
}

// === 5. 萤火虫算法循环 (The Kuramoto Loop) ===
function fireflyLoop() {
    if (state.isRunning) {
        // 自然增长
        state.phase += BIO_CONFIG.BASE_SPEED;

        // 阈值检测：是否该发光了？
        if (state.phase >= 1.0) {
            // 1. 重置相位
            state.phase -= 1.0;
            
            // 2. 触发表现 (声音+视觉)
            triggerPulse();
            
            // 3. 广播给别人 (概率性，为了节省流量)
            if (Math.random() < BIO_CONFIG.BROADCAST_RATE) {
                if (state.channel) {
                    state.channel.send({
                        type: 'broadcast',
                        event: 'flash',
                        payload: {}
                    });
                }
            }
        }
    }
    
    // 继续下一帧
    requestAnimationFrame(fireflyLoop);
}

// === 6. 触发反馈 ===
function triggerPulse() {
    // 视觉闪烁
    visualizer.flash();
    
    // 声音触发 (WebChucK)
    // 这里的声音会因为 AudioEngine 的五声调式设计而自动和谐
    audioEngine.triggerNote(440); 
}