/* js/visuals.js */
export const visualizer = {
    setMode(mode) {
        // 呼吸模式留空，交由 CSS transition 处理
    },

    flash() {
        // 1. 添加激活类（变亮）
        document.body.classList.add("ripple-active");
        
        // 2. 马上移除类（触发 CSS 的 2.5s 淡出效果）
        requestAnimationFrame(() => {
            setTimeout(() => {
                document.body.classList.remove("ripple-active");
            }, 100);
        });
    }
};