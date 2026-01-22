document.addEventListener("DOMContentLoaded", () => {

  /* ================= GET ROOM INFO ================= */
  // 🔥 CRITICAL FIX: Get room data from localStorage
  const currentRoom = JSON.parse(localStorage.getItem('currentRoom') || 'null');
  if (!currentRoom || !currentRoom.id) {
    alert('No room selected! Redirecting to room selection...');
    window.location.href = '/room';
    return;
  }

  const roomId = currentRoom.id;
  console.log('Joining room:', roomId);

  /* ================= SOCKET ================= */
  const socket = io();

  // Get username from localStorage
  const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const username = user.username || "Anonymous";

  // FIRST: Set up BoardTemplates listeners
  window.BoardTemplates.loadSaved(socket);

  // THEN: Join the room (which triggers init-board)
  socket.emit("join-room", roomId, username);

  /* ================= PERMISSIONS ================= */
  window.isAdmin = false;
  window.hasAccess = false;

  function updatePermissionsUI() {
    const toolbar = document.querySelector('.miro-toolbar');
    const templateBtn = document.getElementById('change-board-btn');

    if (window.hasAccess) {
      if (toolbar) toolbar.classList.remove('hidden');
    } else {
      if (toolbar) toolbar.classList.add('hidden');
    }

    // Only admin can see/use template button
    if (window.isAdmin) {
      if (templateBtn) templateBtn.classList.remove('hidden');
    } else {
      if (templateBtn) templateBtn.classList.add('hidden');
    }
  }

  window.giveAccess = (targetUsername) => {
    socket.emit("give-access", targetUsername);
  };

  window.revokeAccess = (targetUsername) => {
    socket.emit("revoke-access", targetUsername);
  };

  window.kickUser = (targetUsername) => {
    if (confirm(`Are you sure you want to kick ${targetUsername}?`)) {
      socket.emit("kick-user", targetUsername);
    }
  };

  /* ================= CANVAS ================= */
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");

  const drawBtn = document.getElementById("drawBtn");
  const eraserBtn = document.getElementById("eraser");
  const handBtn = document.getElementById("hand");
  const textBtn = document.getElementById("text");
  const noteBtn = document.getElementById("note");
  const shapesBtn = document.getElementById("shapesBtn");
  const zoomInBtn = document.getElementById("zoomIn");
  const zoomOutBtn = document.getElementById("zoomOut");
  const downloadBtn = document.getElementById("download");
  const indicator = document.getElementById("drawer-indicator");
  const sizeSlider = document.getElementById("sizeSlider");
  const sizeValue = document.getElementById("sizeValue");
  const sizeBtn = document.getElementById("sizeBtn");
  const exitBtn = document.getElementById("exit-btn");
  const infoBtn = document.getElementById("info-btn");
  const roomInfoPanel = document.getElementById("room-info-panel");
  const closeRoomInfo = document.getElementById("close-room-info");

  /* ================= SHAPES ================= */
  const shapesPanel = document.getElementById("shapes-panel");
  const shapesClose = document.getElementById("shapes-close");
  const shapeItems = document.querySelectorAll(".shape-item");

  let shapes = []; // Store all shapes on canvas
  let selectedShape = null;
  let draggedShape = null;
  let resizingShape = null;
  let resizeHandle = null;

  /* ================= CHAT ================= */
  const chatToggle = document.getElementById("chat-toggle");
  const chatPanel = document.getElementById("chat-panel");
  const chatInput = document.getElementById("chat-input");
  const chatSend = document.getElementById("chat-send");
  const chatMessages = document.getElementById("chat-messages");

  chatPanel.classList.add("chat-hidden");
  shapesPanel.classList.add("shapes-hidden");

  chatToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    chatPanel.classList.toggle("chat-hidden");
    // Close other panels if opening chat
    if (!chatPanel.classList.contains("chat-hidden")) {
      const shapesPanel = document.getElementById("shapes-panel");
      if (shapesPanel) shapesPanel.classList.add("shapes-hidden");
    }
  });

  // Close everything when clicking canvas
  canvas.addEventListener("mousedown", () => {
    chatPanel.classList.add("chat-hidden");
    shapesPanel.classList.add("shapes-hidden");
    const stylePanel = document.getElementById("style-panel");
    if (stylePanel) stylePanel.classList.add("hidden");
    if (roomInfoPanel) roomInfoPanel.classList.add("hidden");
  });

  /* ================= ROOM INFO ================= */
  if (infoBtn && roomInfoPanel) {
    // Populate data from localStorage on load
    const currentRoom = JSON.parse(localStorage.getItem('currentRoom') || '{}');
    const displayId = document.getElementById('display-room-id');
    const displayPass = document.getElementById('display-room-pass');

    if (displayId) displayId.innerText = currentRoom.id || '---';
    if (displayPass) displayPass.innerText = currentRoom.password || '---';

    infoBtn.onclick = (e) => {
      e.stopPropagation();
      roomInfoPanel.classList.toggle('hidden');
      // Close other panels if opening info
      if (!roomInfoPanel.classList.contains('hidden')) {
        if (chatPanel) chatPanel.classList.add('chat-hidden');
        if (shapesPanel) shapesPanel.classList.add('shapes-hidden');
        const stylePanel = document.getElementById('style-panel');
        if (stylePanel) stylePanel.classList.add('hidden');
      }
    };

    if (closeRoomInfo) {
      closeRoomInfo.onclick = () => roomInfoPanel.classList.add('hidden');
    }
  }

  // Global utility for copy buttons in canvas.html
  window.copyToClipboard = (elementId) => {
    const textElement = document.getElementById(elementId);
    if (!textElement) return;

    const text = textElement.innerText;
    navigator.clipboard.writeText(text).then(() => {
      // Provide visual feedback on the button that was clicked
      if (event && event.target) {
        const btn = event.target.closest('button');
        if (btn) {
          const originalText = btn.innerText;
          btn.innerText = "Copied!";
          btn.style.background = "#22c55e";
          setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = "";
          }, 2000);
        }
      }
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  function renderUserList(users) {
    const avatarContainer = document.getElementById("avatars-list");
    if (!avatarContainer) return;
    avatarContainer.innerHTML = "";

    // Update the full participant panel if it exists
    const fullList = document.getElementById("full-participant-list");
    if (fullList) {
      fullList.innerHTML = users.map(u => {
        const isTargetAdmin = u.isAdmin;
        const targetHasAccess = u.hasAccess;
        const isMe = u.username === username;

        let actions = '';
        if (window.isAdmin && !isMe) {
          actions = `
            <div class="participant-actions">
              ${!targetHasAccess ?
              `<button class="action-btn access-btn" onclick="giveAccess('${u.username}')">Grant Access</button>` :
              `<button class="action-btn revoke-btn" onclick="revokeAccess('${u.username}')" style="background:#ef4444; color:white;">Revoke Access</button>`
            }
              <button class="action-btn kick-btn" onclick="kickUser('${u.username}')">Kick</button>
            </div>
          `;
        }

        return `
          <div class="participant-item">
            <div class="participant-avatar">${u.username[0].toUpperCase()}</div>
            <div class="participant-info">
              <span class="participant-name" style="font-weight:600;">${u.username} ${isTargetAdmin ? '<span class="admin-badge">Admin</span>' : ''} ${isMe ? '(You)' : ''}</span>
              ${!targetHasAccess ? '<span class="status-badge error">No Access</span>' : '<span class="status-badge success">Has Access</span>'}
            </div>
            ${actions}
          </div>
        `;
      }).join('');
    }

    // Show up to 4 avatars, then a count
    users.slice(0, 4).forEach(u => {
      const uName = u.username;
      const initials = uName.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
      const div = document.createElement("div");
      div.className = "participant-avatar";
      div.innerText = initials;
      div.title = uName;
      // Random Miro-like background colors for avatars
      const colors = ['#FF7043', '#42A5F5', '#66BB6A', '#FFA726', '#AB47BC'];
      div.style.background = colors[Math.floor(Math.random() * colors.length)];
      avatarContainer.appendChild(div);
    });

    if (users.length > 4) {
      const more = document.createElement("div");
      more.className = "participant-avatar more";
      more.innerText = `+${users.length - 4}`;
      avatarContainer.appendChild(more);
    }
  }

  // Toggle Participant Panel
  document.getElementById("participants-avatars").addEventListener('click', (e) => {
    e.stopPropagation();
    const panel = document.getElementById("participants-panel");
    panel.classList.toggle("hidden");
  });

  document.getElementById("close-participants").onclick = () => {
    document.getElementById("participants-panel").classList.add("hidden");
  };

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.participants-panel') && !e.target.closest('#participants-avatars')) {
      document.getElementById("participants-panel").classList.add("hidden");
    }
  });

  socket.on("user-list-updated", users => {
    renderUserList(users);
  });

  chatSend.addEventListener("click", sendMessage);
  chatInput.addEventListener("keydown", e => {
    if (e.key === "Enter") sendMessage();
  });

  function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    socket.emit("chat-message", {
      user: username,
      content: text,
      time: Date.now()
    });

    chatInput.value = "";
  }

  socket.on("chat-message", msg => {
    const div = document.createElement("div");
    div.className = `chat-message ${msg.user === username ? 'own-message' : ''}`;
    div.innerHTML = `
      <div class="message-bubble">
        <span class="chat-user">${msg.user}</span>
        <div class="chat-content">${msg.content}</div>
        <span class="chat-time">${new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  /* ================= STATE ================= */
  let tool = "pen";
  let drawType = "pen";
  let color = "#000";
  let shapeColor = "#3b82f6";
  let brushSize = 5;
  let drawing = false;
  let pendingDraw = false;

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  let paths = [];
  let currentPath = [];
  let px = 0, py = 0;

  let textElements = [];
  let stickyNotes = [];

  /* ================= RESIZE ================= */
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    redraw();
  }
  window.addEventListener("resize", resize);
  resize();

  function getPos(e) {
    return {
      x: (e.clientX - offsetX) / scale,
      y: (e.clientY - offsetY) / scale
    };
  }

  /* ================= SOCKET DRAW ================= */
  socket.on("init-board", data => {
    paths = data.paths || [];
    shapes = data.shapes || [];
    textElements = data.textElements || [];
    stickyNotes = data.stickyNotes || [];
    redraw();
    renderAllShapes();
    renderAllTexts();
    renderAllNotes();
  });

  socket.on("draw-allowed", allowed => {
    if (allowed && pendingDraw) {
      pendingDraw = false;
      drawing = true;
    }
  });

  socket.on("draw-released", () => drawing = false);

  socket.on("user-permissions", data => {
    window.isAdmin = data.isAdmin;
    window.hasAccess = data.hasAccess;
    updatePermissionsUI();
  });

  socket.on("permissions-updated", data => {
    window.hasAccess = data.hasAccess;
    updatePermissionsUI();

    // Safety: Reset tool and stop any active drawing session
    if (!window.hasAccess) {
      tool = "hand";
      drawing = false;
      pendingDraw = false;

      // Update local tool UI
      document.querySelectorAll(".tool").forEach(t => t.classList.remove("active"));
      const handBtn = document.getElementById("hand");
      if (handBtn) handBtn.classList.add("active");
    }

    if (indicator) {
      if (window.hasAccess) {
        indicator.innerText = "Admin gave you access!";
        indicator.style.display = "block";
        setTimeout(() => indicator.style.display = "none", 3000);
      } else {
        indicator.innerText = "Admin revoked your access.";
        indicator.style.display = "block";
        setTimeout(() => indicator.style.display = "none", 3000);
      }
    }
  });

  socket.on("user-kicked", () => {
    alert("You have been kicked from the room by the admin.");
    localStorage.removeItem('currentRoom');
    window.location.href = "/room";
  });

  socket.on("user-joined", data => {
    if (indicator) {
      indicator.innerText = `${data.username} joined!`;
      indicator.style.display = "block";
      setTimeout(() => indicator.style.display = "none", 3000);
    }
    renderUserList(data.users);
  });

  socket.on("user-left", data => {
    if (indicator) {
      indicator.innerText = `${data.username} left!`;
      indicator.style.display = "block";
      setTimeout(() => indicator.style.display = "none", 3000);
    }
    renderUserList(data.users);
  });

  socket.on("user-activity", data => {
    if (indicator) {
      indicator.innerText = `${data.username} ${data.activity}...`;
      indicator.style.display = "block";

      if (window.activityTimeout) clearTimeout(window.activityTimeout);
      window.activityTimeout = setTimeout(() => {
        indicator.style.display = "none";
      }, 3000);
    }
  });

  socket.on("active-drawer", name => {
    if (indicator) {
      indicator.innerText = `${name} is drawing...`;
      indicator.style.display = "block";
    }
  });

  socket.on("drawer-cleared", () => {
    if (indicator) {
      indicator.style.display = "none";
    }
  });

  /* ================= SHAPES SOCKET ================= */
  socket.on("shape-added", shape => {
    shapes.push(shape);
    renderAllShapes();
  });

  socket.on("shape-updated", updatedShape => {
    const idx = shapes.findIndex(s => s.id === updatedShape.id);
    if (idx !== -1) {
      shapes[idx] = updatedShape;
      renderAllShapes();
    }
  });

  socket.on("shape-deleted", shapeId => {
    shapes = shapes.filter(s => s.id !== shapeId);
    renderAllShapes();
  });

  socket.on("clear-all", () => {
    paths = [];
    shapes = [];
    textElements = [];
    stickyNotes = [];
    redraw();
    renderAllShapes();
    renderAllTexts();
    renderAllNotes();
  });

  /* ================= TEXT & NOTES SOCKET ================= */
  socket.on("text-added", textEl => {
    textElements.push(textEl);
    renderAllTexts();
  });

  socket.on("text-updated", updatedText => {
    const idx = textElements.findIndex(t => t.id === updatedText.id);
    if (idx !== -1) {
      textElements[idx] = updatedText;
      renderAllTexts();
    }
  });

  socket.on("text-deleted", textId => {
    textElements = textElements.filter(t => t.id !== textId);
    renderAllTexts();
  });

  socket.on("note-added", note => {
    stickyNotes.push(note);
    renderAllNotes();
  });

  socket.on("note-updated", updatedNote => {
    const idx = stickyNotes.findIndex(n => n.id === updatedNote.id);
    if (idx !== -1) {
      stickyNotes[idx] = updatedNote;
      renderAllNotes();
    }
  });

  socket.on("note-deleted", noteId => {
    stickyNotes = stickyNotes.filter(n => n.id !== noteId);
    renderAllNotes();
  });

  /* ================= MOUSE ================= */
  canvas.addEventListener("mousedown", e => {

    if (tool === "hand") {
      px = e.clientX;
      py = e.clientY;
      canvas.style.cursor = 'grabbing';

      // Also move template overlay
      const templateOverlay = document.getElementById('template-overlay');
      if (templateOverlay && !window.BoardTemplates.interactMode) {
        const currentTransform = window.BoardTemplates.templateTransform;
        window.BoardTemplates.templateStartX = currentTransform.x;
        window.BoardTemplates.templateStartY = currentTransform.y;
      }
      return;
    }
    if (tool === "text") {
      e.preventDefault();
      e.stopPropagation();
      return; // Don't process text here, handle it on mouseup
    }

    if (tool === "note") {
      e.preventDefault();
      e.stopPropagation();
      return; // Don't process note here, handle it on mouseup
    }

    pendingDraw = true;
    currentPath = [getPos(e)];
    socket.emit("request-draw");
    socket.emit("user-activity", "is drawing");
  });

  canvas.addEventListener("mousemove", e => {
    // Hand tool: move canvas AND template together
    if (tool === "hand" && (e.buttons === 1 || e.which === 1)) {
      const dx = e.clientX - px;
      const dy = e.clientY - py;

      offsetX += dx;
      offsetY += dy;

      // 🆕 ADD THIS BLOCK: Move template overlay along with canvas
      const templateOverlay = document.getElementById('template-overlay');
      if (templateOverlay && window.BoardTemplates && !window.BoardTemplates.interactMode) {
        // Update template position by the same delta
        window.BoardTemplates.templateTransform.x += dx;
        window.BoardTemplates.templateTransform.y += dy;
        window.BoardTemplates.applyTransform();
      }

      px = e.clientX;
      py = e.clientY;

      redraw();
      updateAllElementPositions();
      return;
    }

    if (!drawing) return;
    const p = getPos(e);
    currentPath.push(p);
    socket.emit("draw-point", { tool, drawType, color, size: brushSize, points: [p] });
    redraw();
  });

  canvas.addEventListener("mouseup", () => {
    // Hand tool cursor reset and sync template position
    if (tool === "hand") {
      canvas.style.cursor = 'grab';

      // Sync template position with other users
      if (window.BoardTemplates && window.BoardTemplates.socket && window.BoardTemplates.templateTransform) {
        window.BoardTemplates.socket.emit('template-transform-update', window.BoardTemplates.templateTransform);
      }
    }

    if (tool === "text") {
      const e = event;
      const pos = getPos(e);
      const textId = Date.now() + '-' + Math.random();

      const input = document.createElement("input");
      input.className = "text-input";
      input.style.left = e.clientX + "px";
      input.style.top = e.clientY + "px";
      input.style.color = color;
      input.placeholder = "Type text here...";
      document.body.appendChild(input);

      input.oninput = () => {
        socket.emit("user-activity", "is typing");
      };

      // Use setTimeout to ensure input is focused after being added to DOM
      setTimeout(() => {
        input.focus();
      }, 0);

      let textCreated = false;

      input.onkeydown = ev => {
        ev.stopPropagation(); // Prevent event bubbling
        if (ev.key === "Enter" && input.value.trim()) {
          const textElement = {
            id: textId,
            text: input.value,
            x: pos.x,
            y: pos.y,
            color: color
          };

          textElements.push(textElement);
          addToHistory({ type: 'add', objectType: 'text', data: textElement });
          socket.emit("text-add", textElement);
          textCreated = true;
          input.remove();
          renderAllTexts();
        } else if (ev.key === "Escape") {
          input.remove();
        }
      };

      input.onblur = () => {
        setTimeout(() => {
          if (!textCreated && input.parentElement) {
            if (input.value.trim()) {
              const textElement = {
                id: textId,
                text: input.value,
                x: pos.x,
                y: pos.y,
                color: color
              };

              textElements.push(textElement);
              addToHistory({ type: 'add', objectType: 'text', data: textElement });
              socket.emit("text-add", textElement);
              renderAllTexts();
            }
            input.remove();
          }
        }, 100);
      };

      return;
    }

    if (tool === "note") {
      const e = event;
      const noteId = Date.now() + '-' + Math.random();
      const pos = getPos(e);

      const noteData = {
        id: noteId,
        x: pos.x,
        y: pos.y,
        content: "",
        color: "#fff9c4"
      };

      stickyNotes.push(noteData);
      addToHistory({ type: 'add', objectType: 'note', data: noteData });
      socket.emit("note-add", noteData);
      renderAllNotes();

      // Focus the newly created note
      setTimeout(() => {
        const noteEl = document.querySelector(`[data-note-id="${noteId}"]`);
        if (noteEl) noteEl.focus();
      }, 50);

      return;
    }

    if (!drawing) return;
    // ADD ID TO STROKE
    const strokeId = Date.now() + '-' + Math.random();
    const stroke = { id: strokeId, tool, drawType, color, size: brushSize, points: currentPath };
    paths.push(stroke);
    addToHistory({ type: 'add', objectType: 'stroke', data: stroke });
    socket.emit("draw-stroke", stroke);
    socket.emit("release-draw");
    drawing = false;
    currentPath = [];
  });

  socket.on("draw-point", data => {
    // Current path being drawn by someone else, handled by their mouse move
    // We just update the view? Actually draw-point pushes to paths in the original code? 
    // Wait, original code:
    // socket.on("draw-point", data => { paths.push({ ...data }); redraw(); });
    // This looks wrong in original code if it pushes EVERY point as a stroke?
    // Checking original code...
    // Line 427: socket.on("draw-point", data => { paths.push({ ...data }); redraw(); });
    // This seems to interpret 'data' as a stroke-like object?
    // But 'draw-point' emitter (line 308) sends: { tool, drawType, color, points: [p] }
    // So distinct points are added as mini-strokes during live drawing?
    // And then 'draw-stroke' sends the full stroke at the end?
    // If so, we might have duplicates or provisional strokes.
    // Let's leave 'draw-point' as is for now, assuming it's for live preview.
    // But we should NOT add these to history.
    paths.push({ ...data }); // Provisional stroke segment
    redraw();
  });

  socket.on("draw-stroke", stroke => {
    paths.push(stroke);
    redraw();
  });

  socket.on("stroke-deleted", strokeId => {
    paths = paths.filter(p => p.id !== strokeId);
    redraw();
  });

  /* ================= UNDO / REDO ================= */
  const undoStack = [];
  const redoStack = [];
  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");

  function updateHistoryButtons() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
    undoBtn.style.opacity = undoStack.length === 0 ? "0.5" : "1";
    redoBtn.style.opacity = redoStack.length === 0 ? "0.5" : "1";
  }

  function addToHistory(action) {
    undoStack.push(action);
    redoStack.length = 0; // Clear redo stack on new action
    updateHistoryButtons();
  }

  undoBtn.onclick = () => {
    if (undoStack.length === 0) return;
    const action = undoStack.pop();
    redoStack.push(action);
    updateHistoryButtons();

    if (action.type === 'add') {
      // Undo add = delete
      if (action.objectType === 'stroke') {
        paths = paths.filter(p => p.id !== action.data.id);
        socket.emit("stroke-delete", action.data.id);
        redraw();
      } else if (action.objectType === 'shape') {
        shapes = shapes.filter(s => s.id !== action.data.id);
        socket.emit("shape-delete", action.data.id);
        renderAllShapes();
      } else if (action.objectType === 'text') {
        textElements = textElements.filter(t => t.id !== action.data.id);
        socket.emit("text-delete", action.data.id);
        renderAllTexts();
      } else if (action.objectType === 'note') {
        stickyNotes = stickyNotes.filter(n => n.id !== action.data.id);
        socket.emit("note-delete", action.data.id);
        renderAllNotes();
      }
    }
  };

  redoBtn.onclick = () => {
    if (redoStack.length === 0) return;
    const action = redoStack.pop();
    undoStack.push(action);
    updateHistoryButtons();

    if (action.type === 'add') {
      // Redo add = add again
      if (action.objectType === 'stroke') {
        paths.push(action.data);
        socket.emit("draw-stroke", action.data);
        redraw();
      } else if (action.objectType === 'shape') {
        shapes.push(action.data);
        socket.emit("shape-add", action.data);
        renderAllShapes();
      } else if (action.objectType === 'text') {
        textElements.push(action.data);
        socket.emit("text-add", action.data);
        renderAllTexts();
      } else if (action.objectType === 'note') {
        stickyNotes.push(action.data);
        socket.emit("note-add", action.data);
        renderAllNotes();
      }
    }
  };

  updateHistoryButtons();

  /* ================= DRAW ================= */
  function redraw() {
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.clearRect(
      -offsetX / scale,
      -offsetY / scale,
      canvas.width / scale,
      canvas.height / scale
    );

    paths.forEach(drawStroke);
    if (currentPath.length)
      drawStroke({ tool, drawType, color, size: brushSize, points: currentPath });
  }

  function drawStroke(p) {
    if (!p.points || p.points.length === 0) return;

    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (p.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = (p.size || 20) / scale;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = p.color;

      const baseSize = p.size || 5;
      if (p.drawType === "pen") {
        ctx.lineWidth = baseSize;
      } else if (p.drawType === "pencil") {
        ctx.lineWidth = Math.max(1, baseSize / 3);
      } else if (p.drawType === "brush") {
        ctx.lineWidth = baseSize * 2;
      } else {
        ctx.lineWidth = baseSize;
      }
    }

    if (p.points.length < 3) {
      // For small strokes, use simple lines
      p.points.forEach((pt, i) =>
        i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)
      );
    } else {
      // Quadratic Bezier curves for smooth strokes
      ctx.moveTo(p.points[0].x, p.points[0].y);

      for (let i = 1; i < p.points.length - 2; i++) {
        const xc = (p.points[i].x + p.points[i + 1].x) / 2;
        const yc = (p.points[i].y + p.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(p.points[i].x, p.points[i].y, xc, yc);
      }

      // For the last 2 points
      ctx.quadraticCurveTo(
        p.points[p.points.length - 2].x,
        p.points[p.points.length - 2].y,
        p.points[p.points.length - 1].x,
        p.points[p.points.length - 1].y
      );
    }

    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  /* ================= TOOLS ================= */
  drawBtn.onclick = () => {
    tool = "pen";
    updateToolButtons();
  };

  eraserBtn.onclick = () => {
    tool = "eraser";
    updateToolButtons();
  };

  handBtn.onclick = () => {
    tool = "hand";
    updateToolButtons();
  };

  textBtn.onclick = () => {
    tool = "text";
    updateToolButtons();
  };

  noteBtn.onclick = () => {
    tool = "note";
    updateToolButtons();
  };

  shapesBtn.onclick = () => {
    shapesPanel.classList.toggle("shapes-hidden");
  };

  shapesClose.onclick = () => {
    shapesPanel.classList.add("shapes-hidden");
  };

  const clearAllBtn = document.getElementById("clearAll");
  clearAllBtn.onclick = () => {
    if (confirm("Are you sure you want to clear the entire whiteboard? This action cannot be undone.")) {
      paths = [];
      shapes = [];
      textElements = [];
      stickyNotes = [];
      socket.emit("clear-all");
      redraw();
      renderAllShapes();
      renderAllTexts();
      renderAllNotes();
    }
  };

  function updateCursor() {
    let cursorStyle = 'crosshair';

    if (tool === 'pen') {
      const isPencil = drawType === 'pencil';
      const isBrush = drawType === 'brush';
      let svg = '';

      if (isPencil) {
        // High-fidelity 3D Pencil SVG
        svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 30L5 18L18 5L27 14L14 27L2 30Z" fill="#D1D5DB"/>
          <path d="M18 5L22 2L30 10L27 14L18 5Z" fill="#FCA5A5"/>
          <path d="M5 18L18 5L27 14L14 27L5 18Z" fill="${color}"/>
          <path d="M2.5 29.5L14.5 27.5L5.5 18.5L2.5 29.5Z" fill="#4B5563"/>
          <path d="M27 14L18 5L20 3L29 12L27 14Z" fill="white" fill-opacity="0.3"/>
        </svg>`;
      } else if (isBrush) {
        // Exact Artist Brush from Image
        svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Handle -->
          <path d="M12 20L28 4L32 8L16 24L12 20Z" fill="${color}"/>
          <!-- Ferrule -->
          <path d="M8 24L16 24L12 20L8 20L8 24Z" fill="#D1D5DB"/>
          <!-- Bristles -->
          <path d="M2 30C2 30 2 26 4 24L8 24L12 28L12 30C10 32 2 30 2 30Z" fill="#FBBF24"/>
          <!-- Shading -->
          <path d="M12 20L28 4L30 6L14 22L12 20Z" fill="white" fill-opacity="0.2"/>
        </svg>`;
      } else {
        // Refined Fountain Pen: Larger Nib, Shorter Handle
        svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="nibGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#FFFFFF"/>
              <stop offset="40%" stop-color="#D1D5DB"/>
              <stop offset="100%" stop-color="#9CA3AF"/>
            </linearGradient>
          </defs>
          <!-- Handle (Shortened) -->
          <path d="M22 10L30 2L34 6L26 14L22 10Z" fill="${color}"/>
          <!-- Ferrule (Gold) -->
          <path d="M18 14L26 14L22 10L18 10L18 14Z" fill="#F59E0B" stroke="#B45309" stroke-width="0.5"/>
          <!-- Large Professional Nib -->
          <path d="M2 30C6 26 8 22 8 18L18 10L22 14L14 22C10 22 6 26 2 30Z" fill="url(#nibGrad)" stroke="#374151" stroke-width="0.5"/>
          <!-- Slit and Breather Hole -->
          <path d="M2 30L11 21" stroke="#374151" stroke-width="0.8" stroke-linecap="round"/>
          <circle cx="11" cy="21" r="1.2" fill="#374151"/>
          <!-- Shine -->
          <path d="M4 28L10 22" stroke="white" stroke-opacity="0.5" stroke-width="0.5"/>
        </svg>`;
      }
      cursorStyle = `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') 2 30, auto`;
    } else if (tool === 'eraser') {
      const svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="8" width="24" height="16" rx="4" fill="#FBBF24"/>
        <rect x="4" y="12" width="24" height="12" rx="4" fill="#F59E0B"/>
        <circle cx="8" cy="12" r="1.5" fill="#D97706"/>
        <circle cx="16" cy="16" r="1.5" fill="#D97706"/>
        <circle cx="24" cy="14" r="1.5" fill="#D97706"/>
      </svg>`;
      cursorStyle = `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') 16 16, auto`;
    } else if (tool === 'hand') {
      const svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 4C14 4 12 5 12 7V16L11 15C10 14 8 14 7 15C6 16 6 18 7 19L14 26C15 27 17 28 19 28H23C26 28 28 26 28 23V13C28 11 26 10 24 10C23 10 22 10.5 21.5 11C21 10 20 9.5 19 9.5C18 9.5 17 10 16.5 11C16 10 15 9.5 14 9.5C14 7 16 7 16 4Z" fill="#FBBF24"/>
      </svg>`;
      cursorStyle = `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') 16 16, auto`;
    } else if (tool === 'text') {
      cursorStyle = 'text';
    } else if (tool === 'note') {
      const svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="24" height="24" rx="2" fill="#E5E7EB"/>
        <path d="M8 10H24M8 16H24M8 22H18" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round"/>
        <path d="M22 22L28 28L30 26L24 20L22 22Z" fill="#3B82F6"/>
      </svg>`;
      cursorStyle = `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') 0 0, auto`;
    }

    canvas.style.cursor = cursorStyle;
  }

  function updateToolButtons() {
    document.querySelectorAll('.tool').forEach(btn => btn.classList.remove('active'));

    if (tool === "pen") drawBtn.classList.add('active');
    else if (tool === "eraser") eraserBtn.classList.add('active');
    else if (tool === "hand") handBtn.classList.add('active');
    else if (tool === "text") textBtn.classList.add('active');
    else if (tool === "note") noteBtn.classList.add('active');

    updateCursor();
  }

  zoomInBtn.onclick = () => {
    scale *= 1.1;
    redraw();
    updateAllElementPositions();
    updateZoomDisplay();
  };

  zoomOutBtn.onclick = () => {
    scale /= 1.1;
    redraw();
    updateAllElementPositions();
    updateZoomDisplay();
  };

  const resetViewBtn = document.getElementById("reset-view");
  if (resetViewBtn) {
    resetViewBtn.onclick = () => {
      scale = 1;
      offsetX = 0;
      offsetY = 0;
      redraw();
      updateAllElementPositions();
      updateZoomDisplay();
    };
  }

  downloadBtn.onclick = () => {
    const a = document.createElement("a");
    a.download = "whiteboard.png";
    a.href = canvas.toDataURL();
    a.click();
  };

  /* ================= MENUS ================= */
  document.querySelectorAll("[data-draw]").forEach(b => {
    b.onclick = (e) => {
      e.stopPropagation();
      tool = "pen";
      drawType = b.dataset.draw;

      // Update active state
      document.querySelectorAll("[data-draw]").forEach(btn => btn.classList.remove('active'));
      b.classList.add('active');

      // Close menu
      b.closest('.context-menu').classList.remove('show');

      updateToolButtons();
    };
  });

  /* ================= SIZE ================= */
  if (sizeBtn) {
    sizeBtn.onclick = (e) => {
      e.stopPropagation();
      const panel = document.getElementById("style-panel");
      if (panel) panel.classList.toggle("hidden");
    };
  }

  /* ================= EXIT ================= */
  if (exitBtn) {
    exitBtn.onclick = () => {
      if (confirm("Are you sure you want to leave this board?")) {
        localStorage.removeItem('currentRoom');
        window.location.href = "/room";
      }
    };
  }

  sizeSlider.oninput = () => {
    brushSize = parseInt(sizeSlider.value);
    sizeValue.innerText = brushSize + "px";

    // Update the PX button on the toolbar
    const btnDisplay = document.getElementById("btnSizeDisplay");
    if (btnDisplay) {
      btnDisplay.innerText = brushSize + "px";
    }

    console.log("Brush size changed to:", brushSize);
    updateCursor();
  };

  // Initial PX Display update
  const initialBtnDisplay = document.getElementById("btnSizeDisplay");
  if (initialBtnDisplay) {
    initialBtnDisplay.innerText = brushSize + "px";
  }
  if (indicator) {
    indicator.style.display = "none";
  }

  function selectDrawColor(newColor) {
    color = newColor;
    ctx.strokeStyle = color;

    // Update ALL sub-menu swatches
    document.querySelectorAll("[data-draw-color]").forEach(clr => {
      if (clr.dataset.drawColor === color) {
        clr.style.boxShadow = '0 0 0 2px var(--miro-blue)';
        clr.style.border = '2px solid #fff';
      } else {
        clr.style.boxShadow = 'none';
        clr.style.border = '1px solid rgba(0,0,0,0.1)';
      }
    });

    // Update main panel swatches
    document.querySelectorAll(".color-swatch[data-color]").forEach(sw => {
      if (sw.dataset.color === color) {
        sw.classList.add('active');
        sw.style.border = '2px solid #fff';
        sw.style.boxShadow = '0 0 0 2px var(--miro-blue)';
      } else {
        sw.classList.remove('active');
        sw.style.border = '1px solid rgba(0,0,0,0.1)';
        sw.style.boxShadow = 'none';
      }
    });

    updateCursor();
  }

  document.querySelectorAll("[data-draw-color]").forEach(c => {
    c.onclick = (e) => {
      e.stopPropagation();
      selectDrawColor(c.dataset.drawColor);
      c.closest('.context-menu').classList.remove('show');
    };
  });

  document.querySelectorAll(".color-swatch[data-color]").forEach(sw => {
    sw.onclick = (e) => {
      e.stopPropagation();
      selectDrawColor(sw.dataset.color);
    };
  });

  document.querySelectorAll("[data-shape-color]").forEach(c => {
    c.onclick = (e) => {
      e.stopPropagation();
      shapeColor = c.dataset.shapeColor;

      // Update active state
      document.querySelectorAll("[data-shape-color]").forEach(clr => {
        clr.style.border = '1px solid rgba(0,0,0,0.1)';
        clr.style.boxShadow = 'none';
      });
      c.style.border = '2px solid #fff';
      c.style.boxShadow = '0 0 0 2px var(--miro-blue)';

      // Close menu
      c.closest('.context-menu').classList.remove('show');
    };
  });

  // Zoom Level Display
  const zoomLevelSpan = document.getElementById("zoom-level");
  function updateZoomDisplay() {
    if (zoomLevelSpan) {
      zoomLevelSpan.innerText = Math.round(scale * 100) + "%";
    }
  }

  // Miro-style Arrow Menus
  document.querySelectorAll(".tool-arrow").forEach(a => {
    a.onclick = (e) => {
      e.stopPropagation();
      const targetMenu = document.getElementById(a.dataset.target);

      // Close other menus
      document.querySelectorAll('.context-menu').forEach(menu => {
        if (menu !== targetMenu) {
          menu.classList.remove('show');
        }
      });

      targetMenu.classList.toggle("show");
    };
  });

  // Close menus when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tool-wrapper')) {
      document.querySelectorAll('.context-menu').forEach(menu => {
        menu.classList.remove('show');
      });
    }
  });

  // Home Button functionality
  document.getElementById('home-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to go home?')) {
      window.location.href = '/';
    }
  });

  // Style Panel Logic removed, handled by sizeBtn and unified color listeners

  /* ================= SHAPES FUNCTIONALITY ================= */

  // Shape SVG templates
  const shapeTemplates = {
    rectangle: '<rect x="10" y="15" width="80" height="70" fill="COLOR" stroke="#333" stroke-width="2"/>',
    circle: '<circle cx="50" cy="50" r="40" fill="COLOR" stroke="#333" stroke-width="2"/>',
    triangle: '<polygon points="50,10 90,85 10,85" fill="COLOR" stroke="#333" stroke-width="2"/>',
    star: '<polygon points="50,10 61,35 88,35 67,52 77,78 50,62 23,78 33,52 12,35 39,35" fill="COLOR" stroke="#333" stroke-width="2"/>',
    hexagon: '<polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="COLOR" stroke="#333" stroke-width="2"/>',
    pentagon: '<polygon points="50,10 90,40 75,85 25,85 10,40" fill="COLOR" stroke="#333" stroke-width="2"/>',
    diamond: '<polygon points="50,10 90,50 50,90 10,50" fill="COLOR" stroke="#333" stroke-width="2"/>',
    'arrow-right': '<path d="M10,40 L60,40 L60,25 L90,50 L60,75 L60,60 L10,60 Z" fill="COLOR" stroke="#333" stroke-width="2"/>',
    'arrow-left': '<path d="M90,40 L40,40 L40,25 L10,50 L40,75 L40,60 L90,60 Z" fill="COLOR" stroke="#333" stroke-width="2"/>',
    'arrow-up': '<path d="M40,90 L40,40 L25,40 L50,10 L75,40 L60,40 L60,90 Z" fill="COLOR" stroke="#333" stroke-width="2"/>',
    'arrow-down': '<path d="M40,10 L40,60 L25,60 L50,90 L75,60 L60,60 L60,10 Z" fill="COLOR" stroke="#333" stroke-width="2"/>',
    ellipse: '<ellipse cx="50" cy="50" rx="45" ry="30" fill="COLOR" stroke="#333" stroke-width="2"/>',
    heart: '<path d="M50,85 C50,85 10,60 10,38 C10,25 20,15 30,15 C40,15 50,25 50,25 C50,25 60,15 70,15 C80,15 90,25 90,38 C90,60 50,85 50,85 Z" fill="COLOR" stroke="#333" stroke-width="2"/>',
    cloud: '<path d="M75,50 C75,40 70,30 60,30 C58,20 50,15 40,15 C28,15 20,25 20,38 C12,38 8,44 8,52 C8,60 14,66 22,66 L75,66 C84,66 90,60 90,52 C90,44 84,50 75,50 Z" fill="COLOR" stroke="#333" stroke-width="2"/>',
    trapezoid: '<polygon points="30,20 70,20 90,80 10,80" fill="COLOR" stroke="#333" stroke-width="2"/>',
    parallelogram: '<polygon points="20,70 60,70 80,30 40,30" fill="COLOR" stroke="#333" stroke-width="2"/>',
    octagon: '<polygon points="35,10 65,10 90,35 90,65 65,90 35,90 10,65 10,35" fill="COLOR" stroke="#333" stroke-width="2"/>',
    cross: '<path d="M40,10 L60,10 L60,40 L90,40 L90,60 L60,60 L60,90 L40,90 L40,60 L10,60 L10,40 L40,40 Z" fill="COLOR" stroke="#333" stroke-width="2"/>',
    'rounded-rect': '<rect x="10" y="20" width="80" height="60" rx="10" fill="COLOR" stroke="#333" stroke-width="2"/>',
    'speech-bubble': '<rect x="10" y="10" width="80" height="60" rx="10" fill="COLOR" stroke="#333" stroke-width="2"/><path d="M40,70 L30,90 L50,70" fill="COLOR" stroke="#333" stroke-width="2"/>',
    lightning: '<polygon points="60,10 20,50 45,50 40,90 80,45 55,45" fill="COLOR" stroke="#333" stroke-width="2"/>',
    moon: '<path d="M65,20 C55,20 45,25 40,35 C35,45 35,60 40,70 C45,80 55,85 65,85 C55,85 45,80 40,70 C35,60 35,45 40,35 C45,25 55,20 65,20 M65,10 C45,10 30,25 30,50 C30,75 45,90 65,90 C75,90 80,85 80,75 C80,65 75,60 70,60 C75,55 78,48 78,42 C78,28 72,10 65,10 Z" fill="COLOR" stroke="#333" stroke-width="2"/>',
    cylinder: '<ellipse cx="50" cy="20" rx="35" ry="15" fill="COLOR" stroke="#333" stroke-width="2"/><path d="M15,20 L15,80 M85,20 L85,80" stroke="#333" stroke-width="2" fill="none"/><ellipse cx="50" cy="80" rx="35" ry="15" fill="COLOR" stroke="#333" stroke-width="2"/>',
    cube: '<path d="M30,40 L50,30 L70,40 L70,70 L50,80 L30,70 Z M50,30 L50,60 M30,40 L50,60 L70,40" fill="COLOR" stroke="#333" stroke-width="2"/>'
  };

  // Drag shapes from panel to canvas
  shapeItems.forEach(item => {
    item.addEventListener("mousedown", startShapeDrag);
  });

  function startShapeDrag(e) {
    e.preventDefault();
    const shapeType = e.currentTarget.dataset.shape;
    const clone = e.currentTarget.cloneNode(true);

    clone.style.position = 'fixed';
    clone.style.left = e.clientX - 30 + 'px';
    clone.style.top = e.clientY - 30 + 'px';
    clone.style.width = '60px';
    clone.style.height = '60px';
    clone.style.pointerEvents = 'none';
    clone.style.opacity = '0.7';
    clone.style.zIndex = '999999';

    document.body.appendChild(clone);

    function moveShape(moveE) {
      clone.style.left = moveE.clientX - 30 + 'px';
      clone.style.top = moveE.clientY - 30 + 'px';
    }

    function dropShape(dropE) {
      document.removeEventListener('mousemove', moveShape);
      document.removeEventListener('mouseup', dropShape);
      clone.remove();

      const rect = canvas.getBoundingClientRect();
      if (dropE.clientX >= rect.left && dropE.clientX <= rect.right &&
        dropE.clientY >= rect.top && dropE.clientY <= rect.bottom) {

        const pos = getPos(dropE);

        const shape = {
          id: Date.now() + '-' + Math.random(),
          type: shapeType,
          x: pos.x - 50,
          y: pos.y - 50,
          width: 100,
          height: 100,
          color: shapeColor,
          rotation: 0
        };

        shapes.push(shape);
        addToHistory({ type: 'add', objectType: 'shape', data: shape });
        socket.emit("shape-add", shape);
        renderAllShapes();
      }
    }

    document.addEventListener('mousemove', moveShape);
    document.addEventListener('mouseup', dropShape);
  }

  // Render all shapes
  function renderAllShapes() {
    document.querySelectorAll('.shape-object').forEach(el => el.remove());

    shapes.forEach(shape => {
      createShapeElement(shape);
    });
  }

  function createShapeElement(shape) {
    const shapeEl = document.createElement('div');
    shapeEl.className = 'shape-object';
    shapeEl.dataset.shapeId = shape.id;
    shapeEl.style.left = (shape.x * scale + offsetX) + 'px';
    shapeEl.style.top = (shape.y * scale + offsetY) + 'px';
    shapeEl.style.width = (shape.width * scale) + 'px';
    shapeEl.style.height = (shape.height * scale) + 'px';
    shapeEl.style.transform = `rotate(${shape.rotation}deg)`;

    const svgTemplate = shapeTemplates[shape.type].replace(/COLOR/g, shape.color);
    shapeEl.innerHTML = `<svg viewBox="0 0 100 100">${svgTemplate}</svg>`;

    shapeEl.addEventListener('mousedown', selectShape);
    document.body.appendChild(shapeEl);
  }

  function selectShape(e) {
    if (e.target.classList.contains('resize-handle') ||
      e.target.classList.contains('shape-delete')) {
      return;
    }

    e.stopPropagation();

    document.querySelectorAll('.shape-object').forEach(el => {
      el.classList.remove('selected');
      el.querySelectorAll('.resize-handle, .shape-delete').forEach(h => h.remove());
    });

    const shapeEl = e.currentTarget;
    shapeEl.classList.add('selected');
    selectedShape = shapes.find(s => s.id === shapeEl.dataset.shapeId);

    // Add resize handles
    ['nw', 'ne', 'sw', 'se'].forEach(pos => {
      const handle = document.createElement('div');
      handle.className = `resize-handle ${pos}`;
      handle.addEventListener('mousedown', startResize);
      shapeEl.appendChild(handle);
    });

    // Add delete button
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'shape-delete';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', deleteShape);
    shapeEl.appendChild(deleteBtn);

    // Start dragging
    const startScreenX = e.clientX;
    const startScreenY = e.clientY;
    const startDataX = selectedShape.x;
    const startDataY = selectedShape.y;

    function moveShape(moveE) {
      const dx = (moveE.clientX - startScreenX) / scale;
      const dy = (moveE.clientY - startScreenY) / scale;

      selectedShape.x = startDataX + dx;
      selectedShape.y = startDataY + dy;

      shapeEl.style.left = (selectedShape.x * scale + offsetX) + 'px';
      shapeEl.style.top = (selectedShape.y * scale + offsetY) + 'px';
    }

    function stopMove() {
      document.removeEventListener('mousemove', moveShape);
      document.removeEventListener('mouseup', stopMove);
      socket.emit("shape-update", selectedShape);
    }

    document.addEventListener('mousemove', moveShape);
    document.addEventListener('mouseup', stopMove);
  }

  function startResize(e) {
    e.stopPropagation();

    const handle = e.target;
    const shapeEl = handle.parentElement;
    const shape = shapes.find(s => s.id === shapeEl.dataset.shapeId);

    const startScreenX = e.clientX;
    const startScreenY = e.clientY;
    const startWidth = shape.width;
    const startHeight = shape.height;
    const startX = shape.x;
    const startY = shape.y;

    const handleClass = handle.className.split(' ')[1];

    function resize(moveE) {
      const dx = (moveE.clientX - startScreenX) / scale;
      const dy = (moveE.clientY - startScreenY) / scale;

      if (handleClass === 'se') {
        shape.width = Math.max(50, startWidth + dx);
        shape.height = Math.max(50, startHeight + dy);
      } else if (handleClass === 'sw') {
        shape.width = Math.max(50, startWidth - dx);
        shape.height = Math.max(50, startHeight + dy);
        shape.x = startX + dx;
      } else if (handleClass === 'ne') {
        shape.width = Math.max(50, startWidth + dx);
        shape.height = Math.max(50, startHeight - dy);
        shape.y = startY + dy;
      } else if (handleClass === 'nw') {
        shape.width = Math.max(50, startWidth - dx);
        shape.height = Math.max(50, startHeight - dy);
        shape.x = startX + dx;
        shape.y = startY + dy;
      }

      shapeEl.style.width = (shape.width * scale) + 'px';
      shapeEl.style.height = (shape.height * scale) + 'px';
      shapeEl.style.left = (shape.x * scale + offsetX) + 'px';
      shapeEl.style.top = (shape.y * scale + offsetY) + 'px';
    }

    function stopResize() {
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResize);
      socket.emit("shape-update", shape);
    }

    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
  }

  function deleteShape(e) {
    e.stopPropagation();

    const shapeEl = e.target.parentElement;
    const shapeId = shapeEl.dataset.shapeId;

    shapes = shapes.filter(s => s.id !== shapeId);
    shapeEl.remove();
    socket.emit("shape-delete", shapeId);
  }

  // Deselect shape when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.shape-object')) {
      document.querySelectorAll('.shape-object').forEach(el => {
        el.classList.remove('selected');
        el.querySelectorAll('.resize-handle, .shape-delete').forEach(h => h.remove());
      });
      selectedShape = null;
    }
  });

  /* ================= TEXT & NOTES RENDERING ================= */

  function renderAllTexts() {
    document.querySelectorAll('.text-element').forEach(el => el.remove());

    textElements.forEach(textEl => {
      createTextElement(textEl);
    });
  }

  function createTextElement(textData) {
    const textDiv = document.createElement('div');
    textDiv.className = 'text-element';
    textDiv.dataset.textId = textData.id;
    textDiv.style.position = 'absolute';
    textDiv.style.left = (textData.x * scale + offsetX) + 'px';
    textDiv.style.top = (textData.y * scale + offsetY) + 'px';
    textDiv.style.color = textData.color;
    textDiv.style.fontSize = (20 * scale) + 'px';
    textDiv.style.fontFamily = 'Segoe UI, sans-serif';
    textDiv.style.pointerEvents = 'auto';
    textDiv.style.cursor = 'move';
    textDiv.style.userSelect = 'none';
    textDiv.style.whiteSpace = 'nowrap';
    textDiv.style.zIndex = '10000';
    textDiv.innerText = textData.text;

    // Add delete button
    const deleteBtn = document.createElement('span');
    deleteBtn.innerHTML = '×';
    deleteBtn.style.cssText = `
      position: absolute;
      top: -12px;
      right: -12px;
      width: 20px;
      height: 20px;
      background: #ef4444;
      color: white;
      border-radius: 50%;
      display: none;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      border: 2px solid white;
      z-index: 1;
    `;
    textDiv.appendChild(deleteBtn);

    textDiv.onmouseenter = () => deleteBtn.style.display = 'flex';
    textDiv.onmouseleave = () => deleteBtn.style.display = 'none';

    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      textElements = textElements.filter(t => t.id !== textData.id);
      socket.emit("text-delete", textData.id);
      textDiv.remove();
    };

    textDiv.onmousedown = (e) => {
      if (e.target === deleteBtn) return;
      e.stopPropagation();

      const startScreenX = e.clientX;
      const startScreenY = e.clientY;
      const startDataX = textData.x;
      const startDataY = textData.y;

      function moveText(moveE) {
        const dx = (moveE.clientX - startScreenX) / scale;
        const dy = (moveE.clientY - startScreenY) / scale;

        textData.x = startDataX + dx;
        textData.y = startDataY + dy;

        textDiv.style.left = (textData.x * scale + offsetX) + 'px';
        textDiv.style.top = (textData.y * scale + offsetY) + 'px';
      }

      function stopMove() {
        document.removeEventListener('mousemove', moveText);
        document.removeEventListener('mouseup', stopMove);
        socket.emit("text-update", textData);
      }

      document.addEventListener('mousemove', moveText);
      document.addEventListener('mouseup', stopMove);
    };

    document.body.appendChild(textDiv);
  }

  function renderAllNotes() {
    document.querySelectorAll('.note').forEach(el => el.remove());

    stickyNotes.forEach(note => {
      createNoteElement(note);
    });
  }

  function createNoteElement(noteData) {
    const note = document.createElement('div');
    note.className = 'note';
    note.dataset.noteId = noteData.id;
    note.contentEditable = true;
    note.style.left = (noteData.x * scale + offsetX) + 'px';
    note.style.top = (noteData.y * scale + offsetY) + 'px';
    note.style.background = noteData.color;
    note.style.transform = `scale(${scale})`;
    note.style.transformOrigin = 'top left';
    note.innerText = noteData.content;

    // Add delete button
    const deleteBtn = document.createElement('span');
    deleteBtn.innerHTML = '×';
    deleteBtn.style.cssText = `
      position: absolute;
      top: -8px;
      right: -8px;
      width: 20px;
      height: 20px;
      background: #ef4444;
      color: white;
      border-radius: 50%;
      display: none;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      border: 2px solid white;
      z-index: 1;
    `;
    note.appendChild(deleteBtn);

    note.onmouseenter = () => deleteBtn.style.display = 'flex';
    note.onmouseleave = () => deleteBtn.style.display = 'none';

    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      stickyNotes = stickyNotes.filter(n => n.id !== noteData.id);
      socket.emit("note-delete", noteData.id);
      note.remove();
    };

    note.oninput = () => {
      noteData.content = note.innerText;
      socket.emit("note-update", noteData);
      socket.emit("user-activity", "is writing a note");
    };

    note.onmousedown = (ev) => {
      if (ev.target === deleteBtn || ev.target.isContentEditable && document.activeElement === note) return;

      ev.preventDefault();

      const startScreenX = ev.clientX;
      const startScreenY = ev.clientY;
      const startDataX = noteData.x;
      const startDataY = noteData.y;

      function moveNote(m) {
        const dx = (m.clientX - startScreenX) / scale;
        const dy = (m.clientY - startScreenY) / scale;

        noteData.x = startDataX + dx;
        noteData.y = startDataY + dy;

        note.style.left = (noteData.x * scale + offsetX) + 'px';
        note.style.top = (noteData.y * scale + offsetY) + 'px';
      }

      function stopMove() {
        document.removeEventListener('mousemove', moveNote);
        document.removeEventListener('mouseup', stopMove);
        socket.emit("note-update", noteData);
      }

      document.addEventListener('mousemove', moveNote);
      document.addEventListener('mouseup', stopMove);
    };

    document.body.appendChild(note);
  }

  function updateAllElementPositions() {
    // Update text elements
    textElements.forEach(textData => {
      const textEl = document.querySelector(`[data-text-id="${textData.id}"]`);
      if (textEl) {
        textEl.style.left = (textData.x * scale + offsetX) + 'px';
        textEl.style.top = (textData.y * scale + offsetY) + 'px';
        textEl.style.fontSize = (20 * scale) + 'px';
      }
    });

    // Update sticky notes
    stickyNotes.forEach(noteData => {
      const noteEl = document.querySelector(`[data-note-id="${noteData.id}"]`);
      if (noteEl) {
        noteEl.style.left = (noteData.x * scale + offsetX) + 'px';
        noteEl.style.top = (noteData.y * scale + offsetY) + 'px';
        noteEl.style.transform = `scale(${scale})`;
      }
    });

    // Update shapes
    shapes.forEach(shapeData => {
      const shapeEl = document.querySelector(`[data-shape-id="${shapeData.id}"]`);
      if (shapeEl) {
        shapeEl.style.left = (shapeData.x * scale + offsetX) + 'px';
        shapeEl.style.top = (shapeData.y * scale + offsetY) + 'px';
        shapeEl.style.width = (shapeData.width * scale) + 'px';
        shapeEl.style.height = (shapeData.height * scale) + 'px';
      }
    });
  }

});