// Board Templates System - FULLY INTERACTIVE WITH SYNC
// File: public/js/board-templates.js

const BoardTemplates = {
  templates: {
    coding: {
      name: "💻 Coding Board",
      description: "Structured, logical, interview-oriented",
      color: "#1e293b",
      sections: [
        {
          id: "problem",
          label: "Problem Statement",
          x: 5, y: 5, width: 90, height: 15,
          textStyle: { fontFamily: 'Arial, sans-serif', fontSize: '16px', lineHeight: '1.6' },
          placeholder: "Click to write the problem statement..."
        },
        {
          id: "logic",
          label: "Logic / Pseudocode",
          x: 5, y: 22, width: 60, height: 35,
          textStyle: { fontFamily: '"Courier New", monospace', fontSize: '14px', lineHeight: '1.5', color: '#059669' },
          placeholder: "Click to write pseudocode..."
        },
        {
          id: "notes",
          label: "Notes",
          x: 67, y: 22, width: 28, height: 35,
          textStyle: { fontFamily: 'Arial, sans-serif', fontSize: '13px', lineHeight: '1.5', color: '#6366f1' },
          placeholder: "Click to add notes..."
        },
        {
          id: "code",
          label: "Code Area",
          x: 5, y: 59, width: 90, height: 36,
          textStyle: { fontFamily: '"Courier New", monospace', fontSize: '14px', lineHeight: '1.4', color: '#000' },
          placeholder: "Click to write your code..."
        }
      ]
    },
    medical: {
      name: "🏥 Medical Board",
      description: "Focused, diagram-first, observational",
      color: "#dc2626",
      sections: [
        {
          id: "diagram",
          label: "Diagram Area",
          x: 5, y: 5, width: 90, height: 65,
          textStyle: { fontFamily: 'Arial, sans-serif', fontSize: '14px', lineHeight: '1.5' },
          placeholder: "Draw diagrams here..."
        },
        {
          id: "observations",
          label: "Observations / Notes",
          x: 5, y: 72, width: 90, height: 23,
          textStyle: { fontFamily: 'Georgia, serif', fontSize: '14px', lineHeight: '1.7', color: '#dc2626' },
          placeholder: "Click to add medical observations..."
        }
      ]
    },
    finance: {
      name: "💰 Finance & Accounting",
      description: "Analytical, tabular, decision-focused",
      color: "#16a34a",
      sections: [
        {
          id: "data",
          label: "Numbers / Data",
          x: 5, y: 5, width: 43, height: 55,
          textStyle: { fontFamily: '"Courier New", monospace', fontSize: '14px', lineHeight: '1.5', color: '#16a34a' },
          placeholder: "Click to add financial data..."
        },
        {
          id: "calculations",
          label: "Calculations",
          x: 50, y: 5, width: 45, height: 55,
          textStyle: { fontFamily: '"Courier New", monospace', fontSize: '14px', lineHeight: '1.5', color: '#0891b2' },
          placeholder: "Click to add calculations..."
        },
        {
          id: "summary",
          label: "Summary / Decisions",
          x: 5, y: 62, width: 90, height: 33,
          textStyle: { fontFamily: 'Arial, sans-serif', fontSize: '15px', lineHeight: '1.6', fontWeight: 'bold' },
          placeholder: "Click to add summary and decisions..."
        }
      ]
    },
    project: {
      name: "📅 Project Planning",
      description: "Workflow-driven, Kanban style",
      color: "#9333ea",
      sections: [
        {
          id: "todo",
          label: "To Do",
          x: 5, y: 5, width: 28, height: 90,
          textStyle: { fontFamily: 'Arial, sans-serif', fontSize: '14px', lineHeight: '1.5' },
          placeholder: "Click to add tasks..."
        },
        {
          id: "inprogress",
          label: "In Progress",
          x: 36, y: 5, width: 28, height: 90,
          textStyle: { fontFamily: 'Arial, sans-serif', fontSize: '14px', lineHeight: '1.5', color: '#f59e0b' },
          placeholder: "Click to add tasks..."
        },
        {
          id: "done",
          label: "Done",
          x: 67, y: 5, width: 28, height: 90,
          textStyle: { fontFamily: 'Arial, sans-serif', fontSize: '14px', lineHeight: '1.5', color: '#22c55e' },
          placeholder: "Click to add completed tasks..."
        }
      ]
    },
    brainstorm: {
      name: "💡 Brainstorming",
      description: "Open, free, creative canvas",
      color: "#f59e0b",
      sections: []
    }
  },

  currentTemplate: null,
  socket: null,
  interactMode: false,
  templateTransform: { x: 0, y: 0, scale: 1 },

  // Store template texts
  templateTexts: [],

  init(socketInstance) {
    this.socket = socketInstance;
    this.setupSocketListeners();
    this.showSelector();
  },

  setupSocketListeners() {
    // Receive initial board state
    this.socket.on("init-board", (data) => {
      this.templateTexts = data.templateTexts || [];
      this.templateTransform = data.templateTransform || { x: 0, y: 0, scale: 1 };

      // Restore template if one was active
      if (data.templateKey && this.templates[data.templateKey]) {
        this.currentTemplate = data.templateKey;
        localStorage.setItem('boardTemplate', data.templateKey);
        this.applyTemplate(this.templates[data.templateKey]);

        // Add UI buttons for template interaction
        this.addInteractButton();
        this.addChangeButton();
      }

      // Restore texts after template is applied
      setTimeout(() => {
        this.restoreAllTexts();
        this.applyTransform();
      }, 100);
    });

    // Template text events
    this.socket.on("template-text-added", (textData) => {
      this.templateTexts.push(textData);
      this.renderTextElement(textData);
    });

    this.socket.on("template-text-updated", (updatedText) => {
      const idx = this.templateTexts.findIndex(t => t.id === updatedText.id);
      if (idx !== -1) {
        this.templateTexts[idx] = updatedText;
        this.updateTextElement(updatedText);
      }
    });

    this.socket.on("template-text-deleted", (textId) => {
      this.templateTexts = this.templateTexts.filter(t => t.id !== textId);
      const elem = document.querySelector(`[data-template-text-id="${textId}"]`);
      if (elem) elem.remove();
    });

    // Template transform events
    this.socket.on("template-transform-updated", (transform) => {
      this.templateTransform = transform;
      this.applyTransform();
    });

    this.socket.on("template-selected", (templateKey) => {
      console.log("Template sync received:", templateKey);
      if (this.templates[templateKey]) {
        this.currentTemplate = templateKey;
        localStorage.setItem('boardTemplate', templateKey);
        this.applyTemplate(this.templates[templateKey]);
        this.restoreAllTexts();

        // Show notification
        const indicator = document.getElementById("drawer-indicator");
        if (indicator) {
          indicator.innerText = `Admin changed template to ${this.templates[templateKey].name}`;
          indicator.style.display = "block";
          setTimeout(() => indicator.style.display = "none", 3000);
        }
      }
    });
  },

  showSelector() {
    console.log("Opening template selector...");
    const overlay = document.createElement('div');
    overlay.id = 'template-selector-overlay';
    overlay.innerHTML = `
      <div class="template-selector">
        <h2>Choose Your Board Type</h2>
        <div class="template-grid">
          ${Object.entries(this.templates).map(([key, tmpl]) => `
            <div class="template-card" data-template="${key}">
              <div class="template-icon">${tmpl.name.split(' ')[0]}</div>
              <h3>${tmpl.name}</h3>
              <p>${tmpl.description}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        const templateKey = card.dataset.template;
        this.selectTemplate(templateKey);
        overlay.remove();
      });
    });
  },

  selectTemplate(key) {
    console.log("Admin selecting template:", key, "isAdmin:", window.isAdmin);
    this.currentTemplate = key;
    const template = this.templates[key];

    localStorage.setItem('boardTemplate', key);

    // If Admin, sync with others
    if (window.isAdmin) {
      console.log("Emitting template-select:", key);
      this.socket.emit('template-select', key);
    }

    this.applyTemplate(template);
    this.addInteractButton();
    this.addChangeButton();
    this.restoreAllTexts();
  },

  applyTemplate(template) {
    // Remove existing overlay
    const existing = document.getElementById('template-overlay');
    if (existing) existing.remove();

    // Remove brainstorm class
    document.body.classList.remove('board-brainstorm');

    if (template.sections.length === 0) {
      document.body.classList.add('board-brainstorm');
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'template-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
      transform: translate(${this.templateTransform.x}px, ${this.templateTransform.y}px) scale(${this.templateTransform.scale});
      transform-origin: top left;
      transition: transform 0.1s ease-out;
    `;

    template.sections.forEach(section => {
      const div = this.createSectionElement(section, template.color);
      overlay.appendChild(div);
    });

    document.body.appendChild(overlay);
    this.makeTemplateMovable(overlay);
  },

  makeTemplateMovable(overlay) {
    let isDragging = false;
    let startX, startY;

    const dragHandle = document.createElement('div');
    dragHandle.id = 'template-drag-handle';
    dragHandle.innerHTML = '⊕ Drag Template';
    dragHandle.style.cssText = `
      position: absolute;
      top: -50px;
      left: 50%;
      transform: translateX(-50%);
      background: #111;
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: bold;
      cursor: move;
      pointer-events: auto;
      user-select: none;
      opacity: 0;
      transition: opacity 0.2s;
    `;
    overlay.appendChild(dragHandle);

    overlay.addEventListener('mouseenter', () => {
      if (this.interactMode) dragHandle.style.opacity = '1';
    });

    overlay.addEventListener('mouseleave', () => {
      dragHandle.style.opacity = '0';
    });

    dragHandle.addEventListener('mousedown', (e) => {
      if (!this.interactMode) return;

      isDragging = true;
      startX = e.clientX - this.templateTransform.x;
      startY = e.clientY - this.templateTransform.y;
      dragHandle.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      this.templateTransform.x = e.clientX - startX;
      this.templateTransform.y = e.clientY - startY;

      this.applyTransform();
      this.socket.emit('template-transform-update', this.templateTransform);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        dragHandle.style.cursor = 'move';
      }
    });
  },

  applyTransform() {
    const overlay = document.getElementById('template-overlay');
    if (overlay) {
      overlay.style.transform = `translate(${this.templateTransform.x}px, ${this.templateTransform.y}px) scale(${this.templateTransform.scale})`;
    }
  },

  createSectionElement(section, themeColor) {
    const div = document.createElement('div');
    div.className = 'template-section';
    div.dataset.sectionId = section.id;

    div.style.cssText = `
      position: absolute;
      left: ${section.x}%;
      top: ${section.y}%;
      width: ${section.width}%;
      height: ${section.height}%;
      border: 2px dashed ${themeColor}40;
      border-radius: 8px;
      background: ${themeColor}05;
      pointer-events: auto;
      transition: all 0.2s ease;
    `;

    const header = document.createElement('div');
    header.className = 'template-header';
    header.style.cssText = `
      position: absolute;
      top: -30px;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      pointer-events: auto;
    `;

    const label = document.createElement('div');
    label.className = 'template-label';
    label.textContent = section.label;
    label.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: ${themeColor};
      background: white;
      padding: 4px 12px;
      border-radius: 6px;
      border: 1px solid ${themeColor}40;
      cursor: move;
    `;

    const actions = document.createElement('div');
    actions.style.cssText = `display: flex; gap: 4px;`;

    const writeBtn = document.createElement('button');
    writeBtn.className = 'section-write-btn';
    writeBtn.innerHTML = '✏️ Write';
    writeBtn.style.cssText = `
      font-size: 11px;
      padding: 4px 10px;
      border: 1px solid ${themeColor};
      background: white;
      color: ${themeColor};
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    `;

    writeBtn.onmouseenter = () => {
      writeBtn.style.background = themeColor;
      writeBtn.style.color = 'white';
    };
    writeBtn.onmouseleave = () => {
      writeBtn.style.background = 'white';
      writeBtn.style.color = themeColor;
    };
    writeBtn.onclick = (e) => {
      e.stopPropagation();
      // Always allow writing when clicking the button
      this.addTextToSection(section, div, themeColor);
    };

    actions.appendChild(writeBtn);
    header.appendChild(label);
    header.appendChild(actions);
    div.appendChild(header);

    this.makeSectionDraggable(div, label);
    this.makeSectionResizable(div);

    return div;
  },

  addTextToSection(section, sectionDiv, themeColor) {
    const textId = Date.now() + '-' + Math.random();

    let textContainer = sectionDiv.querySelector('.section-text-container');
    if (!textContainer) {
      textContainer = document.createElement('div');
      textContainer.className = 'section-text-container';
      textContainer.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        right: 10px;
        bottom: 10px;
        overflow-y: auto;
        pointer-events: auto;
      `;
      sectionDiv.appendChild(textContainer);
    }

    const textData = {
      id: textId,
      sectionId: section.id,
      content: '',
      textStyle: section.textStyle,
      placeholder: section.placeholder,
      themeColor: themeColor
    };

    this.templateTexts.push(textData);
    this.socket.emit('template-text-add', textData);
    this.renderTextElement(textData);

    setTimeout(() => {
      const elem = document.querySelector(`[data-template-text-id="${textId}"]`);
      if (elem) elem.focus();
    }, 50);
  },

  renderTextElement(textData) {
    const section = document.querySelector(`[data-section-id="${textData.sectionId}"]`);
    if (!section) return;

    let textContainer = section.querySelector('.section-text-container');
    if (!textContainer) {
      textContainer = document.createElement('div');
      textContainer.className = 'section-text-container';
      textContainer.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        right: 10px;
        bottom: 10px;
        overflow-y: auto;
        pointer-events: auto;
      `;
      section.appendChild(textContainer);
    }

    const textarea = document.createElement('textarea');
    textarea.className = 'section-textarea';
    textarea.dataset.templateTextId = textData.id;
    textarea.placeholder = textData.placeholder;
    textarea.value = textData.content;

    const styleStr = Object.entries(textData.textStyle)
      .map(([key, val]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${val}`)
      .join('; ');

    textarea.style.cssText = `
      width: 100%;
      min-height: 60px;
      padding: 8px;
      border: 2px solid ${textData.themeColor}40;
      border-radius: 6px;
      background: white;
      resize: vertical;
      outline: none;
      margin-bottom: 10px;
      ${styleStr};
    `;

    textarea.oninput = () => {
      textData.content = textarea.value;
      this.socket.emit('template-text-update', textData);

      // 🆕 Emit template-specific activity
      const activity = this.currentTemplate === 'coding' ? 'is coding' : 'is typing';
      this.socket.emit('user-activity', activity);
    };

    textarea.onfocus = () => {
      textarea.style.borderColor = textData.themeColor;
      textarea.style.boxShadow = `0 0 0 3px ${textData.themeColor}20`;
    };

    textarea.onblur = () => {
      textarea.style.borderColor = `${textData.themeColor}40`;
      textarea.style.boxShadow = 'none';
    };

    textContainer.appendChild(textarea);
  },

  updateTextElement(textData) {
    const elem = document.querySelector(`[data-template-text-id="${textData.id}"]`);
    if (elem && elem !== document.activeElement) {
      elem.value = textData.content;
    }
  },

  restoreAllTexts() {
    this.templateTexts.forEach(textData => {
      const existing = document.querySelector(`[data-template-text-id="${textData.id}"]`);
      if (!existing) {
        this.renderTextElement(textData);
      }
    });
  },

  makeSectionDraggable(div, handle) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    handle.onmousedown = (e) => {
      if (!this.interactMode) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = div.getBoundingClientRect();
      const overlay = document.getElementById('template-overlay');
      const overlayRect = overlay.getBoundingClientRect();

      startLeft = ((rect.left - overlayRect.left) / overlayRect.width) * 100;
      startTop = ((rect.top - overlayRect.top) / overlayRect.height) * 100;

      div.style.cursor = 'grabbing';
      e.preventDefault();
    };

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const overlay = document.getElementById('template-overlay');
      const overlayRect = overlay.getBoundingClientRect();

      const dx = ((e.clientX - startX) / overlayRect.width) * 100;
      const dy = ((e.clientY - startY) / overlayRect.height) * 100;

      div.style.left = (startLeft + dx) + '%';
      div.style.top = (startTop + dy) + '%';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        div.style.cursor = '';
      }
    });
  },

  makeSectionResizable(div) {
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'section-resize-handle';
    resizeHandle.style.cssText = `
      position: absolute;
      bottom: 0;
      right: 0;
      width: 20px;
      height: 20px;
      cursor: se-resize;
      pointer-events: auto;
    `;
    resizeHandle.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20">
        <path d="M20 20 L20 15 M20 20 L15 20 M20 20 L20 10 M20 20 L10 20" 
              stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/>
      </svg>
    `;

    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    resizeHandle.onmousedown = (e) => {
      if (!this.interactMode) return;

      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = div.getBoundingClientRect();
      const overlay = document.getElementById('template-overlay');
      const overlayRect = overlay.getBoundingClientRect();

      startWidth = (rect.width / overlayRect.width) * 100;
      startHeight = (rect.height / overlayRect.height) * 100;

      e.stopPropagation();
      e.preventDefault();
    };

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;

      const overlay = document.getElementById('template-overlay');
      const overlayRect = overlay.getBoundingClientRect();

      const dx = ((e.clientX - startX) / overlayRect.width) * 100;
      const dy = ((e.clientY - startY) / overlayRect.height) * 100;

      div.style.width = Math.max(10, startWidth + dx) + '%';
      div.style.height = Math.max(10, startHeight + dy) + '%';
    });

    document.addEventListener('mouseup', () => {
      isResizing = false;
    });

    div.appendChild(resizeHandle);
  },

  addInteractButton() {
    const btn = document.getElementById('interact-mode-btn');
    if (!btn || btn.hasListener) return;

    btn.hasListener = true;
    btn.addEventListener('click', () => {
      this.interactMode = !this.interactMode;

      if (this.interactMode) {
        btn.style.background = '#3b82f6';
        btn.style.color = 'white';
        btn.title = 'Interact Mode: ON (Drag/resize sections)';

        const overlay = document.getElementById('template-overlay');
        if (overlay) {
          overlay.style.pointerEvents = 'auto';
        }
      } else {
        btn.style.background = 'white';
        btn.style.color = '#050038';
        btn.title = 'Interact Mode: OFF (Draw freely)';

        const overlay = document.getElementById('template-overlay');
        if (overlay) {
          overlay.style.pointerEvents = 'none';
          overlay.querySelectorAll('.section-write-btn, .section-textarea, .template-header').forEach(el => {
            el.style.pointerEvents = 'auto';
          });
        }
      }
    });
  },

  addChangeButton() {
    const btn = document.getElementById('change-board-btn');
    if (!btn || btn.hasListener) return;

    btn.hasListener = true;
    btn.addEventListener('click', () => {
      this.showSelector();
    });
  },

  loadSaved(socketInstance) {
    this.socket = socketInstance;
    this.setupSocketListeners();

    // Check if we're creating a NEW room (coming from /domain) or REJOINING an existing room
    const currentRoom = JSON.parse(localStorage.getItem('currentRoom') || '{}');
    const isRejoiningRoom = currentRoom && currentRoom.joinedAt; // joinedAt is set when clicking recent rooms

    if (isRejoiningRoom) {
      // Rejoining an existing room - wait for server to send the template via init-board
      console.log('Rejoining existing room - waiting for server state...');
      // Don't apply template from localStorage, let init-board handle it
      return;
    }

    // Creating a new room - use localStorage template if available
    const saved = localStorage.getItem('boardTemplate');
    if (saved && this.templates[saved]) {
      // Auto-select saved template for new rooms
      this.selectTemplate(saved);
    } else {
      // No template selected for new room, redirect to domain page
      window.location.href = '/domain';
    }
  }
};

// Don't auto-initialize, wait for socket
window.BoardTemplates = BoardTemplates;