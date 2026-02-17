// Board Templates System - FULLY INTERACTIVE WITH SYNC
// File: public/js/board-templates.js

const BoardTemplates = {
  templates: {
    coding: {
      name: "💻 Coding Board",
      description: "Comment, Code, Pseudo Code optimized workflow",
      color: "#1e293b",
      sections: [
        {
          id: "comments",
          label: "Comments",
          x: 2, y: 5, width: 20, height: 90,
          theme: "comments",
          textStyle: { fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: '1.6' },
          placeholder: "Add comments here..."
        },
        {
          id: "code",
          label: "Code",
          x: 24, y: 5, width: 45, height: 90,
          theme: "dark",
          textStyle: { fontFamily: '"JetBrains Mono", "Courier New", monospace', fontSize: '14px', lineHeight: '1.5', color: '#f8f8f2' },
          placeholder: "Write your code here..."
        },
        {
          id: "pseudocode",
          label: "Pseudo Code / Algorithms",
          x: 71, y: 5, width: 27, height: 90,
          theme: "light",
          textStyle: { fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: '1.6', color: '#1e293b' },
          placeholder: "Algorithm steps..."
        }
      ]
    },
    medical: {
      name: "🏥 Medical Board",
      description: "Focused, diagram-first, observational",
      color: "#0891b2",
      sections: [
        {
          id: "medical-diagram",
          label: "Diagram",
          x: 2, y: 2, width: 68, height: 95,
          theme: "medical-diagram",
          textStyle: { fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: '1.6' },
          placeholder: "Draw or place icons here..."
        },
        {
          id: "medical-notes",
          label: "Observation Notes",
          x: 72, y: 2, width: 26, height: 95,
          theme: "medical-notes",
          textStyle: { fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: '1.6', color: '#1e293b' },
          placeholder: "Clinical observations...",
          fields: [
            { id: "medical-date", label: "Date:", placeholder: "YYYY-MM-DD" },
            { id: "medical-id", label: "Case ID:", placeholder: "CASE-001" }
          ]
        }
      ]
    },
    finance: {
      name: "💰 Finance & Accounting",
      description: "Interactive wealth tracking and financial strategy",
      color: "#16a34a",
      sections: [
        {
          id: "money-control",
          label: "Money Control",
          x: 2, y: 2, width: 31, height: 95,
          theme: "finance-control",
          textStyle: { fontFamily: 'Inter, sans-serif', fontSize: '14px' },
          placeholder: "Budget items..."
        },
        {
          id: "wealth-growth",
          label: "Wealth Growth",
          x: 34.5, y: 2, width: 31, height: 95,
          theme: "finance-growth",
          textStyle: { fontFamily: 'Inter, sans-serif', fontSize: '14px' },
          placeholder: "Investment items..."
        },
        {
          id: "future-security",
          label: "Future Security",
          x: 67, y: 2, width: 31, height: 95,
          theme: "finance-security",
          textStyle: { fontFamily: 'Inter, sans-serif', fontSize: '14px' },
          placeholder: "Security goals..."
        }
      ]
    },
    project: {
      name: "📅 Project Planning",
      description: "Workflow-driven, Kanban style",
      color: "#9333ea",
      sections: [
        {
          id: "project-todo",
          label: "To Do",
          x: 2, y: 2, width: 31, height: 95,
          theme: "kanban-todo",
          placeholder: "Tasks to start..."
        },
        {
          id: "project-progress",
          label: "In Progress",
          x: 34.5, y: 2, width: 31, height: 95,
          theme: "kanban-progress",
          placeholder: "Ongoing work..."
        },
        {
          id: "project-done",
          label: "Done",
          x: 67, y: 2, width: 31, height: 95,
          theme: "kanban-done",
          placeholder: "Completed tasks..."
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
  templateTransform: { x: 96.7, y: 87.9, scale: 1 }, // Calibrated for 88px/80px at 0.91 scale
  // Restored fluid layout to fix internal alignment logic

  // Store template texts
  templateTexts: [],
  activeInstances: [], // Support multiple boards

  // 🔥 Track domain state for AI summarization
  medicalStamps: [],
  financeStamps: [],
  financeCards: [],
  financeFields: {},
  projectTasks: [],

  textbookDiagrams: [
    { id: 'kidney', name: 'Kidney', img: '/assets/medical/kidney.png' },
    { id: 'heart', name: 'Heart', img: '/assets/medical/heart.png' },
    { id: 'liver', name: 'Liver', img: '/assets/medical/liver.png' },
    { id: 'brain', name: 'Brain', img: '/assets/medical/brain.png' },
    { id: 'lungs', name: 'Lungs', img: '/assets/medical/lungs.png' },
    { id: 'stomach', name: 'Stomach', img: '/assets/medical/stomach.png' },
    { id: 'skeleton', name: 'Skeleton', img: '/assets/medical/skeleton.png' },
    { id: 'ear', name: 'Ear', img: '/assets/medical/ear.png' },
    { id: 'eye', name: 'Eye', img: '/assets/medical/eye.png' },
    { id: 'skin', name: 'Skin', img: '/assets/medical/skin.png' }
  ],

  init(socketInstance) {
    this.socket = socketInstance;
    this.setupSocketListeners();
    this.showSelector();
  },

  setupSocketListeners() {
    // Receive initial board state
    this.socket.on("init-board", (data) => {
      const roomInfo = JSON.parse(localStorage.getItem('currentRoom') || '{}');
      const isActuallyAdmin = window.isAdmin || roomInfo.isOwner;

      console.log("[SlateX] Received init-board. templateKey:", data.templateKey, "isAdmin:", window.isAdmin, "isActuallyAdmin:", isActuallyAdmin);

      this.templateTexts = data.templateTexts || [];
      this.templateTransform = data.templateTransform || { x: 96.7, y: 87.9, scale: 1 };
      this.activeInstances = data.templateInstances || [];

      // Restore main template if one was active
      if (data.templateKey && this.templates[data.templateKey]) {
        console.log("[SlateX] Restoring active template from server:", data.templateKey);
        this.currentTemplate = data.templateKey;
        this.applyTemplate(this.templates[data.templateKey]);
      }
      // If no template active on server but user (admin) has a pending selection
      else if (isActuallyAdmin) {
        const pendingTemplate = localStorage.getItem('boardTemplate');
        console.log("[SlateX] No active server template. Checking pendingTemplate:", pendingTemplate);
        if (pendingTemplate && this.templates[pendingTemplate]) {
          console.log('[SlateX] Applying pending template for admin:', pendingTemplate);
          this.selectTemplate(pendingTemplate);
        } else {
          console.log("[SlateX] No pending template found, defaulting to brainstorm.");
          // No default apply
        }
      } else {
        console.log("[SlateX] User is not admin and no template active on server.");
      }

      // Restore sub-instances
      this.activeInstances.forEach(inst => {
        if (this.templates[inst.key]) {
          this.applyTemplate(this.templates[inst.key], inst.id, inst.transform);
        }
      });

      this.addChangeButton();
      this.setupAddButton();
      this.setupTray(); // Initialize the new tray

      setTimeout(() => {
        // Sync local tracking arrays with server data
        this.templateTexts = data.templateTexts || [];
        this.restoreAllTexts();

        this.medicalStamps = data.medicalStamps || [];
        this.financeStamps = data.financeStamps || [];
        this.financeCards = data.financeCards || [];
        this.financeFields = data.financeFields || {};
        this.projectTasks = data.projectTasks || [];

        if (data.medicalStamps) {
          data.medicalStamps.forEach(stamp => this.renderRemoteMedicalStamp(stamp));
        }
        if (data.financeStamps) {
          data.financeStamps.forEach(stamp => this.renderRemoteFinanceStamp(stamp));
        }
        if (data.financeCards) {
          data.financeCards.forEach(card => {
            this.addNewFinanceCard(card.sectionId, {
              id: card.cardId,
              title: card.title,
              value: card.value,
              type: card.type,
              x: card.x,
              y: card.y
            });
          });
        }
        if (data.financeFields) {
          Object.entries(data.financeFields).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) {
              if (el.tagName === 'INPUT') el.value = value;
              else el.innerText = value;
            }
          });
        }
        if (data.projectTasks) {
          data.projectTasks.forEach(task => {
            this.addNewProjectTask(task.sectionId, {
              id: task.taskId,
              title: task.title,
              body: task.body,
              x: task.x,
              y: task.y
            });
          });
        }
      }, 500);
    });

    // Template text events
    this.socket.on("template-text-added", (textData) => {
      this.templateTexts.push(textData);
      this.renderTextElement(textData);
    });

    this.socket.on('medical-stamp-sync', (data) => {
      const idx = this.medicalStamps.findIndex(s => s.id === data.id);
      if (idx !== -1) this.medicalStamps[idx] = data;
      else this.medicalStamps.push(data);
      this.renderRemoteMedicalStamp(data);
    });

    this.socket.on('medical-stamp-moved', (data) => {
      const idx = this.medicalStamps.findIndex(s => s.id === data.id);
      if (idx !== -1) this.medicalStamps[idx] = data;
      this.renderRemoteMedicalStamp(data);
    });

    this.socket.on('finance-stamp-sync', (data) => {
      const idx = this.financeStamps.findIndex(s => s.id === data.id);
      if (idx !== -1) this.financeStamps[idx] = data;
      else this.financeStamps.push(data);
      this.renderRemoteFinanceStamp(data);
    });

    this.socket.on('finance-stamp-moved', (data) => {
      const idx = this.financeStamps.findIndex(s => s.id === data.id);
      if (idx !== -1) this.financeStamps[idx] = data;
      this.renderRemoteFinanceStamp(data);
    });

    this.socket.on('finance-field-sync', (data) => {
      this.financeFields[data.id] = data.value;
      const el = document.getElementById(data.id);
      if (el) {
        if (el.tagName === 'INPUT') el.value = data.value;
        else el.innerText = data.value;
      }
    });

    this.socket.on("clear-instances", () => {
      console.log('[SlateX] Domain clearing - removing all template instances');
      document.querySelectorAll('.template-instance-overlay').forEach(overlay => overlay.remove());
      // Also remove main template overlay if one exists
      const mainOverlay = document.getElementById('template-overlay');
      if (mainOverlay) mainOverlay.remove();

      this.activeInstances = [];
      this.templateTexts = [];

      // 🔥 Track domain state
      this.medicalStamps = [];
      this.financeStamps = [];
      this.financeCards = [];
      this.financeFields = {};
      this.projectTasks = [];

      // Also trigger the general cleanup
      if (this.socket.listeners('clear-all').length > 0) {
        this.socket.emit('internal-clear-all'); // Non-socket internal trigger fallback or just repeat logic
      }
      // Direct repetition for safety
      document.querySelectorAll('.medical-icon-stamp, .financial-symbol-stamp, .finance-card, .project-task-card').forEach(el => el.remove());
    });

    this.socket.on("clear-all", () => {
      // Remove all medical stamps
      document.querySelectorAll('.medical-icon-stamp').forEach(stamp => stamp.remove());
      // Remove all financial stamps
      document.querySelectorAll('.financial-symbol-stamp').forEach(stamp => stamp.remove());
      // Remove all finance cards
      document.querySelectorAll('.finance-card').forEach(card => card.remove());
      // Remove all project tasks
      document.querySelectorAll('.project-task-card').forEach(card => card.remove());
      // Clear template text inputs/textareas
      document.querySelectorAll('.template-section input, .template-section textarea').forEach(input => {
        input.value = '';
      });
      // Clear current local texts
      this.templateTexts = [];

      // 🔥 Track domain state
      this.medicalStamps = [];
      this.financeStamps = [];
      this.financeCards = [];
      this.financeFields = {};
      this.projectTasks = [];
    });

    this.socket.on('finance-card-sync', (cardData) => {
      // 🔥 Track local state
      const cIdx = this.financeCards.findIndex(c => c.cardId === cardData.cardId);
      if (cIdx !== -1) this.financeCards[cIdx] = cardData;
      else this.financeCards.push(cardData);

      const existing = document.querySelector(`[data-finance-card-id="${cardData.cardId}"]`);
      if (existing) {
        existing.style.left = cardData.x + 'px';
        existing.style.top = cardData.y + 'px';
        const title = existing.querySelector('.finance-card-title');
        if (title) title.innerText = cardData.title;
        const val = existing.querySelector('.finance-card-value');
        if (val) val.innerText = cardData.value;
      } else {
        this.addNewFinanceCard(cardData.sectionId, {
          id: cardData.cardId,
          title: cardData.title,
          value: cardData.value,
          type: cardData.type,
          x: cardData.x,
          y: cardData.y
        });
      }
    });

    this.socket.on('finance-card-deleted', (cardId) => {
      this.financeCards = this.financeCards.filter(c => c.cardId !== cardId);
      const card = document.querySelector(`[data-finance-card-id="${cardId}"]`);
      if (card) card.remove();
    });

    this.socket.on('project-task-sync', (taskData) => {
      // 🔥 Track local state
      const tIdx = this.projectTasks.findIndex(t => t.taskId === taskData.taskId);
      if (tIdx !== -1) this.projectTasks[tIdx] = taskData;
      else this.projectTasks.push(taskData);

      // Find existing or create new
      const existing = document.querySelector(`[data-task-id="${taskData.taskId}"]`);
      if (existing) {
        existing.style.left = taskData.x + 'px';
        existing.style.top = taskData.y + 'px';
        const title = existing.querySelector('.task-title');
        if (title) title.innerText = taskData.title;
        const body = existing.querySelector('.task-body');
        if (body) body.innerText = taskData.body || '';
      } else {
        this.addNewProjectTask(taskData.sectionId, {
          id: taskData.taskId,
          title: taskData.title,
          body: taskData.body,
          x: taskData.x,
          y: taskData.y
        });
      }
    });

    this.socket.on('project-task-deleted', (taskId) => {
      this.projectTasks = this.projectTasks.filter(t => t.taskId !== taskId);
      const card = document.querySelector(`[data-task-id="${taskId}"]`);
      if (card) card.remove();
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
      this.applyTransform(null, transform);
    });

    this.socket.on("template-selected", (data) => {
      const { key, transform } = typeof data === 'string' ? { key: data, transform: null } : data;
      console.log("Template sync received:", key, transform);
      if (this.templates[key]) {
        this.currentTemplate = key;
        if (transform) this.templateTransform = transform;
        localStorage.setItem('boardTemplate', key);
        this.applyTemplate(this.templates[key]);
        this.setupTray(); // Refresh tray filter
        this.restoreAllTexts();
      }
    });

    this.socket.on("template-instance-added", (inst) => {
      console.log("New template instance added:", inst);
      if (this.templates[inst.key]) {
        this.activeInstances.push(inst);
        this.applyTemplate(this.templates[inst.key], inst.id, inst.transform);
        this.restoreAllTexts();
      }
    });

    this.socket.on("template-instance-transform-updated", (data) => {
      const { id, transform } = data;
      const inst = this.activeInstances.find(i => i.id === id);
      if (inst) {
        inst.transform = transform;
        this.applyTransform(id, transform);
      }
    });

    this.socket.on("template-instance-deleted", (instanceId) => {
      const overlay = document.getElementById(`template-overlay-${instanceId}`);
      if (overlay) overlay.remove();
      this.activeInstances = this.activeInstances.filter(i => i.id !== instanceId);
      this.templateTexts = this.templateTexts.filter(t => t.instanceId !== instanceId);
    });

    this.socket.on("clear-instances", () => {
      console.log("[SlateX] Clearing all domain objects locally");
      // Remove all elements belonging to instances
      document.querySelectorAll('.template-instance-overlay').forEach(el => el.remove());

      // Remove all domain-specific elements
      document.querySelectorAll('.medical-icon-stamp, .financial-symbol-stamp, .finance-card, .project-task-card, .template-section input, .template-section textarea').forEach(el => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.value = '';
        } else {
          el.remove();
        }
      });

      this.activeInstances = [];
      this.templateTexts = [];
      this.setupTray(); // Refresh tray filter
      this.applyTransform(); // Re-sync main board just in case
    });
  },

  addChangeButton() {
    const btn = document.getElementById('change-board-btn');
    if (!btn || btn.hasListener) return;

    btn.hasListener = true;
    btn.addEventListener('click', () => {
      this.showSelector(false); // false = Switch Main Board
    });
  },

  setupTray() {
    const tray = document.getElementById('template-tray');
    const trayItems = document.getElementById('tray-items');
    const closeBtn = document.getElementById('close-tray');
    if (!tray || !trayItems) return;

    // Fill tray items filtered by current domain
    const currentDomain = this.currentTemplate || 'coding'; // fallback

    trayItems.innerHTML = Object.entries(this.templates)
      .filter(([key]) => key !== 'brainstorm' && key === currentDomain)
      .map(([key, tmpl]) => `
        <div class="tray-card" data-template="${key}" draggable="true">
          <span class="icon">${tmpl.name.split(' ')[0]}</span>
          <span class="name">${tmpl.name}</span>
        </div>
      `).join('');

    if (trayItems.innerHTML === '') {
      trayItems.innerHTML = `<div style="padding: 20px; font-size: 13px; color: #666; text-align: center;">No specific templates for this domain.</div>`;
    }

    trayItems.querySelectorAll('.tray-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        const key = card.dataset.template;
        e.dataTransfer.setData('text/plain', JSON.stringify({ key, isInstance: true }));
        e.dataTransfer.effectAllowed = 'move';
        tray.style.opacity = '0.5';
      });
      card.addEventListener('dragend', () => {
        tray.style.opacity = '1';
      });
    });

    closeBtn.onclick = () => tray.classList.add('hidden');

    if (!this.dropListenersAdded) {
      document.body.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      document.body.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!window.isAdmin) return;
        try {
          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
          const { key, isInstance } = data;
          if (key && this.templates[key]) {
            const s = window.canvasScale || 1;
            const ox = window.canvasOffsetX || 0;
            const oy = window.canvasOffsetY || 0;

            // Use mouse coordinates for drop center
            const dropX = (e.clientX - ox) / s - (window.innerWidth / 2);
            const dropY = (e.clientY - oy) / s - (window.innerHeight / 2);

            this.selectTemplate(key, { x: dropX, y: dropY }, isInstance);
          }
        } catch (err) {
          console.error("Drop failed:", err);
        }
      });
      this.dropListenersAdded = true;
    }
  },

  setupAddButton() {
    const btn = document.getElementById('add-board-btn');
    if (!btn || btn.hasAddListener) return;

    btn.hasAddListener = true;
    btn.addEventListener('click', () => {
      const tray = document.getElementById('template-tray');
      if (tray) tray.classList.toggle('hidden');
    });
  },

  showSelector() {
    console.log("Opening template selector modal...");
    const overlay = document.createElement('div');
    overlay.id = 'template-selector-overlay';
    overlay.innerHTML = `
      <div class="template-selector">
        <h2>Choose Main Board</h2>
        <p style="font-size: 13px; color: #666; margin-bottom: 20px;">
          Click a card to set the primary board layout. Active drawings will stay.
        </p>
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

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        const key = card.dataset.template;
        this.selectTemplate(key);
        overlay.remove();
      });
    });
  },

  selectTemplate(key, customTransform = null, isInstance = false) {
    console.log("[SlateX] selectTemplate called with key:", key, "isInstance:", isInstance, "isAdmin:", window.isAdmin);
    // 🔥 SECURITY: Only admins are allowed to trigger main template changes or instances
    if (!window.isAdmin) {
      console.warn("[Access Control] Non-admin attempted to change template.");
      return;
    }

    console.log("Admin selecting template:", key, "instance:", isInstance);

    const s = window.canvasScale || 1;
    const ox = window.canvasOffsetX || 0;
    const oy = window.canvasOffsetY || 0;

    if (isInstance) {
      let finalTransform = customTransform;
      if (!finalTransform) {
        // Drop centering: puts the center of the 100% overlay at screen center
        const centerX = (window.innerWidth / 2 - ox) / s - (window.innerWidth / 2);
        const centerY = (window.innerHeight / 2 - oy) / s - (window.innerHeight / 2);
        finalTransform = { x: centerX, y: centerY, scale: 0.5 };
      }
      this.socket.emit('template-select', { key, transform: finalTransform, isInstance: true });
      return;
    }

    this.currentTemplate = key;
    const template = this.templates[key];

    // Calibrated placement for main board switch
    if (!customTransform) {
      // Map screen offset (88, 80) to world coordinates.
      // At baseline 0.91, this is approx (96.7, 87.9)
      const targetX = (88 - ox) / s;
      const targetY = (80 - oy) / s;
      this.templateTransform = { x: targetX, y: targetY, scale: 1 };
    } else {
      this.templateTransform = customTransform;
    }

    localStorage.setItem('boardTemplate', key);

    if (window.isAdmin) {
      this.socket.emit('template-select', { key, transform: this.templateTransform, isInstance: false });
    }

    this.applyTemplate(template);
    this.setupTray();
    this.restoreAllTexts();
  },

  applyTemplate(template, instanceId = null, customTransform = null) {
    const isMain = instanceId === null;
    const overlayId = isMain ? 'template-overlay' : `template-overlay-${instanceId}`;

    console.log("[SlateX] applyTemplate instanceId:", instanceId, "templateName:", template?.name);

    // Replace if main, or create if new instance
    let overlay = document.getElementById(overlayId);

    // If it's the main template and it's already the right one, just update transform and exit
    if (isMain && overlay && overlay.dataset.templateKey === this.currentTemplate) {
      console.log("[SlateX] Main template already rendered, updating transform only.");
      const finalTransform = customTransform || this.templateTransform;
      this.applyTransform(null, finalTransform);
      return;
    }

    if (isMain && overlay) overlay.remove();

    if (isMain) {
      // Explicitly remove medical shelf if it exists
      const shelf = document.getElementById('medical-icon-shelf');
      if (shelf) shelf.remove();

      document.body.classList.remove('board-brainstorm', 'board-medical');

      if (template.sections.length === 0) {
        document.body.classList.add('board-brainstorm');
      } else if (this.currentTemplate === 'medical') {
        document.body.classList.add('board-medical');
      }
    }

    overlay = document.createElement('div');
    overlay.id = overlayId;
    if (isMain) overlay.dataset.templateKey = this.currentTemplate;
    if (instanceId) overlay.classList.add('template-instance-overlay');

    // Calculate initial transform BEFORE adding to DOM to prevent (0,0) flicker
    const finalTransform = customTransform || (isMain ? this.templateTransform : (this.activeInstances.find(i => i.id === instanceId)?.transform || { x: 0, y: 0, scale: 1 }));
    const s = window.canvasScale || 0.91;
    const ox = window.canvasOffsetX || 0;
    const oy = window.canvasOffsetY || 0;
    const screenX = finalTransform.x * s + ox;
    const screenY = finalTransform.y * s + oy;
    const screenScale = (finalTransform.scale || 1) * s;

    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 50;
      transform-origin: top left;
      will-change: transform;
      transform: translate(${screenX}px, ${screenY}px) scale(${screenScale});
    `;

    // Re-add Administrative UI after setting base styles
    // Hide handle for brainstorming (no sections)
    if (window.isAdmin && template.sections.length > 0) {
      const handle = document.createElement('div');
      handle.className = 'template-drag-handle';
      handle.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M5 9l7-7 7 7M5 15l7 7 7-7"></path>
        </svg>
        <span>DRAG BOARD</span>
      `;
      handle.style.cursor = 'grab';
      overlay.appendChild(handle);
      this.makeTemplateMovable(overlay, handle, instanceId);

      if (!isMain) {
        overlay.dataset.instanceId = instanceId;
        overlay.classList.add('template-instance-overlay');

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '×';
        delBtn.style.cssText = `
          position: absolute; top: -20px; right: -10px; width: 24px; height: 24px;
          background: #ef4444; color: white; border: none; border-radius: 50%;
          cursor: pointer; pointer-events: auto; display: flex; align-items: center;
          justify-content: center; font-size: 16px; font-weight: bold; z-index: 101;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        `;
        delBtn.onclick = () => {
          this.socket.emit('template-instance-delete', instanceId);
          overlay.remove();
        };
        overlay.appendChild(delBtn);
      }
    }

    template.sections.forEach(section => {
      const div = this.createSectionElement(section, template.color, instanceId);
      overlay.appendChild(div);
    });

    document.body.appendChild(overlay);
  },

  makeTemplateMovable(overlay, handle, instanceId = null) {
    let isDragging = false;
    let startX, startY;
    let lastEmitTime = 0;

    handle.onmousedown = (e) => {
      isDragging = true;
      const currentTransform = instanceId ?
        (this.activeInstances.find(i => i.id === instanceId)?.transform || { x: 0, y: 0, scale: 1 }) :
        this.templateTransform;

      const s = window.canvasScale || 1;
      const ox = window.canvasOffsetX || 0;
      const oy = window.canvasOffsetY || 0;

      startX = e.clientX - (currentTransform.x * s + ox);
      startY = e.clientY - (currentTransform.y * s + oy);

      handle.style.cursor = 'grabbing';
      overlay.style.zIndex = '1000';
      overlay.style.opacity = '0.8';

      e.preventDefault();
      e.stopPropagation();
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const screenX = e.clientX - startX;
      const screenY = e.clientY - startY;

      const s = window.canvasScale || 1;
      const ox = window.canvasOffsetX || 0;
      const oy = window.canvasOffsetY || 0;

      const worldX = (screenX - ox) / s;
      const worldY = (screenY - oy) / s;

      const currentTransform = instanceId ?
        (this.activeInstances.find(i => i.id === instanceId)?.transform || { x: 0, y: 0, scale: 1 }) :
        this.templateTransform;

      const newTransform = { x: worldX, y: worldY, scale: currentTransform.scale || 1 };

      if (instanceId) {
        const inst = this.activeInstances.find(i => i.id === instanceId);
        if (inst) inst.transform = newTransform;
      } else {
        this.templateTransform = newTransform;
      }

      this.applyTransform(instanceId, newTransform);

      // Throttle socket emission to ~60fps maximum (16ms)
      const now = Date.now();
      if (now - lastEmitTime > 16) {
        this.socket.emit('template-transform-update', { id: instanceId, transform: newTransform });
        lastEmitTime = now;
      }
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      handle.style.cursor = 'grab';
      overlay.style.zIndex = '50';
      overlay.style.opacity = '1';

      // Final sync to ensure all clients have the exact final position
      const currentTransform = instanceId ?
        (this.activeInstances.find(i => i.id === instanceId)?.transform) :
        this.templateTransform;

      this.socket.emit('template-transform-update', { id: instanceId, transform: currentTransform });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  },

  applyTransform(instanceId = null, transform = null) {
    const id = instanceId ? `template-overlay-${instanceId}` : 'template-overlay';
    const overlay = document.getElementById(id);
    if (overlay) {
      const finalTransform = transform || (instanceId ?
        (this.activeInstances.find(i => i.id === instanceId)?.transform || { x: 0, y: 0, scale: 1 }) :
        this.templateTransform);

      const s = window.canvasScale || 1;
      const ox = window.canvasOffsetX || 0;
      const oy = window.canvasOffsetY || 0;

      const screenX = finalTransform.x * s + ox;
      const screenY = finalTransform.y * s + oy;
      const screenScale = (finalTransform.scale || 1) * s;

      overlay.style.transform = `translate(${screenX}px, ${screenY}px) scale(${screenScale})`;
    }
  },

  updateAllTransforms() {
    this.applyTransform(); // main
    this.activeInstances.forEach(inst => this.applyTransform(inst.id, inst.transform));
  },

  panAll(dx, dy) {
    this.updateAllTransforms();
  },

  syncAllTransforms() {
    if (!window.isAdmin || !this.socket) return;

    // Sync main
    if (this.currentTemplate) {
      this.socket.emit('template-transform-update', { id: null, transform: this.templateTransform });
    }

    // Sync instances
    this.activeInstances.forEach(inst => {
      this.socket.emit('template-transform-update', { id: inst.id, transform: inst.transform });
    });
  },

  createSectionElement(section, themeColor, instanceId = null) {
    const div = document.createElement('div');
    const isSolid = section.theme && (section.theme.startsWith('kanban-') || section.theme.startsWith('medical-') || section.theme.startsWith('finance-'));
    div.className = `template-section ${section.theme || 'theme-light'} ${isSolid ? '' : 'glass'}`;
    div.dataset.sectionId = section.id;
    if (instanceId) div.dataset.instanceId = instanceId;

    div.style.cssText = `
      position: absolute;
      left: ${section.x}%;
      top: ${section.y}%;
      width: ${section.width}%;
      height: ${section.height}%;
      border: ${section.theme === 'comments' || section.theme === 'journal' ? 'none' : '2px dashed ' + themeColor + '40'};
      border-radius: ${section.theme === 'comments' || section.theme === 'journal' ? '16px' : '12px'};
      background: ${section.theme === 'dark' ? '#1e1e1e' :
        section.theme === 'comments' ? '#fff' :
          section.theme === 'journal' ? '#fffdf7' :
            section.theme === 'finance-control' ? '#ecfdf5' :
              section.theme === 'finance-growth' ? '#fffbeb' :
                section.theme === 'finance-security' ? '#eef2ff' :
                  'transparent'
      };
      box-shadow: ${section.theme === 'comments' || section.theme === 'dark' || section.theme === 'journal' ? '0 8px 32px rgba(0,0,0,0.1)' : '0 4px 12px rgba(0,0,0,0.05)'};
      pointer-events: auto;
      transition: all 0.2s ease;
      overflow: hidden;
      will-change: transform, left, top;
      ${section.theme === 'grid' ? `
        background-image: 
          linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px);
        background-size: 20px 20px;
      ` : ''}
    `;

    const header = document.createElement('div');
    const isMedical = section.theme === 'journal' || section.theme === 'medical-notes' || section.id === 'medical-diagram';
    const isFinance = section.theme && section.theme.startsWith('finance-');
    header.className = `template-header ${section.theme === 'comments' ? 'header-red' : (isMedical ? 'header-medical' : (isFinance ? 'header-finance' : ''))}`;
    header.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: ${section.theme === 'comments' || isMedical || isFinance ? '50px' : '40px'};
      background: ${section.theme === 'comments' ? '#ff5c5c' :
        section.theme === 'dark' ? '#2d2d2d' :
          '#f8f9fa'
      };
      display: flex;
      align-items: center;
      padding: 0 15px;
      justify-content: space-between;
      pointer-events: auto;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    `;

    const label = document.createElement('div');
    label.className = 'template-label';
    label.textContent = section.label;
    label.style.cssText = `
      font-size: 13px;
      font-weight: 700;
      color: ${section.theme === 'comments' || section.theme === 'dark' ? '#fff' : themeColor};
      cursor: move;
    `;
    header.appendChild(label);

    const visualWrapper = document.createElement('div');
    visualWrapper.className = 'visual-wrapper';
    visualWrapper.style.cssText = `
      position: absolute;
      top: ${section.theme && (section.theme.startsWith('finance-') || section.theme.startsWith('kanban-') || section.theme === 'medical-notes') ? '50px' : '40px'};
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: auto;
      overflow-y: auto;
      background: transparent;
      scrollbar-width: none;
      -ms-overflow-style: none;
    `;
    div.appendChild(visualWrapper);

    if ((section.theme === 'journal' || section.theme === 'medical-notes') && section.fields) {
      this.addSectionFields(visualWrapper, section.fields);
    } else if (section.id === 'medical-diagram') {
      this.addLibraryToggle(header);
    } else if (section.theme && (section.theme.startsWith('finance-') || section.theme.startsWith('kanban-'))) {
      this.addInteractiveHeaderButton(header, section, visualWrapper);
    }

    const actions = document.createElement('div');
    actions.style.cssText = `display: flex; gap: 4px;`;

    const writeBtn = document.createElement('button');
    writeBtn.className = 'section-write-btn';
    writeBtn.title = 'Add text area';
    writeBtn.innerHTML = '＋';
    writeBtn.style.cssText = `
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid ${section.theme === 'comments' || section.theme === 'dark' ? 'rgba(255,255,255,0.3)' : themeColor};
      background: transparent;
      color: ${section.theme === 'comments' || section.theme === 'dark' ? '#fff' : themeColor};
      border-radius: 4px;
      cursor: pointer;
      font-weight: 700;
      transition: all 0.2s;
    `;

    writeBtn.onclick = (e) => {
      e.stopPropagation();
      this.addTextToSection(section, div, themeColor);
    };

    if (!section.id.startsWith('project-')) {
      actions.appendChild(writeBtn);
      header.appendChild(actions);
    }
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
      const topOffset = (section.theme === 'medical-notes' || section.theme === 'finance-summary') && section.fields ? '165px' :
        (section.theme === 'comments' || section.theme === 'journal' || section.theme === 'medical-notes' || (section.theme && section.theme.startsWith('finance-')) ? '65px' : '55px');
      textContainer.style.cssText = `
        position: absolute;
        top: ${topOffset};
        left: 15px;
        right: 15px;
        bottom: 15px;
        overflow-y: auto;
        pointer-events: auto;
        scrollbar-width: thin;
        scrollbar-color: ${section.theme === 'dark' ? '#444 #222' : 'rgba(0,0,0,0.1) transparent'};
        ${section.theme === 'journal' ? `
          background: linear-gradient(#f1f1f1 1px, transparent 1px);
          background-size: 100% 30px;
          padding-top: 5px;
        ` : ''}
      `;
      sectionDiv.appendChild(textContainer);
    }

    const textData = {
      id: textId,
      sectionId: section.id,
      instanceId: sectionDiv.dataset.instanceId || null,
      content: '',
      textStyle: section.textStyle,
      placeholder: section.placeholder,
      themeColor: themeColor,
      theme: section.theme
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
    const parentId = textData.instanceId ? `template-overlay-${textData.instanceId}` : 'template-overlay';
    const parent = document.getElementById(parentId);
    const section = parent ? parent.querySelector(`[data-section-id="${textData.sectionId}"]`) : null;
    if (!section) return;

    let textContainer = section.querySelector('.section-text-container');
    if (!textContainer) {
      const topOffset = (textData.theme === 'medical-notes') ? '165px' :
        (textData.theme === 'comments' || textData.theme === 'journal' || textData.theme === 'medical-notes' ? '65px' : '55px');

      textContainer = document.createElement('div');
      textContainer.className = 'section-text-container';
      textContainer.style.cssText = `
        position: absolute;
        top: ${topOffset};
        left: 15px;
        right: 15px;
        bottom: 15px;
        overflow-y: auto;
        pointer-events: auto;
        scrollbar-width: thin;
        scrollbar-color: ${textData.theme === 'dark' ? '#444 #222' : 'rgba(0,0,0,0.1) transparent'};
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
      min-height: 80px;
      padding: 12px;
      border: 1px solid ${textData.theme === 'dark' ? '#333' : 'rgba(0,0,0,0.08)'};
      border-radius: 8px;
      background: ${textData.theme === 'dark' ? '#252526' : '#fff'};
      color: ${textData.theme === 'dark' ? '#d4d4d4' : '#1e293b'};
      resize: vertical;
      outline: none;
      margin-bottom: 15px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
      ${styleStr};
    `;

    textarea.oninput = () => {
      textData.content = textarea.value;
      this.socket.emit('template-text-update', textData);
      const activity = this.currentTemplate === 'coding' ? 'is coding' : 'is typing';
      this.socket.emit('user-activity', activity);
    };

    textarea.onfocus = () => {
      textarea.style.borderColor = textData.themeColor;
      textarea.style.boxShadow = `0 0 0 3px ${textData.themeColor}20`;
    };

    textarea.onblur = () => {
      textarea.style.borderColor = `rgba(0,0,0,0.1)`;
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

      const updateSectionPos = (moveEvent) => {
        if (!isDragging) return;
        const dx = ((moveEvent.clientX - startX) / overlayRect.width) * 100;
        const dy = ((moveEvent.clientY - startY) / overlayRect.height) * 100;
        div.style.left = (startLeft + dx) + '%';
        div.style.top = (startTop + dy) + '%';
      };

      const stopSectionDrag = () => {
        isDragging = false;
        div.style.cursor = '';
        document.removeEventListener('mousemove', updateSectionPos);
        document.removeEventListener('mouseup', stopSectionDrag);
      };

      document.addEventListener('mousemove', updateSectionPos);
      document.addEventListener('mouseup', stopSectionDrag);
    };
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
          stroke="currentColor" stroke-width="2" fill="none" opacity="0.3" />
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

  addSectionFields(container, fields) {
    const fieldsWrapper = document.createElement('div');
    fieldsWrapper.style.cssText = `
      padding: 55px 20px 10px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: auto;
    `;

    fields.forEach(field => {
      const fieldDiv = document.createElement('div');
      fieldDiv.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        padding-bottom: 4px;
      `;

      const label = document.createElement('span');
      label.textContent = field.label;
      label.style.cssText = `font-size: 12px; font-weight: 700; color: #666; width: 60px;`;

      const input = document.createElement('input');
      input.id = field.id;
      input.placeholder = field.placeholder;
      input.style.cssText = `
        border: none;
        background: transparent;
        outline: none;
        font-size: 13px;
        flex: 1;
        color: #333;
      `;

      input.oninput = () => {
        // 🔥 Store locally for AI summary
        this.financeFields[field.id] = input.value;
        if (this.socket) {
          this.socket.emit('finance-field-update', { id: field.id, value: input.value });
        }
      };

      fieldDiv.appendChild(label);
      fieldDiv.appendChild(input);
      fieldsWrapper.appendChild(fieldDiv);
    });

    container.appendChild(fieldsWrapper);
  },

  addInteractiveHeaderButton(header, section, visualWrapper) {
    const color = (section.theme && section.theme.startsWith('finance-')) ? '#16a34a' : '#9333ea';
    const isFinance = section.theme && section.theme.startsWith('finance-');

    const addBtn = document.createElement('button');
    addBtn.className = isFinance ? 'finance-add-card-btn' : 'project-add-task-btn';
    addBtn.innerHTML = '+';
    addBtn.style.cssText = `
      margin-left: auto;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${color}20;
      border: 1px solid ${color}40;
      border-radius: 6px;
      color: ${color};
      font-size: 18px;
      font-weight: 800;
      cursor: pointer;
      transition: all 0.2s;
    `;

    addBtn.onclick = (e) => {
      e.stopPropagation();
      if (isFinance) {
        this.addNewFinanceCard(section.id, null, visualWrapper);
      } else {
        this.addNewProjectTask(section.id, null, visualWrapper);
      }
    };

    header.appendChild(addBtn);
  },

  addNewFinanceCard(sectionId, existingData = null, visualWrapper = null) {
    const parentContainer = visualWrapper || document.querySelector(`[data-section-id="${sectionId}"] .visual-wrapper`) || document.querySelector(`[data-section-id="${sectionId}"]`);
    if (!parentContainer) return;

    const cardId = existingData ? existingData.id : Date.now() + '-' + Math.random();
    const themeColor = sectionId === 'money-control' ? '#10b981' : (sectionId === 'wealth-growth' ? '#f59e0b' : '#4f46e5');

    const card = document.createElement('div');
    card.className = 'finance-card';
    card.dataset.financeCardId = cardId;
    card.style.cssText = `
      position: absolute;
      width: 160px;
      background: white;
      border-left: 4px solid ${themeColor};
      border-radius: 10px;
      padding: 12px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
      cursor: move;
      z-index: 10;
      user-select: none;
      pointer-events: auto;
    `;

    const titleInput = document.createElement('div');
    titleInput.contentEditable = true;
    titleInput.className = 'finance-card-title';
    titleInput.innerText = existingData ? existingData.title : (sectionId === 'money-control' ? 'Expense/Income' : (sectionId === 'wealth-growth' ? 'Investment' : 'Goal'));
    titleInput.style.cssText = `font-size: 11px; font-weight: 800; color: #64748b; margin-bottom: 4px; outline: none;`;

    const valueInput = document.createElement('div');
    valueInput.contentEditable = true;
    valueInput.className = 'finance-card-value';
    valueInput.innerText = existingData ? existingData.value : (sectionId === 'money-control' ? '$0.00' : (sectionId === 'wealth-growth' ? '0%' : 'Status'));
    valueInput.style.cssText = `font-size: 18px; font-weight: 800; color: #1e293b; outline: none;`;

    const delBtn = document.createElement('div');
    delBtn.innerHTML = '×';
    delBtn.style.cssText = `position: absolute; top: 4px; right: 8px; font-size: 14px; color: #94a3b8; cursor: pointer; display: none;`;
    card.onmouseenter = () => delBtn.style.display = 'block';
    card.onmouseleave = () => delBtn.style.display = 'none';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      card.remove();
      if (this.socket) this.socket.emit('finance-card-delete', cardId);
    };

    card.appendChild(titleInput);
    card.appendChild(valueInput);
    card.appendChild(delBtn);

    if (existingData) {
      card.style.left = existingData.x + 'px';
      card.style.top = existingData.y + 'px';
    } else {
      card.style.left = '20px';
      card.style.top = (20 + (parentContainer.querySelectorAll('.finance-card').length * 90)) + 'px';
    }

    let isDragging = false;
    let startX, startY, initialX, initialY;

    card.onmousedown = (e) => {
      if (e.target === titleInput || e.target === valueInput || e.target === delBtn) return;
      e.stopPropagation();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = card.getBoundingClientRect();
      const pRect = parentContainer.getBoundingClientRect();
      initialX = rect.left - pRect.left + parentContainer.scrollLeft;
      initialY = rect.top - pRect.top + parentContainer.scrollTop;
      card.style.zIndex = '1000';
    };

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      card.style.left = (initialX + dx) + 'px';
      card.style.top = (initialY + dy) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        card.style.zIndex = '10';
        this.syncFinanceCard(cardId, sectionId, titleInput.innerText, valueInput.innerText, parseInt(card.style.left), parseInt(card.style.top));
      }
    });

    [titleInput, valueInput].forEach(inp => {
      inp.onblur = () => this.syncFinanceCard(cardId, sectionId, titleInput.innerText, valueInput.innerText, parseInt(card.style.left), parseInt(card.style.top));
    });

    parentContainer.appendChild(card);
    if (!existingData) {
      this.syncFinanceCard(cardId, sectionId, titleInput.innerText, valueInput.innerText, parseInt(card.style.left), parseInt(card.style.top));
    }
  },

  syncFinanceCard(cardId, sectionId, title, value, x, y) {
    const cardData = { cardId, sectionId, title, value, x, y };
    // 🔥 Track local state
    const idx = this.financeCards.findIndex(c => c.cardId === cardId);
    if (idx !== -1) this.financeCards[idx] = cardData;
    else this.financeCards.push(cardData);

    if (this.socket) {
      this.socket.emit('finance-card-update', cardData);
    }
  },

  makeStampInteractive(stamp, container, type) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    stamp.onmousedown = (e) => {
      e.stopPropagation();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = stamp.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();
      initialX = rect.left - parentRect.left;
      initialY = rect.top - parentRect.top;
      stamp.style.opacity = '0.8';
      stamp.style.cursor = 'grabbing';
    };

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newX = initialX + dx;
      const newY = initialY + dy;
      stamp.style.left = `${newX}px`;
      stamp.style.top = `${newY}px`;

      // 🔥 Track local state for AI summary
      const idx = this.financeStamps.findIndex(s => s.id === stamp.dataset.stampId);
      if (idx !== -1) {
        this.financeStamps[idx].x = newX;
        this.financeStamps[idx].y = newY;
      }

      if (this.socket) {
        this.socket.emit(`${type}-move`, {
          id: stamp.dataset.stampId,
          x: newX,
          y: newY
        });
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        stamp.style.opacity = '1';
        stamp.style.cursor = 'move';

        if (this.socket) {
          const rect = stamp.getBoundingClientRect();
          const pRect = container.getBoundingClientRect();
          this.socket.emit(`${type}-add`, {
            content: stamp.innerText,
            x: rect.left - pRect.left,
            y: rect.top - pRect.top,
            id: stamp.dataset.stampId || Date.now()
          });
        }
      }
    });

    container.appendChild(stamp);
  },

  renderRemoteFinanceStamp(stampData) {
    const { content, x, y, id } = stampData;
    const container = document.querySelector('[data-section-id="money-control"]') || document.querySelector('[data-section-id="wealth-growth"]');
    if (!container) return;

    let stamp = document.querySelector(`[data-stamp-id="${id}"]`);
    if (stamp) {
      stamp.style.left = `${x}px`;
      stamp.style.top = `${y}px`;
      return;
    }

    stamp = document.createElement('div');
    stamp.innerText = content;
    stamp.className = 'financial-symbol-stamp';
    stamp.dataset.stampId = id;
    stamp.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 28px;
      font-weight: 700;
      color: #16a34a;
      cursor: move;
      z-index: 1000;
      user-select: none;
    `;

    this.makeStampInteractive(stamp, container, 'finance-stamp');
  },

  addMedicalIconShelf() {
    const existing = document.getElementById('medical-icon-shelf');
    if (existing) return;

    const shelf = document.createElement('div');
    shelf.id = 'medical-icon-shelf';
    shelf.className = 'glass hidden'; // Start hidden
    shelf.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      display: flex;
      flex-direction: column;
      gap: 15px;
      padding: 15px;
      border-radius: 20px;
      z-index: 10000;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      max-width: 90vw;
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    const diagramGrid = document.createElement('div');
    diagramGrid.style.cssText = `display: flex; gap: 12px; overflow-x: auto; padding-bottom: 5px; scrollbar-width: none;`;

    this.textbookDiagrams.forEach(diag => {
      const btn = this.createShelfButton(diag, true);
      diagramGrid.appendChild(btn);
    });

    shelf.appendChild(diagramGrid);
    document.body.appendChild(shelf);
  },

  addLibraryToggle(header) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'medical-library-toggle';
    toggleBtn.innerHTML = '📂 Library';
    toggleBtn.style.cssText = `
      margin-left: auto;
      padding: 6px 14px;
      border-radius: 8px;
      border: 1px solid rgba(8, 145, 178, 0.2);
      background: #0891b2;
      color: white;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    `;

    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      this.toggleMedicalShelf();
    };

    header.appendChild(toggleBtn);
  },

  toggleMedicalShelf() {
    let shelf = document.getElementById('medical-icon-shelf');
    if (!shelf) {
      this.addMedicalIconShelf();
      shelf = document.getElementById('medical-icon-shelf');
    }

    const isHidden = shelf.classList.contains('hidden');
    if (isHidden) {
      shelf.classList.remove('hidden');
      shelf.style.opacity = '1';
      shelf.style.transform = 'translateX(-50%) translateY(0)';
      shelf.style.pointerEvents = 'auto';
    } else {
      shelf.classList.add('hidden');
      shelf.style.opacity = '0';
      shelf.style.transform = 'translateX(-50%) translateY(20px)';
      shelf.style.pointerEvents = 'none';
    }
  },

  createShelfButton(item, isDiagram) {
    const btn = document.createElement('button');
    btn.className = isDiagram ? 'medical-diag-btn' : 'medical-icon-btn';
    btn.title = item.name;

    if (isDiagram) {
      btn.innerHTML = `<img src="${item.img}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;">`;
    } else {
      btn.innerHTML = item.svg;
    }

    btn.style.cssText = `
      width: ${isDiagram ? '60px' : '36px'};
      height: ${isDiagram ? '60px' : '36px'};
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: ${isDiagram ? '10px' : '8px'};
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      color: #0891b2;
      padding: ${isDiagram ? '4px' : '8px'};
      flex-shrink: 0;
    `;

    btn.onmouseenter = () => {
      btn.style.transform = 'translateY(-6px) scale(1.1)';
      btn.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
      btn.style.borderColor = '#0891b2';
    };
    btn.onmouseleave = () => {
      btn.style.transform = 'translateY(0) scale(1)';
      btn.style.boxShadow = 'none';
      btn.style.borderColor = 'rgba(0,0,0,0.1)';
    };

    btn.onclick = () => {
      this.dropMedicalIcon(item, isDiagram);
    };

    return btn;
  },

  dropMedicalIcon(item, isDiagram) {
    const diagram = document.querySelector('[data-section-id="medical-diagram"]');
    if (!diagram) return;

    const stampId = 'stamp-' + Date.now() + '-' + Math.random();
    const stamp = document.createElement('div');
    stamp.className = 'medical-icon-stamp active-stamp';
    stamp.dataset.stampId = stampId;

    if (isDiagram) {
      stamp.innerHTML = `<img src="${item.img}" style="width: 100%; height: 100%; pointer-events: none;">`;
      stamp.style.width = '250px';
      stamp.style.height = 'auto';
    } else {
      stamp.innerHTML = item.svg;
      stamp.style.width = '80px';
      stamp.style.height = '80px';
    }

    stamp.style.cssText += `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #0891b2;
      cursor: move;
      pointer-events: auto;
      z-index: 100;
      background: ${isDiagram ? 'white' : 'transparent'};
      padding: ${isDiagram ? '15px' : '0'};
      border-radius: ${isDiagram ? '16px' : '0'};
      box-shadow: ${isDiagram ? '0 12px 32px rgba(0,0,0,0.15)' : 'none'};
      user-select: none;
    `;

    this.makeMedicalStampInteractive(stamp, diagram, stampId);
    diagram.appendChild(stamp);

    const stampData = {
      id: stampId,
      item,
      isDiagram,
      x: 50,
      y: 50
    };

    this.medicalStamps.push(stampData);

    if (this.socket) {
      this.socket.emit('medical-stamp-add', stampData);
    }
  },

  makeMedicalStampInteractive(stamp, container, stampId) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    stamp.onmousedown = (e) => {
      // Only allow dragging if the user has access
      if (!window.hasAccess) return;

      e.stopPropagation();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = stamp.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();
      initialX = rect.left - parentRect.left;
      initialY = rect.top - parentRect.top;
      stamp.style.opacity = '0.8';
      stamp.style.cursor = 'grabbing';
      stamp.style.zIndex = '1000';
    };

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Calculate relative percentage positions for responsive sync
      const parentRect = container.getBoundingClientRect();
      const newX = ((initialX + dx + (stamp.offsetWidth / 2)) / parentRect.width) * 100;
      const newY = ((initialY + dy + (stamp.offsetHeight / 2)) / parentRect.height) * 100;

      stamp.style.left = `${newX}%`;
      stamp.style.top = `${newY}%`;

      // 🔥 Track local state for AI summary
      const idx = this.medicalStamps.findIndex(s => s.id === stampId);
      if (idx !== -1) {
        this.medicalStamps[idx].x = newX;
        this.medicalStamps[idx].y = newY;
      }

      if (this.socket) {
        this.socket.emit('medical-stamp-move', {
          id: stampId,
          x: newX,
          y: newY
        });
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        stamp.style.opacity = '1';
        stamp.style.cursor = 'move';
        stamp.style.zIndex = '100';
      }
    });

    stamp.ondblclick = () => {
      if (!window.hasAccess) return;
      if (stamp.style.zIndex === '0') {
        stamp.style.zIndex = '100';
        stamp.style.pointerEvents = 'auto';
        stamp.title = 'Draggable';
      } else {
        stamp.style.zIndex = '0';
        stamp.style.pointerEvents = 'none';
        stamp.title = 'Locked (Click Mode: DRAW)';
      }
    };
  },

  renderRemoteMedicalStamp(stampData) {
    const { id, item, isDiagram, x, y } = stampData;
    const diagram = document.querySelector('[data-section-id="medical-diagram"]');
    if (!diagram) return;

    let stamp = document.querySelector(`[data-stamp-id="${id}"]`);

    if (stamp) {
      // Update existing
      stamp.style.left = `${x}%`;
      stamp.style.top = `${y}%`;
      return;
    }

    // Create new
    stamp = document.createElement('div');
    stamp.className = 'medical-icon-stamp';
    stamp.dataset.stampId = id;

    if (isDiagram) {
      stamp.innerHTML = `<img src="${item.img}" style="width: 100%; height: 100%; pointer-events: none;">`;
      stamp.style.width = '250px';
      stamp.style.height = 'auto';
    } else {
      stamp.innerHTML = item.svg;
      stamp.style.width = '80px';
      stamp.style.height = '80px';
    }

    stamp.style.cssText += `
      position: absolute;
      top: ${y}%;
      left: ${x}%;
      transform: translate(-50%, -50%);
      color: #0891b2;
      pointer-events: ${window.hasAccess ? 'auto' : 'none'};
      z-index: 100;
      background: ${isDiagram ? 'white' : 'transparent'};
      padding: ${isDiagram ? '15px' : '0'};
      border-radius: ${isDiagram ? '16px' : '0'};
      box-shadow: ${isDiagram ? '0 8px 24px rgba(0,0,0,0.1)' : 'none'};
      user-select: none;
    `;

    this.makeMedicalStampInteractive(stamp, diagram, id);
    diagram.appendChild(stamp);
  },

  addProjectTaskButton(header, sectionId, sectionContainer) {
    const visualWrapper = sectionContainer.querySelector('.visual-wrapper');
    this.addInteractiveHeaderButton(header, { id: sectionId, theme: 'kanban' }, visualWrapper);
  },

  addNewProjectTask(sectionId, existingData = null, visualWrapper = null) {
    const container = visualWrapper || document.querySelector(`[data-section-id="${sectionId}"] .visual-wrapper`) || document.querySelector(`[data-section-id="${sectionId}"]`);
    if (!container) return;

    const taskId = existingData ? (existingData.id || existingData.taskId) : Date.now() + '-' + Math.random();
    const isStrategy = sectionId === 'finance-strategy';
    const taskCard = document.createElement('div');
    taskCard.className = `project-task-card ${isStrategy ? 'strategy-card' : ''}`;
    taskCard.dataset.taskId = taskId;

    taskCard.style.cssText = `
      position: absolute;
      width: 140px;
      padding: 12px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      cursor: move;
      z-index: 100;
      user-select: none;
    `;

    const columnLabels = {
      'project-todo': 'To Do Task',
      'project-progress': 'In Progress Task',
      'project-done': 'Done Task'
    };
    const defaultTitle = isStrategy ? '📈' : (columnLabels[sectionId] || 'Project Task');

    const titleInput = document.createElement('div');
    titleInput.contentEditable = true;
    titleInput.className = 'task-title';
    titleInput.innerText = existingData ? existingData.title : defaultTitle;
    titleInput.style.cssText = `
      font-size: ${isStrategy ? '24px' : '14px'};
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 8px;
      outline: none;
      letter-spacing: -0.02em;
      cursor: ${isStrategy ? 'pointer' : 'text'};
      user-select: none;
    `;

    const bodyInput = document.createElement('div');
    bodyInput.contentEditable = true;
    bodyInput.className = 'task-body';
    bodyInput.innerText = existingData ? (existingData.body || '') : 'Add details...';
    bodyInput.style.cssText = `
      font-size: 13px;
      color: #475569;
      min-height: 40px;
      line-height: 1.5;
      outline: none;
      white-space: pre-wrap;
      font-weight: 600;
      background: transparent;
      border: none;
    `;

    taskCard.appendChild(titleInput);
    taskCard.appendChild(bodyInput);

    if (existingData) {
      taskCard.style.left = existingData.x + 'px';
      taskCard.style.top = existingData.y + 'px';
    } else {
      taskCard.style.left = '20px';
      taskCard.style.top = (20 + (container.querySelectorAll('.project-task-card').length * 100)) + 'px';
    }

    let isDragging = false;
    let startX, startY, initialX, initialY;

    taskCard.onmousedown = (e) => {
      if (e.target === titleInput || e.target === bodyInput) return;
      e.stopPropagation();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = taskCard.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();
      initialX = rect.left - parentRect.left + container.scrollLeft;
      initialY = rect.top - parentRect.top + container.scrollTop;
      taskCard.style.opacity = '0.8';
      taskCard.style.transform = 'scale(1.05)';
      taskCard.style.zIndex = '1000';
    };

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      taskCard.style.left = (initialX + dx) + 'px';
      taskCard.style.top = (initialY + dy) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        taskCard.style.opacity = '1';
        taskCard.style.transform = 'scale(1)';
        taskCard.style.zIndex = '100';

        this.syncProjectTask(taskId, sectionId, {
          title: titleInput.innerText,
          body: bodyInput.innerText,
          x: parseInt(taskCard.style.left),
          y: parseInt(taskCard.style.top)
        });
      }
    });

    [titleInput, bodyInput].forEach(inp => {
      inp.onblur = () => {
        this.syncProjectTask(taskId, sectionId, {
          title: titleInput.innerText,
          body: bodyInput.innerText === 'Add details...' ? '' : bodyInput.innerText,
          x: parseInt(taskCard.style.left),
          y: parseInt(taskCard.style.top)
        });
      };
    });

    container.appendChild(taskCard);

    if (!existingData) {
      this.syncProjectTask(taskId, sectionId, {
        title: titleInput.innerText,
        body: bodyInput.innerText,
        x: parseInt(taskCard.style.left),
        y: parseInt(taskCard.style.top)
      });
    }
  },

  syncProjectTask(taskId, sectionId, data) {
    const taskData = { taskId, sectionId, ...data };
    // 🔥 Track local state
    const idx = this.projectTasks.findIndex(t => t.taskId === taskId);
    if (idx !== -1) this.projectTasks[idx] = taskData;
    else this.projectTasks.push(taskData);

    if (this.socket) {
      this.socket.emit('project-task-update', taskData);
    }
  },

  getBoardState() {
    return {
      medicalStamps: this.medicalStamps,
      financeStamps: this.financeStamps,
      financeCards: this.financeCards,
      financeFields: this.financeFields,
      projectTasks: this.projectTasks,
      templateTexts: this.templateTexts,
      templateKey: this.currentTemplate
    };
  },

  loadSaved(socketInstance) {
    this.socket = socketInstance;
    this.setupSocketListeners();

    const currentRoom = JSON.parse(localStorage.getItem('currentRoom') || '{}');
    // If we're in a room, we should generally wait for the server's state
    if (currentRoom && currentRoom.id) {
      console.log('[SlateX] Joined room:', currentRoom.id, '- Waiting for board synchronization.');
      return;
    }

    // Fallback for standalone mode (no room ID)
    const saved = localStorage.getItem('boardTemplate');
    if (saved && this.templates[saved]) {
      this.selectTemplate(saved);
    } else {
      window.location.href = '/domain';
    }
  }
};

// Don't auto-initialize, wait for socket
window.BoardTemplates = BoardTemplates;