/**
 * Voice Command Parser
 * Normalizes text and extracts intents/entities using structured rules.
 */
window.VoiceParser = {
    /**
     * Parse raw speech text into an Intent Object
     */
    parse(text) {
        const normalized = text.toLowerCase().trim().replace(/[.,!]/g, '');
        console.log(`[VoiceParser] Parsing: "${normalized}"`);

        // Check for different intent types
        const intent =
            this.detectTextCommand(normalized) ||
            this.detectShapeCreation(normalized) ||
            this.detectToolSwitch(normalized) ||
            this.detectEditing(normalized) ||
            this.detectStyling(normalized) ||
            this.detectPositioning(normalized);

        return intent || { type: 'unknown', original: text };
    },

    detectShapeCreation(text) {
        const shapes = window.VoiceUtils.SHAPES;
        // Search for shapes, favoring longer matches (multi-word) first
        const sortedShapes = [...shapes].sort((a, b) => b.length - a.length);
        const foundShape = sortedShapes.find(s => text.includes(s));

        if (foundShape || text.includes('draw') || text.includes('create') || text.includes('add')) {
            // Map common phrases to system IDs
            let shapeId = foundShape || 'rectangle';
            shapeId = shapeId.replace(/\s+/g, '-'); // Map 'arrow right' to 'arrow-right'

            const intent = {
                type: 'create_shape',
                shape: shapeId,
                size: this.extractNumber(text) || 150,
                color: this.extractColor(text) || '#3b82f6',
                position: this.extractPosition(text) || 'center'
            };
            return intent;
        }
        return null;
    },

    detectPositioning(text) {
        const positions = ['center', 'left', 'right', 'top', 'bottom', 'top left', 'top right', 'bottom left', 'bottom right', 'align center'];
        const foundPosition = positions.find(p => text.includes(p));

        if (foundPosition || text.includes('move') || text.includes('place')) {
            return {
                type: 'position',
                position: foundPosition || 'center'
            };
        }
        return null;
    },

    detectStyling(text) {
        const color = this.extractColor(text);
        const isThickness = text.includes('thickness') || text.includes('thicker') || text.includes('thinner') || text.includes('big') || text.includes('small');
        const isDashed = text.includes('dashed') || text.includes('dotted');
        const isFill = text.includes('fill');

        if (color || isThickness || isDashed || isFill) {
            return {
                type: 'style',
                color: color,
                thickness: text.includes('increase') || text.includes('thicker') ? 'increase' : (text.includes('decrease') || text.includes('thinner') ? 'decrease' : null),
                dashed: isDashed,
                fill: isFill
            };
        }
        return null;
    },

    detectEditing(text) {
        if (text.includes('undo')) return { type: 'edit', action: 'undo' };
        if (text.includes('redo')) return { type: 'edit', action: 'redo' };
        if (text.includes('delete') || text.includes('remove')) return { type: 'edit', action: 'delete' };
        if (text.includes('clear')) return { type: 'edit', action: 'clear' };
        if (text.includes('duplicate') || text.includes('copy')) return { type: 'edit', action: 'duplicate' };
        return null;
    },

    detectToolSwitch(text) {
        if (text.includes('pen') || text.includes('pencil')) return { type: 'tool', tool: 'pen' };
        if (text.includes('eraser')) return { type: 'tool', tool: 'eraser' };
        if (text.includes('select')) return { type: 'tool', tool: 'select' };
        if (text.includes('pan') || text.includes('hand')) return { type: 'tool', tool: 'pan' };
        if (text.includes('snapping')) return { type: 'tool', action: 'toggle_snapping' };
        return null;
    },

    detectTextCommand(text) {
        if (text.includes('text') || text.includes('heading') || text.includes('say')) {
            // Remove common triggers and filler words like "and", "then" immediately following the command
            let content = text.replace(/add\s+text|create\s+text|text|heading|say/g, '').trim();
            content = content.replace(/^(and\s+then|and|then)\s+/, '').trim();

            return {
                type: 'add_text',
                content: content || 'Hello',
                size: text.includes('bigger') ? 'increase' : (text.includes('smaller') ? 'decrease' : null)
            };
        }
        return null;
    },

    extractNumber(text) {
        const match = text.match(/\d+/);
        return match ? parseInt(match[0]) : null;
    },

    extractColor(text) {
        const colors = window.VoiceUtils.COLORS;
        for (const [name, hex] of Object.entries(colors)) {
            if (text.includes(name)) return hex;
        }
        return null;
    },

    extractPosition(text) {
        const positions = Object.keys(window.VoiceUtils.POSITIONS);
        return positions.find(p => text.includes(p)) || null;
    }
};
