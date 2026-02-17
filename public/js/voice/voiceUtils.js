/**
 * Voice Utilities and Constants
 */
window.VoiceUtils = {
    COLORS: {
        'red': '#ef4444',
        'blue': '#3b82f6',
        'green': '#22c55e',
        'yellow': '#f59e0b',
        'orange': '#f97316',
        'purple': '#a855f7',
        'pink': '#ec4899',
        'black': '#000000',
        'white': '#ffffff',
        'gray': '#64748b',
        'brown': '#78350f',
        'cyan': '#06b6d4',
        'magenta': '#d946ef',
        'teal': '#14b8a6',
        'indigo': '#6366f1',
        'lime': '#84cc16'
    },

    SHAPES: [
        'circle', 'rectangle', 'triangle', 'star',
        'hexagon', 'pentagon', 'diamond', 'heart', 'cloud', 'ellipse',
        'arrow right', 'arrow left', 'arrow up', 'arrow down',
        'trapezoid', 'parallelogram', 'cross', 'rounded rect',
        'speech bubble', 'lightning', 'moon', 'cylinder', 'cube'
    ],

    POSITIONS: {
        'center': { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        'top left': { x: 100, y: 100 },
        'top right': { x: window.innerWidth - 100, y: 100 },
        'bottom left': { x: 100, y: window.innerHeight - 100 },
        'bottom right': { x: window.innerWidth - 100, y: window.innerHeight - 100 }
    },

    generateId: () => 'v_' + Math.random().toString(36).substr(2, 9),

    showToast: (message, type = 'info') => {
        const indicator = document.getElementById("drawer-indicator");
        if (indicator) {
            indicator.innerText = message;
            indicator.style.display = "block";
            indicator.style.background = type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(255, 255, 255, 0.9)';
            indicator.style.color = type === 'error' ? '#fff' : '#000';
            setTimeout(() => indicator.style.display = "none", 3000);
        }
    }
};
