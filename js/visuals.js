export const visualizer = {
    setMode(mode) {
        if (mode === "IDLE") {
            document.body.classList.add("breathing");
        }
    },

    flash() {
        document.body.classList.add("flash-active");
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
        setTimeout(() => {
            document.body.classList.remove("flash-active");
        }, 80);
    }
};
