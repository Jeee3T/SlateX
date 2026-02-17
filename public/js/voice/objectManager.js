/**
 * Object Manager
 * Manages the state of all objects on the board and handles selection.
 */
window.ObjectManager = {
    selectedId: null,

    /**
     * Get an object by ID from any of the collections
     */
    getObjectById(id) {
        // Accessing globals from canvas.js
        const allObjects = [
            ...(window.shapes || []),
            ...(window.textElements || []),
            ...(window.stickyNotes || [])
        ];
        return allObjects.find(obj => obj.id === id);
    },

    /**
     * Select an object by ID
     */
    selectObject(id) {
        this.selectedId = id;
        // Trigger visual highlight in canvas.js if needed
        console.log(`[ObjectManager] Selected object: ${id}`);

        // Remove selection from all DOM elements
        document.querySelectorAll('.shape-object, .text-element, .note').forEach(el => {
            el.classList.remove('selected');
        });

        // Add selected class to the target element
        const el = document.querySelector(`[data-shape-id="${id}"], [data-text-id="${id}"], [data-note-id="${id}"]`);
        if (el) {
            el.classList.add('selected');
        }
    },

    /**
     * Get the currently selected object
     */
    getSelectedObject() {
        if (!this.selectedId) return null;
        return this.getObjectById(this.selectedId);
    },

    /**
     * Update an object's properties
     */
    updateObject(id, updates) {
        // This will need to be coordinated with socket emits in canvas.js
        console.log(`[ObjectManager] Updating object ${id}`, updates);

        // Find which collection it belongs to
        let found = false;

        const shape = (window.shapes || []).find(s => s.id === id);
        if (shape) {
            Object.assign(shape, updates);
            found = true;
        }

        if (!found) {
            const text = (window.textElements || []).find(t => t.id === id);
            if (text) {
                Object.assign(text, updates);
                found = true;
            }
        }

        if (!found) {
            const note = (window.stickyNotes || []).find(n => n.id === id);
            if (note) {
                Object.assign(note, updates);
            }
        }

        // Request redraw from canvas.js
        if (typeof window.redraw === 'function') window.redraw();
        if (typeof window.renderAllShapes === 'function') window.renderAllShapes();
        if (typeof window.renderAllTexts === 'function') window.renderAllTexts();
        if (typeof window.renderAllNotes === 'function') window.renderAllNotes();

        // 🔥 Broadcast update to other participants
        if (window.socket && found) {
            const updatedObj = this.getObjectById(id);
            if (updatedObj) {
                const type = (window.shapes || []).find(s => s.id === id) ? 'shape' :
                    (window.textElements || []).find(t => t.id === id) ? 'text' : 'note';

                window.socket.emit(`${type}-update`, updatedObj);
            }
        }
    }
};
