/**
 * Command Dispatcher
 * Bridges the gap between VoiceParser and the application state (ObjectManager, Canvas).
 */
window.CommandDispatcher = {
    /**
     * Dispatch an intent to the appropriate manager or action
     */
    dispatch(intent) {
        console.log('[CommandDispatcher] Dispatching intent:', intent);

        switch (intent.type) {
            case 'create_shape':
                this.executeCreateShape(intent);
                break;
            case 'position':
                this.executePositioning(intent);
                break;
            case 'style':
                this.executeStyling(intent);
                break;
            case 'edit':
                this.executeEditing(intent);
                break;
            case 'tool':
                this.executeToolSwitch(intent);
                break;
            case 'add_text':
                this.executeAddText(intent);
                break;
            case 'unknown':
            default:
                window.VoiceUtils.showToast('Command not recognized', 'error');
                break;
        }
    },

    /**
     * Helper to find a position that doesn't overlap with existing objects
     */
    findNonOverlappingPosition(targetX, targetY, width, height) {
        let x = targetX;
        let y = targetY;
        const offset = 40; // Pixels to shift if overlapping
        const maxAttempts = 10;
        let attempts = 0;

        const allObjects = [
            ...(window.shapes || []),
            ...(window.textElements || []),
            ...(window.stickyNotes || [])
        ];

        while (attempts < maxAttempts) {
            let collision = false;
            for (const obj of allObjects) {
                const objX = obj.x;
                const objY = obj.y;
                const objW = obj.width || 100; // Default width if not specified
                const objH = obj.height || 40; // Default height for text/notes

                // Bounding box collision check
                if (x < objX + objW &&
                    x + width > objX &&
                    y < objY + objH &&
                    y + height > objY) {
                    collision = true;
                    break;
                }
            }

            if (!collision) return { x, y };

            // Shift position and try again
            x += offset;
            y += offset;
            attempts++;
        }

        return { x, y };
    },

    executeCreateShape(intent) {
        const id = window.VoiceUtils.generateId();
        const pos = window.VoiceUtils.POSITIONS[intent.position] || window.VoiceUtils.POSITIONS['center'];
        
        // Find best position to avoid overlap
        const size = intent.size || 150;
        const startX = pos.x - (size / 2);
        const startY = pos.y - (size / 2);
        const adjustedPos = this.findNonOverlappingPosition(startX, startY, size, size);

        const newShape = {
            id: id,
            type: intent.shape,
            x: adjustedPos.x,
            y: adjustedPos.y,
            width: size,
            height: size,
            color: intent.color,
            strokeWidth: 2
        };

        // Add to global shapes array (from canvas.js)
        if (window.shapes) {
            window.shapes.push(newShape);
            window.ObjectManager.selectObject(id);

            // Sync with socket if needed (canvas.js handles this in manual drawing)
            // For voice, we might need to emit manually
            if (window.socket) {
                window.socket.emit('shape-add', newShape);
            }

            if (typeof window.renderAllShapes === 'function') window.renderAllShapes();
            window.VoiceUtils.showToast(`Created ${intent.shape}`);
        }
    },

    executePositioning(intent) {
        const selected = window.ObjectManager.getSelectedObject();
        if (!selected) {
            window.VoiceUtils.showToast('No object selected to move', 'error');
            return;
        }

        const pos = window.VoiceUtils.POSITIONS[intent.position];
        if (pos) {
            const width = selected.width || 100;
            const height = selected.height || 100;
            window.ObjectManager.updateObject(selected.id, {
                x: pos.x - (width / 2),
                y: pos.y - (height / 2)
            });
            window.VoiceUtils.showToast(`Moved to ${intent.position}`);
        }
    },

    executeStyling(intent) {
        const selected = window.ObjectManager.getSelectedObject();
        if (!selected) {
            window.VoiceUtils.showToast('No object selected to style', 'error');
            return;
        }

        const updates = {};
        if (intent.color) updates.color = intent.color;

        if (intent.thickness === 'increase') {
            updates.strokeWidth = (selected.strokeWidth || 2) + 2;
        } else if (intent.thickness === 'decrease') {
            updates.strokeWidth = Math.max(1, (selected.strokeWidth || 2) - 2);
        }

        window.ObjectManager.updateObject(selected.id, updates);
        window.VoiceUtils.showToast('Style updated');
    },

    executeEditing(intent) {
        switch (intent.action) {
            case 'undo':
                window.VoiceHistoryManager.undo();
                break;
            case 'redo':
                window.VoiceHistoryManager.redo();
                break;
            case 'delete':
                const selected = window.ObjectManager.getSelectedObject();
                if (selected) {
                    // Logic to delete from global arrays
                    window.shapes = window.shapes.filter(s => s.id !== selected.id);
                    window.textElements = window.textElements.filter(t => t.id !== selected.id);
                    window.stickyNotes = window.stickyNotes.filter(n => n.id !== selected.id);

                    // Remove DOM element
                    const el = document.querySelector(`[data-shape-id="${selected.id}"], [data-text-id="${selected.id}"], [data-note-id="${selected.id}"]`);
                    if (el) el.remove();

                    window.VoiceUtils.showToast('Deleted object');
                    if (window.socket) window.socket.emit('object-deleted', { id: selected.id });
                }
                break;
            case 'clear':
                if (confirm('Clear entire canvas?')) {
                    const clearBtn = document.getElementById('clearAll');
                    if (clearBtn) clearBtn.click();
                }
                break;
        }
    },

    executeToolSwitch(intent) {
        if (intent.tool) {
            const btnMap = {
                'pen': 'drawBtn',
                'eraser': 'eraser',
                'select': 'selectBtn',
                'pan': 'panBtn'
            };
            const btnId = btnMap[intent.tool];
            const btn = document.getElementById(btnId);
            if (btn) btn.click();
            window.VoiceUtils.showToast(`Switched to ${intent.tool}`);
        }
    },

    executeAddText(intent) {
        const id = window.VoiceUtils.generateId();
        const pos = window.VoiceUtils.POSITIONS['center'];
        
        // Simple sizing estimation for text
        const estimatedWidth = 100;
        const estimatedHeight = 30;
        const adjustedPos = this.findNonOverlappingPosition(pos.x, pos.y, estimatedWidth, estimatedHeight);

        const newText = {
            id: id,
            text: intent.content,
            x: adjustedPos.x,
            y: adjustedPos.y,
            color: '#000000',
            fontSize: 20
        };

        if (window.textElements) {
            window.textElements.push(newText);
            window.ObjectManager.selectObject(id);
            if (window.socket) window.socket.emit('text-add', newText);
            if (typeof window.renderAllTexts === 'function') window.renderAllTexts();
            window.VoiceUtils.showToast('Text added');
        }
    }
};
