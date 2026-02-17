/**
 * History Manager for Voice Commands
 * Wraps existing undo/redo logic or manages its own for voice-created objects.
 */
window.VoiceHistoryManager = {
    undo: () => {
        console.log('[VoiceHistoryManager] Undo triggered');
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) undoBtn.click();
    },

    redo: () => {
        console.log('[VoiceHistoryManager] Redo triggered');
        const redoBtn = document.getElementById('redoBtn');
        if (redoBtn) redoBtn.click();
    }
};
