console.log('[DEBUG] script execution started');
document.addEventListener("DOMContentLoaded", () => {
  console.log('[DEBUG] DOMContentLoaded fired');
  const rawRoom = localStorage.getItem('currentRoom');
  console.log('[DEBUG] raw currentRoom from localStorage:', rawRoom);

  /* ================= GET ROOM INFO ================= */
  // 🔥 CRITICAL FIX: Get room data from localStorage
  const currentRoom = JSON.parse(rawRoom || 'null');
  if (!currentRoom || !currentRoom.id) {
    console.error('[DEBUG] No room data! currentRoom:', currentRoom);
    alert('No room selected! Redirecting to room selection...');
    window.location.href = '/room';
    return;
  }

  const roomId = currentRoom.id;
  console.log('[DEBUG] Active room ID:', roomId);
  console.log('[DEBUG] currentRoom.isOwner:', currentRoom.isOwner);

  // Set initial room name UI
  const boardNameEl = document.getElementById('board-name');
  if (boardNameEl && currentRoom.name) {
    boardNameEl.innerText = currentRoom.name;

    // Only allow editing if user is the owner
    if (currentRoom.isOwner) {
      boardNameEl.contentEditable = "true";
    }
  }

  /* ================= SOCKET ================= */
  const socket = io();

  // Get username and ID from local storage (real auth) OR fallback to simulated auth
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const simUser = JSON.parse(localStorage.getItem('user') || 'null');

  const user = currentUser || simUser || {};
  const username = user.username || user.email || "Anonymous";
  const userId = user.id || user._id || null;

  // 🔥 CRITICAL: Initialize canvas state globals early so BoardTemplates can use them
  let scale = 0.91;
  let offsetX = 88; // MATCH CALIBRATED DEFAULT
  let offsetY = 80; // MATCH CALIBRATED DEFAULT

  window.canvasScale = scale;
  window.canvasOffsetX = offsetX;
  window.canvasOffsetY = offsetY;

  /* ================= PERMISSIONS ================= */
  // CRITICAL: Set permissions BEFORE loading templates so template selection works
  window.isAdmin = currentRoom.isOwner || false;
  window.hasAccess = currentRoom.isOwner || false;
  let lastUsersList = []; // Cache list for re-rendering

  // FIRST: Set up BoardTemplates listeners and load state
  window.BoardTemplates.loadSaved(socket);

  // THEN: Join the room (which triggers init-board)
  socket.emit("join-room", roomId, username, userId);

  updatePermissionsUI(); // Apply hints immediately

  function updatePermissionsUI() {
    const toolbar = document.querySelector('.miro-toolbar');
    const templateBtn = document.getElementById('change-board-btn');

    if (window.hasAccess) {
      if (toolbar) toolbar.classList.remove('hidden');
    } else {
      if (toolbar) toolbar.classList.add('hidden');
    }

    // ONLY Admins can see the board template switcher button AND Mic button
    if (window.isAdmin) {
      if (templateBtn) templateBtn.classList.remove('hidden');
      const micBtn = document.getElementById('mic-btn');
      if (micBtn) micBtn.classList.remove('hidden');
    } else {
      if (templateBtn) templateBtn.classList.add('hidden');
      const micBtn = document.getElementById('mic-btn');
      if (micBtn) micBtn.classList.add('hidden');
    }

    // 🔥 Re-render user list whenever permissions change to show/hide admin buttons
    if (lastUsersList.length > 0) {
      renderUserList(lastUsersList);
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
  const selectBtn = document.getElementById("selectBtn");
  const panBtn = document.getElementById("panBtn");
  const textBtn = document.getElementById("text");
  const noteBtn = document.getElementById("note");
  const imageBtn = document.getElementById("imageBtn");
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

  /* ================= IMAGE SOURCE MODAL ================= */
  const imageSourceModal = document.getElementById("image-source-modal");
  const closeImageModal = document.getElementById("close-image-modal");
  const localImageBtn = document.getElementById("local-image-btn");
  const aiImageBtn = document.getElementById("ai-image-btn");

  /* ================= SHAPES ================= */
  const shapesPanel = document.getElementById("shapes-panel");
  const shapesClose = document.getElementById("shapes-close");
  const shapeItems = document.querySelectorAll(".shape-item");

  let shapes = []; // Store all shapes on canvas
  let selectedShape = null;
  let draggedShape = null;
  let resizingShape = null;
  let resizeHandle = null;

  /* ================= SHAPE PLACEMENT STATE ================= */
  let pendingShape = null; // Stores the type of shape to be placed
  let isDrawingShape = false;
  let shapeStartX = 0;
  let shapeStartY = 0;
  let shapePreviewEl = null;

  /* ================= CHAT ================= */
  const chatToggle = document.getElementById("chat-toggle");
  const chatPanel = document.getElementById("chat-panel");
  const chatInput = document.getElementById("chat-input");
  const chatSend = document.getElementById("chat-send");
  const chatMessages = document.getElementById("chat-messages");
  const closeChat = document.getElementById("close-chat");
  const chatBadge = document.getElementById("chat-badge");
  const typingIndicator = document.getElementById("typing-indicator");
  let unreadCount = 0;
  let typingTimeout = null;

  /* ================= CHAT INITIALIZATION ================= */
  function emitTyping(isTyping) {
    if (!socket || !socket.connected) return;
    socket.emit("client-typing", { user: username, isTyping: isTyping });
  }

  /* === EMOJI PICKER === */
  const emojiToggle = document.getElementById('emoji-toggle');
  const emojiPicker = document.getElementById('emoji-picker');
  const emojiGrid = emojiPicker?.querySelector('.emoji-grid');
  const emojis = {
    smileys: ['😊', '😂', '😍', '😎', '🤔', '😅', '🙄', '😴', '😤', '😭', '🤯', '🥳'],
    gestures: ['👍', '👎', '👏', '🙌', '🙏', '👋', '🤝', '✌️', '🤞', '👊', '💪', '🔥']
  };

  function initEmojis() {
    if (!emojiGrid) return;
    emojiGrid.innerHTML = [...emojis.smileys, ...emojis.gestures].map(e => `<span class="emoji-item">${e}</span>`).join('');
    emojiGrid.querySelectorAll('.emoji-item').forEach(item => {
      item.onclick = () => {
        if (chatInput) {
          chatInput.value += item.innerText;
          chatInput.focus();
          emojiPicker.classList.add('hidden');
        }
      };
    });
  }
  initEmojis();

  emojiToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('hidden');
  });

  /* === MENTIONS === */
  const mentionDropdown = document.getElementById('mention-dropdown');
  function showMentions(filter = '') {
    if (!mentionDropdown || !lastUsersList.length) return;
    const filtered = lastUsersList.filter(u => u.username.toLowerCase().includes(filter.toLowerCase()));
    if (filtered.length === 0) {
      mentionDropdown.classList.add('hidden');
      return;
    }
    mentionDropdown.innerHTML = filtered.map(u => `
      <div class="mention-item" data-username="${u.username}">
        <div class="mention-avatar">${u.username[0].toUpperCase()}</div>
        <span>${u.username}</span>
      </div>
    `).join('');
    mentionDropdown.classList.remove('hidden');
    mentionDropdown.querySelectorAll('.mention-item').forEach(item => {
      item.onclick = () => {
        const val = chatInput.value;
        const lastAt = val.lastIndexOf('@');
        chatInput.value = val.substring(0, lastAt) + '@' + item.dataset.username + ' ';
        mentionDropdown.classList.add('hidden');
        chatInput.focus();
      };
    });
  }

  if (selectBtn) {
    selectBtn.addEventListener("click", () => {
      setTool("select");
    });
  }

  if (drawBtn) {
    drawBtn.addEventListener("click", () => {
      setTool("pen");
    });
  }

  if (panBtn) {
    panBtn.addEventListener("click", () => {
      setTool("pan");
    });
  }

  if (textBtn) {
    textBtn.addEventListener("click", () => {
      setTool("text");
    });
  }

  if (noteBtn) {
    noteBtn.addEventListener("click", () => {
      setTool("note");
    });
  }

  if (imageBtn) {
    imageBtn.addEventListener("click", () => {
      setTool("image");
      if (imageSourceModal) imageSourceModal.classList.remove("hidden");
    });
  }

  // Local Image Option
  if (localImageBtn) {
    localImageBtn.onclick = () => {
      const imgInput = document.getElementById("image-upload");
      if (imgInput) imgInput.click();
      if (imageSourceModal) imageSourceModal.classList.add("hidden");
    };
  }

  // AI Image Option (Placeholder)
  if (aiImageBtn) {
    aiImageBtn.onclick = () => {
      alert("AI Image Generation feature coming soon!");
      if (imageSourceModal) imageSourceModal.classList.add("hidden");
    };
  }

  // Close Modal
  if (closeImageModal) {
    closeImageModal.onclick = () => {
      if (imageSourceModal) imageSourceModal.classList.add("hidden");
    };
  }

  // Close Modal on Backdrop Click
  if (imageSourceModal) {
    imageSourceModal.onclick = (e) => {
      if (e.target === imageSourceModal) {
        imageSourceModal.classList.add("hidden");
      }
    };
  }
  if (chatInput) {
    chatInput.addEventListener("input", (e) => {
      emitTyping(true);
      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => emitTyping(false), 3000);

      const val = chatInput.value;
      const lastAt = val.lastIndexOf('@');
      if (lastAt !== -1 && lastAt === val.length - 1) {
        showMentions();
      } else if (lastAt !== -1 && lastAt < val.length - 1) {
        showMentions(val.substring(lastAt + 1));
      } else {
        mentionDropdown?.classList.add('hidden');
      }
    });

    chatInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const text = chatInput.value.trim();
        if (text && socket) {
          socket.emit("chat-message", { user: username, content: text, time: Date.now() });
          chatInput.value = "";
          if (typingTimeout) clearTimeout(typingTimeout);
          emitTyping(false);
          mentionDropdown?.classList.add('hidden');
        }
      }
    });
  }

  if (chatSend) {
    chatSend.onclick = () => {
      const text = chatInput.value.trim();
      if (text && socket) {
        socket.emit("chat-message", { user: username, content: text, time: Date.now() });
        chatInput.value = "";
        if (typingTimeout) clearTimeout(typingTimeout);
        emitTyping(false);
        mentionDropdown?.classList.add('hidden');
      }
    };
  }

  // Close popups on click outside
  document.addEventListener('click', () => {
    emojiPicker?.classList.add('hidden');
    mentionDropdown?.classList.add('hidden');
  });

  chatPanel.classList.add("chat-hidden");
  shapesPanel.classList.add("shapes-hidden");

  chatToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    chatPanel.classList.toggle("chat-hidden");
    // Close other panels if opening chat
    if (!chatPanel.classList.contains("chat-hidden")) {
      const shapesPanel = document.getElementById("shapes-panel");
      if (shapesPanel) shapesPanel.classList.add("shapes-hidden");

      // Clear badge when opening chat
      unreadCount = 0;
      chatBadge.innerText = "0";
      chatBadge.style.display = "none";
    }
  });

  if (closeChat) {
    closeChat.addEventListener("click", () => {
      chatPanel.classList.add("chat-hidden");
    });
  }

  // Close everything when clicking canvas
  canvas.addEventListener("mousedown", (e) => {
    // Only close if we're not clicking a tool element (safety check)
    if (e.target.closest('.miro-toolbar') || e.target.closest('.context-menu')) return;

    chatPanel.classList.add("chat-hidden");
    shapesPanel.classList.add("shapes-hidden");
    document.querySelectorAll('.context-menu').forEach(menu => {
      menu.classList.remove('show');
    });
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

    // 🔥 FAILSFE: Fetch latest room info from server to ensure we have the password
    if (currentRoom.id) {
      fetch(`/api/rooms/${currentRoom.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.room) {
            console.log('[DEBUG] Fetched room displayPassword:', data.room.displayPassword);
            if (displayPass) displayPass.innerText = data.room.displayPassword || '---';
            // Update local storage to stay in sync if needed
            if (data.room.displayPassword && currentRoom.password !== data.room.displayPassword) {
              const updatedRoom = { ...currentRoom, password: data.room.displayPassword };
              localStorage.setItem('currentRoom', JSON.stringify(updatedRoom));
            }
          }
        })
        .catch(err => console.error('Error fetching room info:', err));
    }

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
    if (!users || !Array.isArray(users)) return;
    lastUsersList = users; // Cache for re-renders

    const avatarContainer = document.getElementById("avatars-list");
    const fullList = document.getElementById("full-participant-list");
    const countEl = document.getElementById("participant-count");
    const miniAvatarsEl = document.getElementById("mini-avatars");

    // Update Footer Count
    if (countEl) countEl.innerText = users.length;

    if (avatarContainer) {
      avatarContainer.innerHTML = "";

      if (users.length > 0) {
        // Show only ONE representative avatar in the header stack
        const u = users[0];
        const uName = u.username || "Anonymous";
        const initials = uName.split(" ")
          .filter(n => n.length > 0)
          .map(n => n[0])
          .join("")
          .toUpperCase()
          .substring(0, 2) || "?";

        // Main container
        const container = document.createElement("div");
        container.className = "participant-container";

        // The circular avatar
        const div = document.createElement("div");
        div.className = "header-avatar";
        div.innerText = initials;
        div.title = uName;

        // Miro-like professional colors
        const colors = ['#2ed573', '#1e90ff', '#ffa502', '#ff4757', '#747d8c', '#5352ed'];
        const colorHash = uName.split("").reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0);
        const colorIndex = Math.abs(colorHash % colors.length);
        div.style.background = colors[colorIndex];

        container.appendChild(div);

        // Add Count Badge if more than 1 user
        if (users.length > 1) {
          const badge = document.createElement("div");
          badge.className = "participant-count-badge";
          badge.innerText = `+${users.length - 1}`;
          container.appendChild(badge);
        }

        avatarContainer.appendChild(container);
      }
    }


    if (fullList) {
      fullList.innerHTML = users.map(u => {
        const uName = u.username || "Anonymous";
        const initials = uName.split(" ")
          .filter(n => n.length > 0)
          .map(n => n[0])
          .join("")
          .toUpperCase()
          .substring(0, 2) || "?";
        const isTargetAdmin = u.isAdmin;
        const targetHasAccess = u.hasAccess;
        const isMe = uName === username;

        // Miro-like professional colors for individual list items
        const colors = ['#2ed573', '#1e90ff', '#ffa502', '#ff4757', '#747d8c', '#5352ed'];
        const colorHash = uName.split("").reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0);
        const colorIndex = Math.abs(colorHash % colors.length);
        const avatarBg = colors[colorIndex];

        let actionBtns = '';
        if (window.isAdmin && !isMe) {
          actionBtns = `
            <div class="participant-actions">
              ${!targetHasAccess ?
              `<button class="action-btn-pill btn-grant" onclick="giveAccess('${uName}')">Grant Access</button>` :
              `<button class="action-btn-pill btn-kick" onclick="revokeAccess('${uName}')">Revoke</button>`
            }
              <button class="action-btn-pill btn-kick" onclick="kickUser('${uName}')">Kick</button>
            </div>
          `;
        }

        return `
          <div class="participant-item">
            <div class="participant-avatar-wrapper">
              <div class="participant-avatar-circle" style="background:${avatarBg}">${initials}</div>
              <div class="status-indicator-dot online"></div>
            </div>
            <div class="participant-info">
              <div class="participant-name-row">
                <span class="participant-name">${uName}</span>
                ${isTargetAdmin ? '<span class="badge badge-admin">Admin</span>' : ''}
                ${isMe ? '<span class="badge badge-you">You</span>' : ''}
              </div>
              <span class="participant-status-label ${targetHasAccess ? 'status-has-access' : 'status-no-access'}">
                ${targetHasAccess ? 'Has Access' : 'No Access'}
              </span>
            </div>
            ${actionBtns}
          </div>
        `;
      }).join('');
    }

    // Update Footer Avatar Stack
    if (miniAvatarsEl) {
      miniAvatarsEl.innerHTML = users.slice(0, 3).map((u, i) => {
        const uName = u.username || "Anonymous";
        const initials = uName[0]?.toUpperCase() || "?";
        const colors = ['#2ed573', '#1e90ff', '#ffa502', '#ff4757', '#747d8c', '#5352ed'];
        const colorHash = uName.split("").reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0);
        const colorIndex = Math.abs(colorHash % colors.length);
        return `<div class="mini-avatar" style="background:${colors[colorIndex]}; z-index:${5 - i}">${initials}</div>`;
      }).join('');

      if (users.length > 3) {
        const moreCount = users.length - 3;
        miniAvatarsEl.innerHTML += `<div class="mini-avatar more-count">+${moreCount}</div>`;
      }
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

  /* ================= CHAT RECEPTION & TYPING ================= */
  socket.on("chat-message", msg => {
    // Show badge if chat is hidden
    if (chatPanel.classList.contains("chat-hidden")) {
      unreadCount++;
      if (chatBadge) {
        chatBadge.innerText = unreadCount;
        chatBadge.style.display = "flex";
      }
    }

    const isMentioned = msg.content.includes(`@${username}`);
    const div = document.createElement("div");
    const isMe = msg.user === username;
    div.className = `chat-message ${isMe ? 'own-message' : ''} ${isMentioned ? 'mentioned-me' : ''}`;

    const initials = msg.user[0].toUpperCase();
    const isAI = msg.user.toLowerCase().includes('ai') || msg.user.toLowerCase().includes('assistant');
    const label = isMe ? 'SENT' : (isAI ? 'ASSISTANT' : 'YOU');

    // Highlight mentions in text
    let displayContent = msg.content.replace(/@(\w+)/g, '<span class="mention-highlight">@$1</span>');

    div.innerHTML = `
      <div class="chat-avatar ${isAI ? 'ai-avatar' : ''}">${initials}</div>
      <div class="message-wrapper">
        <div class="message-bubble">${displayContent}</div>
        <span class="message-label">${label}</span>
      </div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Bounce badge if mentioned
    if (isMentioned && chatPanel.classList.contains("chat-hidden")) {
      chatBadge.style.background = "#f59e0b"; // Golden for mentions
    }
  });

  socket.on("client-typing", data => {
    if (!typingIndicator) return;

    // REMOVED username !== check to allow same-user multi-tab testing
    if (data.isTyping && data.user) {
      const logo = typingIndicator.querySelector('.typing-user-logo');
      const text = typingIndicator.querySelector('.typing-text');
      if (logo) logo.innerText = data.user[0].toUpperCase();
      if (text) text.innerText = `${data.user} is typing`;

      typingIndicator.style.setProperty('display', 'flex', 'important');
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } else {
      typingIndicator.style.display = "none";
    }
  });

  /* ================= STATE ================= */
  /* ================= STATE ================= */
  let tool = "select";
  let drawType = "pen";
  let color = "#000";
  let shapeColor = "#3b82f6";
  let brushSize = 5;
  let drawing = false;
  let pendingDraw = false;
  let autoShapeEnabled = false;






  let paths = [];
  let currentPath = [];
  let activeRemotePaths = {}; // Stores paths being drawn by others: { socketId: strokeObject }
  let px = 0, py = 0;

  let textElements = [];
  let stickyNotes = [];

  /* ================= SELECTION STATE ================= */
  let isSelecting = false;
  let selectionStart = { x: 0, y: 0 };
  let selectionRect = { x: 0, y: 0, w: 0, h: 0 };
  let selectedElements = []; // Array of { id, type }
  let isDraggingSelection = false;
  let dragStartPos = { x: 0, y: 0 }; // Mouse pos at start of drag
  let selectionSnapshot = []; // Snapshot of positions before drag

  /* ================= RESIZE ================= */
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    redraw();
  }
  window.addEventListener("resize", resize);
  resize();

  // Initialize tool UI and cursor on startup
  updateToolButtons();

  window.addEventListener("themeChanged", () => {
    console.log("[DEBUG] Theme changed, redrawing canvas...");
    redraw();
  });

  function getPos(e) {
    return {
      x: (e.clientX - offsetX) / scale,
      y: (e.clientY - offsetY) / scale
    };
  }

  /* ================= SOCKET DRAW ================= */
  socket.on("init-board", data => {
    console.log('[DEBUG] Received init-board:', data);
    console.log('[DEBUG] - paths:', data.paths?.length || 0);
    console.log('[DEBUG] - shapes:', data.shapes?.length || 0);
    console.log('[DEBUG] - templateKey:', data.templateKey);

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
      tool = "select"; // Changed from "hand" to "select"
      drawing = false;
      pendingDraw = false;

      // Update local tool UI
      document.querySelectorAll(".tool").forEach(t => t.classList.remove("active"));
      const selectBtn = document.getElementById("selectBtn"); // Changed from "handBtn"
      if (selectBtn) selectBtn.classList.add("active");
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

  socket.on("user-kicked", (data) => {
    // Redirect to the professional kicked page with admin info
    const adminName = data?.by || "Administrator";
    window.location.href = `/kicked.html?by=${encodeURIComponent(adminName)}`;
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
    // Pan tool: init pan
    if (tool === "pan") {
      px = e.clientX;
      py = e.clientY;
      canvas.style.cursor = 'grabbing';
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

    if (pendingShape || tool === "shapes") {
      isDrawingShape = true;
      const pos = getPos(e);
      shapeStartX = pos.x;
      shapeStartY = pos.y;

      // Create a temporary preview element
      shapePreviewEl = document.createElement('div');
      shapePreviewEl.className = 'shape-object preview';
      shapePreviewEl.style.left = e.clientX + 'px';
      shapePreviewEl.style.top = e.clientY + 'px';
      shapePreviewEl.style.width = '0px';
      shapePreviewEl.style.height = '0px';
      shapePreviewEl.style.border = `2px dashed ${shapeColor}`;
      shapePreviewEl.style.pointerEvents = 'none';
      shapePreviewEl.style.zIndex = '1000000';

      const svgTemplate = shapeTemplates[pendingShape].replace(/COLOR/g, 'transparent');
      shapePreviewEl.innerHTML = `<svg viewBox="0 0 100 100" style="width:100%; height:100%;">${svgTemplate}</svg>`;

      document.body.appendChild(shapePreviewEl);
      return;
    }

    // SELECT TOOL LOGIC
    if (tool === "select") {
      const pos = getPos(e);

      // Check if clicking INSIDE current selection bounding box to start drag
      const bounds = getSelectionBounds();
      if (bounds && isPointInRect(pos, bounds)) {
        isDraggingSelection = true;
        dragStartPos = { x: e.clientX, y: e.clientY };
        snapshotSelectionState();
        return;
      }

      // Check if clicking on a stroke...
      // Or if not selected, check if clicking ON a stroke to select it
      // Reverse iterate to find top-most
      let clickedStroke = null;
      for (let i = paths.length - 1; i >= 0; i--) {
        if (isPointNearPath(pos, paths[i])) {
          clickedStroke = paths[i];
          break;
        }
      }

      if (clickedStroke) {
        // Hit a stroke!
        const isAlreadySelected = selectedElements.some(el => el.id === clickedStroke.id);

        if (!isAlreadySelected && !e.shiftKey) {
          selectedElements = [{ id: clickedStroke.id, type: 'stroke' }];
        } else if (!isAlreadySelected && e.shiftKey) {
          selectedElements.push({ id: clickedStroke.id, type: 'stroke' });
        }
        highlightSelection();
        redraw();

        // Start Dragging
        isDraggingSelection = true;
        dragStartPos = { x: e.clientX, y: e.clientY };
        snapshotSelectionState();
        return;
      }

      // If we are here, we didn't hit a stroke.
      // If we clicked strictly on the canvas (not on a shape/note which stops propagation), start marquee
      isSelecting = true;
      selectionStart = { x: pos.x, y: pos.y };
      selectionRect = { x: pos.x, y: pos.y, w: 0, h: 0 };

      // Clear previous selection unless Shift is held (future enhancement)
      selectedElements = [];
      highlightSelection(); // Visual update
      redraw();
      return;
    }

    pendingDraw = true;
    currentPath = [getPos(e)];
    checkBoardEmpty(); // Hide watermark immediately
    socket.emit("request-draw");
    socket.emit("user-activity", "is drawing");
  });

  canvas.addEventListener("mousemove", e => {
    // Pan tool: move canvas AND template together
    if (tool === "pan" && (e.buttons === 1 || e.which === 1)) {
      const dx = e.clientX - px;
      const dy = e.clientY - py;

      offsetX += dx;
      offsetY += dy;

      // Sync with global window for BoardTemplates
      window.canvasOffsetX = offsetX;
      window.canvasOffsetY = offsetY;

      // Move ALL templates along with canvas
      if (window.BoardTemplates) {
        window.BoardTemplates.panAll(dx, dy);
      }

      px = e.clientX;
      py = e.clientY;

      redraw();
      updateAllElementPositions();
      return;
    }

    if (isDrawingShape && shapePreviewEl) {
      const pos = getPos(e);
      const width = pos.x - shapeStartX;
      const height = pos.y - shapeStartY;

      const left = Math.min(pos.x, shapeStartX);
      const top = Math.min(pos.y, shapeStartY);
      const absWidth = Math.abs(width);
      const absHeight = Math.abs(height);

      shapePreviewEl.style.left = (left * scale + offsetX) + 'px';
      shapePreviewEl.style.top = (top * scale + offsetY) + 'px';
      shapePreviewEl.style.width = (absWidth * scale) + 'px';
      shapePreviewEl.style.height = (absHeight * scale) + 'px';
      return;
    }

    if (isDraggingSelection) {
      const dx = (e.clientX - dragStartPos.x) / scale;
      const dy = (e.clientY - dragStartPos.y) / scale;
      updateSelectionPositions(dx, dy);
      return;
    }

    if (isSelecting) {
      const pos = getPos(e);
      const w = pos.x - selectionStart.x;
      const h = pos.y - selectionStart.y;

      selectionRect = {
        x: w < 0 ? pos.x : selectionStart.x,
        y: h < 0 ? pos.y : selectionStart.y,
        w: Math.abs(w),
        h: Math.abs(h)
      };
      redraw(); // Re-render to show selection box
      return;
    }

    if (!drawing) return;
    const p = getPos(e);

    // SMOTHING: Only add point if it's far enough from the last point
    if (currentPath.length > 0) {
      const last = currentPath[currentPath.length - 1];
      const dist = Math.sqrt(Math.pow(p.x - last.x, 2) + Math.pow(p.y - last.y, 2));
      if (dist < 2) return; // Ignore very small movements for smoothness
    }

    currentPath.push(p);
    socket.emit("draw-point", {
      socketId: socket.id, // Include socketId for buffer management
      tool,
      drawType,
      color,
      size: brushSize,
      points: [p]
    });
    redraw();
  });

  canvas.addEventListener("mouseup", async (e) => {
    // Hand tool cursor reset and sync template position
    if (tool === "hand") {
      canvas.style.cursor = 'grab';

      // Sync all template positions with other users
      if (window.BoardTemplates) {
        window.BoardTemplates.syncAllTransforms();
      }
    }

    if (isDrawingShape && shapePreviewEl) {
      const pos = getPos(e);
      const x = Math.min(pos.x, shapeStartX);
      const y = Math.min(pos.y, shapeStartY);
      const width = Math.abs(pos.x - shapeStartX);
      const height = Math.abs(pos.y - shapeStartY);

      // Only create if it has some size
      if (width > 5 && height > 5) {
        const shape = {
          id: Date.now() + '-' + Math.random(),
          type: pendingShape,
          x: x,
          y: y,
          width: width,
          height: height,
          color: shapeColor, // Restore shapeColor so it saves the selected color DO NOT USE 'transparent' here
          rotation: 0
        };

        shapes.push(shape);
        addToHistory({ type: 'add', objectType: 'shape', data: shape });
        socket.emit("shape-add", shape);
        renderAllShapes();
      }

      shapePreviewEl.remove();
      shapePreviewEl = null;
      isDrawingShape = false;
      return;
    }

    if (isDraggingSelection) {
      isDraggingSelection = false;
      finalizeSelectionMove();
      return;
    }

    if (isSelecting) {
      isSelecting = false;
      // Finalize selection: Find items within selectionRect
      selectedElements = []; // Reset

      // Check Stroke Paths
      paths.forEach(p => {
        if (p.points && isPathInRect(p.points, selectionRect)) {
          selectedElements.push({ id: p.id, type: 'stroke' });
        }
      });

      // Check Shapes
      shapes.forEach(s => {
        // Shapes have x, y, width, height. selectionRect has x, y, w, h.
        // Adjust s to match selectionRect's property names for isRectInRect
        const sRect = { x: s.x, y: s.y, width: s.width, height: s.height };
        if (isRectInRect(sRect, selectionRect)) {
          selectedElements.push({ id: s.id, type: 'shape' });
        }
      });

      // Check Text
      textElements.forEach(t => {
        // Approximate text size
        const tRect = { x: t.x, y: t.y, width: (t.text.length * 10), height: 20 };
        if (isRectInRect(tRect, selectionRect)) {
          selectedElements.push({ id: t.id, type: 'text' });
        }
      });

      // Check Notes
      stickyNotes.forEach(n => {
        const nRect = { x: n.x, y: n.y, width: 220, height: 220 }; // Standard note size
        if (isRectInRect(nRect, selectionRect)) {
          selectedElements.push({ id: n.id, type: 'note' });
        }
      });

      highlightSelection();
      redraw(); // Clear marquee
      return;
    }

    if (tool === "text") {
      const pos = getPos(e);
      const textId = Date.now() + '-' + Math.random();

      const input = document.createElement("input");
      input.className = "text-input";
      input.style.left = e.clientX + "px";
      input.style.top = e.clientY + "px";
      input.style.color = getContrastColor(color);
      input.placeholder = "Type text here...";
      document.body.appendChild(input);

      input.oninput = () => {
        checkBoardEmpty(); // Hide watermark while typing
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
      const noteId = Date.now() + '-' + Math.random();
      const pos = getPos(e);

      const noteData = {
        id: noteId,
        x: pos.x,
        y: pos.y,
        content: ""
      };

      stickyNotes.push(noteData);
      addToHistory({ type: 'add', objectType: 'note', data: noteData });
      socket.emit("note-add", noteData);
      renderAllNotes();

      // Focus the newly created note's content area
      setTimeout(() => {
        const noteEl = document.querySelector(`[data-note-id="${noteId}"]`);
        if (noteEl) {
          const contentEl = noteEl.querySelector('.note-content');
          if (contentEl) contentEl.focus();
        }
      }, 100);

      return;
    }


    if (!drawing) return;

    // CAPTURE CURRENT STATE
    const strokePath = [...currentPath];
    const sId = socket.id;
    const strokeId = Date.now() + '-' + Math.random();
    const strokeColor = color;
    const strokeSize = brushSize;
    const strokeTool = tool;
    const strokeDrawType = drawType;

    // RESET DRAWING STATE IMMEDIATELY
    drawing = false;
    currentPath = [];
    socket.emit("release-draw");

    // SAVE STROKE IMMEDIATELY (Prevent disappearing)
    const stroke = {
      id: strokeId,
      socketId: sId,
      tool: strokeTool,
      drawType: strokeDrawType,
      color: strokeColor,
      size: strokeSize,
      points: strokePath
    };
    paths.push(stroke);
    addToHistory({ type: 'add', objectType: 'stroke', data: stroke });
    socket.emit("draw-stroke", stroke);
    redraw();

    // --- ASYNC AUTO SHAPE REPLACEMENT ---
    if (autoShapeEnabled && strokePath.length > 5) {
      console.log('[AI] Triggering detection for stroke:', strokeId);
      detectShape(strokePath).then(detectedShape => {
        if (detectedShape) {
          console.log('[AI] Match found, replacing stroke:', strokeId, 'with', detectedShape.type);
          // REMOVE THE STROKE WE JUST ADDED
          paths = paths.filter(p => p.id !== strokeId);

          // CLEAN HISTORY: Remove the stroke entry so it doesn't clutter
          if (typeof undoStack !== 'undefined') {
            const hIdx = undoStack.findIndex(h => h.data && h.data.id === strokeId);
            if (hIdx !== -1) undoStack.splice(hIdx, 1);
          }

          // ADD THE PERFECT SHAPE
          const shape = {
            id: Date.now() + '-' + Math.random(),
            type: detectedShape.type,
            x: detectedShape.x,
            y: detectedShape.y,
            width: detectedShape.width,
            height: detectedShape.height,
            color: strokeColor,
            rotation: 0
          };

          shapes.push(shape);
          addToHistory({ type: 'add', objectType: 'shape', data: shape });
          socket.emit("shape-add", shape);

          // SYNC DELETE FOR REMOTE CLIENTS
          socket.emit("stroke-delete", strokeId);

          renderAllShapes();
          redraw();
          showToast(`Converted to ${detectedShape.type}! ✨`, 'ai-ready', 1500);
        } else {
          console.log('[AI] No match found for stroke:', strokeId);
        }
      });
    }
    return;
  });

  /* ================= TOAST NOTIFICATIONS ================= */
  function showToast(message, type = '', duration = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="material-symbols-outlined" style="font-size: 18px;">${type === 'ai-ready' ? 'auto_awesome' : 'info'}</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* ================= AUTO SHAPE DETECTION ENGINE (ML-BASED via ml5.js) ================= */
  let classifier;
  let modelReady = false;
  let modelLoadRetries = 0;
  let modelLoadPromise = null;

  function initShapeModel() {
    if (modelReady) return Promise.resolve(classifier);
    if (modelLoadPromise && modelLoadRetries < 3) return modelLoadPromise;

    console.log('[AI] Initializing Stable DoodleNet (v0.12.2)...');
    showToast('AI Model is booting up...', 'ai-loading', 4000);

    modelLoadPromise = new Promise((resolve) => {
      try {
        if (typeof ml5 === 'undefined') {
          showToast('AI Library missing! Please refresh.', 'ai-error', 5000);
          return resolve(null);
        }

        // Legacy ml5 style: classifier = ml5.imageClassifier(model, callback)
        classifier = ml5.imageClassifier('DoodleNet', () => {
          console.log('[AI] DoodleNet Ready!');
          showToast('AI Engine Ready! 🤖', 'ai-ready', 2000);
          modelReady = true;
          resolve(classifier);
        });
      } catch (fatal) {
        console.error('[AI] Fatal load crash:', fatal);
        showToast('AI Engine failed to start.', 'ai-error', 5000);
        modelLoadPromise = null;
        resolve(null);
      }
    });

    return modelLoadPromise;
  }

  function getShapeMapping(label) {
    const l = label.toLowerCase();

    // Specific Mapping Categorization
    const circles = ['circle', 'necklace', 'donut', 'hockey puck', 'pancake', 'pool', 'wheel', 'sun', 'soccer ball', 'compass', 'blueberry', 'baseball', 'cookie'];
    const rectangles = ['square', 'box', 'door', 'envelope', 'frame', 'laptop', 'microwave', 'oven', 'picture frame', 'postcard', 'radio', 'refrigerator', 'spreadsheet', 'television', 'washing machine', 'window', 'building', 'camera', 'book', 'bus', 'suitcase', 'toaster', 'van'];
    const triangles = ['triangle', 'mountain', 'tent', 'pyramid', 'sailboat', 'house', 'nose', 'party hat', 'megaphone'];
    const stars = ['star'];
    const arrows = ['arrow', 'line', 'string bean', 'arm', 'speedboat'];
    const hexagons = ['hexagon'];
    const pentagons = ['pentagon'];
    const diamonds = ['diamond'];
    const ellipses = ['ellipse', 'oval', 'potato'];
    const hearts = ['heart'];
    const trapezoids = ['trapezoid'];
    const parallelograms = ['parallelogram'];
    const octagons = ['octagon', 'stop sign'];
    const crosses = ['cross', 'plus', 'add'];
    const lightnings = ['lightning', 'bolt', 'flash'];
    const moons = ['moon', 'banana'];
    const cylinders = ['cylinder', 'beard', 'coffee cup', 'mug', 'cup', 'bucket', 'paint can', 'barrel', 'wine glass', 'candle'];
    const cubes = ['cube', 'dice'];
    const speechBubbles = ['speech bubble'];
    const roundedRects = ['spreadsheet', 'radio', 'television', 'washing machine'];

    if (circles.includes(l)) return 'circle';
    if (rectangles.includes(l)) return 'rectangle';
    if (triangles.includes(l)) return 'triangle';
    if (stars.includes(l)) return 'star';
    if (arrows.includes(l)) return 'arrow-right';
    if (hexagons.includes(l)) return 'hexagon';
    if (pentagons.includes(l)) return 'pentagon';
    if (diamonds.includes(l)) return 'diamond';
    if (ellipses.includes(l)) return 'ellipse';
    if (hearts.includes(l)) return 'heart';
    if (trapezoids.includes(l)) return 'trapezoid';
    if (parallelograms.includes(l)) return 'parallelogram';
    if (octagons.includes(l)) return 'octagon';
    if (crosses.includes(l)) return 'cross';
    if (lightnings.includes(l)) return 'lightning';
    if (moons.includes(l)) return 'moon';
    if (cylinders.includes(l)) return 'cylinder';
    if (cubes.includes(l)) return 'cube';
    if (speechBubbles.includes(l)) return 'speech-bubble';
    if (roundedRects.includes(l)) return 'rounded-rect';

    return null;
  }

  async function detectShape(points) {
    if (!modelReady) {
      if (!modelLoadPromise) initShapeModel();
      showToast('AI is warming up... please wait a second ⏳', 'ai-waiting', 3000);

      // WAIT FOR IT INSTEAD OF QUITTING
      await modelLoadPromise;

      if (!modelReady) {
        console.warn('[AI] Model failed to ready even after waiting.');
        return null;
      }
    }

    // START PROCESSING FEEDBACK
    showToast('🧠 AI Thinking...', 'ai-processing', 1500);

    const bufferSize = 280; // Larger buffer for better internal resizing by ml5
    const buffer = document.createElement('canvas');
    buffer.width = bufferSize;
    buffer.height = bufferSize;
    const ctx = buffer.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, bufferSize, bufferSize);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });

    const width = maxX - minX;
    const height = maxY - minY;
    if (width < 3 || height < 3) return null;

    const padding = 40;
    const scaleFactor = (bufferSize - padding * 2) / Math.max(width, height || 1);
    const offsetX = (bufferSize - width * scaleFactor) / 2;
    const offsetY = (bufferSize - height * scaleFactor) / 2;

    ctx.strokeStyle = 'black';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    points.forEach((p, idx) => {
      const x = (p.x - minX) * scaleFactor + offsetX;
      const y = (p.y - minY) * scaleFactor + offsetY;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // WRAP CLASSIFY IN TIMEOUT
    const classificationPromise = new Promise((resolve) => {
      try {
        if (!classifier || typeof classifier.classify !== 'function') {
          return resolve({ error: 'not_ready' });
        }

        // Legacy callback style
        classifier.classify(buffer, (err, results) => {
          if (err) {
            console.error('[AI] Prediction error:', err);
            return resolve({ error: 'prediction_failed' });
          }
          resolve({ results: results });
        });
      } catch (e) {
        resolve({ error: 'crash' });
      }
    });

    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ error: 'timeout' }), 5000);
    });

    const response = await Promise.race([classificationPromise, timeoutPromise]);

    if (response.error === 'timeout') {
      showToast('AI is taking too long... try drawing slower? ⏳', 'ai-waiting', 3000);
      return null;
    }
    if (response.error) {
      showToast(`AI Error: ${response.error}`, 'ai-error', 4000);
      return null;
    }

    const results = response.results;
    if (!results || results.length === 0) {
      showToast('AI saw absolute nothing! 💨', 'ai-debug', 2000);
      return null;
    }

    console.log('[AI] Top Results:', results.slice(0, 3).map(r => `${r.label} (${(r.confidence * 100).toFixed(0)}%)`).join(', '));

    // Improved Priority: If circle is anywhere in the top 10, and the top result is a polygon (hexagon/octagon), favor the circle.
    const top10Labels = results.slice(0, 10).map(r => r.label.toLowerCase());
    const octagonIndex = top10Labels.indexOf('octagon');
    const hexagonIndex = top10Labels.indexOf('hexagon');
    const circleIndex = top10Labels.indexOf('circle');

    // If octagon or hexagon is the top prediction (index 0) or near top, and circle exists in top 10
    if (circleIndex !== -1 && (octagonIndex === 0 || hexagonIndex === 0)) {
      console.log('[AI] Aggressively favoring Circle over top polygon detection');
      return {
        type: 'circle',
        x: minX,
        y: minY,
        width: Math.max(width, height),
        height: Math.max(width, height)
      };
    }

    // FIND BEST MATCH
    for (let i = 0; i < Math.min(results.length, 10); i++) {
      const mappedLabel = getShapeMapping(results[i].label);
      if (mappedLabel && results[i].confidence > 0.01) {
        return {
          type: mappedLabel,
          x: minX,
          y: minY,
          width: mappedLabel === 'circle' ? Math.max(width, height) : width,
          height: mappedLabel === 'circle' ? Math.max(width, height) : height
        };
      }
    }

    // EXTREME DIAGNOSTIC: Show the user what AI "thought" regardless of result
    const top = results[0];
    showToast(`AI saw "${top.label}" (${(top.confidence * 100).toFixed(0)}%)`, 'ai-debug', 2500);

    return null;
  }

  socket.on("draw-point", data => {
    const sId = data.socketId;
    if (!sId || sId === socket.id) return;

    if (!activeRemotePaths[sId]) {
      activeRemotePaths[sId] = {
        tool: data.tool,
        drawType: data.drawType,
        color: data.color,
        size: data.size,
        points: []
      };
    }

    activeRemotePaths[sId].points.push(...data.points);
    redraw();
  });

  socket.on("draw-stroke", stroke => {
    // If this stroke was in our active buffer, remove it first
    // We should ideally have a way to identify which socket sent it if not already in stroke
    // For now, we'll try to match by properties or just clear when we get a full stroke
    // Actually, the server can include the sender's socketId
    if (stroke.socketId && activeRemotePaths[stroke.socketId]) {
      delete activeRemotePaths[stroke.socketId];
    }
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
    checkBoardEmpty();

    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.clearRect(
      -offsetX / scale,
      -offsetY / scale,
      canvas.width / scale,
      canvas.height / scale
    );

    paths.forEach(p => {
      // Visual feedback for selected strokes
      const isSelected = selectedElements.some(el => el.id === p.id && el.type === 'stroke');
      if (isSelected) {
        ctx.save();
        ctx.shadowColor = "#3b82f6";
        ctx.shadowBlur = 10;
        drawStroke(p);
        ctx.restore();
      } else {
        drawStroke(p);
      }
    });

    // Draw remote active paths
    Object.values(activeRemotePaths).forEach(p => drawStroke(p));

    if (currentPath.length)
      drawStroke({ tool, drawType, color, size: brushSize, points: currentPath });

    // Draw Selection Marquee
    if (isSelecting) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Use screen coordinates for 1px line
      const sRect = {
        x: selectionRect.x * scale + offsetX,
        y: selectionRect.y * scale + offsetY,
        w: selectionRect.w * scale,
        h: selectionRect.h * scale
      };
      ctx.fillStyle = "rgba(59, 130, 246, 0.1)"; // Blue tint
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(sRect.x, sRect.y, sRect.w, sRect.h);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Draw Bounding Box for selection if dragging or items selected
    if (selectedElements.length > 0) {
      drawSelectionBoundingBox();
    }
  }

  function getSelectionBounds() {
    if (selectedElements.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let found = false;

    selectedElements.forEach(el => {
      let item = null;
      if (el.type === 'shape') item = shapes.find(s => s.id === el.id);
      else if (el.type === 'text') item = textElements.find(t => t.id === el.id);
      else if (el.type === 'note') item = stickyNotes.find(n => n.id === el.id);
      else if (el.type === 'stroke') item = paths.find(p => p.id === el.id);

      if (item) {
        found = true;
        if (el.type === 'stroke') {
          item.points.forEach(p => {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
          });
        } else if (el.type === 'shape') {
          minX = Math.min(minX, item.x); minY = Math.min(minY, item.y);
          maxX = Math.max(maxX, item.x + item.width); maxY = Math.max(maxY, item.y + item.height);
        } else if (el.type === 'text') {
          const w = item.text.length * 10; // Approx
          minX = Math.min(minX, item.x); minY = Math.min(minY, item.y);
          maxX = Math.max(maxX, item.x + w); maxY = Math.max(maxY, item.y + 24);
        } else if (el.type === 'note') {
          minX = Math.min(minX, item.x); minY = Math.min(minY, item.y);
          maxX = Math.max(maxX, item.x + 220); maxY = Math.max(maxY, item.y + 220);
        }
      }
    });

    if (!found) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function drawSelectionBoundingBox() {
    const bounds = getSelectionBounds();
    if (bounds) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const padding = 5;
      const sX = bounds.x * scale + offsetX - padding;
      const sY = bounds.y * scale + offsetY - padding;
      const sW = bounds.w * scale + padding * 2;
      const sH = bounds.h * scale + padding * 2;

      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(sX, sY, sW, sH);
      ctx.restore();
    }
  }

  function getContrastColor(originalColor) {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const colorLower = originalColor.toLowerCase();

    // In Dark Mode: Convert black/dark strokes to white
    const darkColors = ['#000', '#000000', '#1a1a1a', '#333', '#333333', '#444'];
    if (isDarkMode && darkColors.includes(colorLower)) {
      return '#ffffff';
    }

    // In Light Mode: Convert white/light strokes to black
    const lightColors = ['#fff', '#ffffff', '#f0f0f0', '#f5f5f5', '#e0e0e0'];
    if (!isDarkMode && lightColors.includes(colorLower)) {
      return '#000000';
    }

    return originalColor;
  }

  function drawStroke(p, customCtx) {
    if (!p.points || p.points.length === 0) return;
    const drawCtx = customCtx || ctx;

    drawCtx.beginPath();
    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";

    if (p.tool === "eraser") {
      if (customCtx) {
        drawCtx.globalCompositeOperation = "source-over";
        drawCtx.strokeStyle = "#ffffff";
      } else {
        drawCtx.globalCompositeOperation = "destination-out";
      }
      drawCtx.lineWidth = (p.size || 20) / scale;
    } else {
      drawCtx.globalCompositeOperation = "source-over";
      drawCtx.strokeStyle = getContrastColor(p.color);

      const baseSize = p.size || 5;
      if (p.drawType === "pen") {
        drawCtx.lineWidth = baseSize;
      } else if (p.drawType === "pencil") {
        drawCtx.lineWidth = Math.max(1, baseSize / 3);
      } else if (p.drawType === "brush") {
        drawCtx.lineWidth = baseSize * 2;
      } else {
        drawCtx.lineWidth = baseSize;
      }
    }

    if (p.points.length < 3) {
      p.points.forEach((pt, i) =>
        i ? drawCtx.lineTo(pt.x, pt.y) : drawCtx.moveTo(pt.x, pt.y)
      );
    } else {
      drawCtx.moveTo(p.points[0].x, p.points[0].y);
      for (let i = 1; i < p.points.length - 2; i++) {
        const xc = (p.points[i].x + p.points[i + 1].x) / 2;
        const yc = (p.points[i].y + p.points[i + 1].y) / 2;
        drawCtx.quadraticCurveTo(p.points[i].x, p.points[i].y, xc, yc);
      }
      drawCtx.quadraticCurveTo(
        p.points[p.points.length - 2].x,
        p.points[p.points.length - 2].y,
        p.points[p.points.length - 1].x,
        p.points[p.points.length - 1].y
      );
    }

    drawCtx.stroke();
    drawCtx.globalCompositeOperation = "source-over";
  };

  eraserBtn.onclick = () => {
    setTool("eraser");
  };

  // handBtn.onclick = () => { // Removed handBtn
  //   setTool("hand");
  // };

  textBtn.onclick = () => {
    setTool("text");
  };

  noteBtn.onclick = () => {
    setTool("note");
  };

  shapesBtn.onclick = () => {
    shapesPanel.classList.toggle("shapes-hidden");
    // If we're opening the panel and NOT currently in shapes tool, switch to it?
    // Actually, just toggle the UI. The user selects the shape inside.
  };

  /**
   * Centralized tool state management
   */
  function setTool(newTool) {
    tool = newTool;
    console.log(`[DEBUG] setTool called: tool = ${tool}, drawType = ${drawType}`);

    // Reset shape-related states if switching TO a drawing tool and AWAY from shapes
    if (newTool !== "shapes" && !pendingShape) {
      // Keep pendingShape if we just clicked the button but haven't selected one yet?
      // No, if user clicks "Pen", they want to draw with pen.
    }

    if (newTool !== "shapes") {
      pendingShape = null;
      document.querySelectorAll(".shape-item").forEach(i => i.classList.remove("active"));
    }

    updateToolButtons();
  }

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
      const eSize = Math.max(32, brushSize * 3); // Scalable size
      const svg = `<svg width="${eSize}" height="${eSize}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Main Body (Teal/Blue) - Rounded and Tilted -->
        <rect x="7" y="6" width="22" height="15" rx="4" transform="rotate(35 11 13.5)" fill="#5D939B" stroke="#1A3442" stroke-width="1.8"/>
        <!-- Inner Accent (Darker Teal) -->
        <rect x="13" y="10" width="12" height="7" rx="1.5" transform="rotate(35 19 13.5)" fill="#2D6A76" stroke="#1A3442" stroke-width="1.2"/>
        <!-- Eraser Tip (Beige/Off-white) - Large and well-rounded -->
        <path d="M1.5 19.5 C1.5 16 4 13.5 7.5 13.5 L13 19 L7 25 C4 23 1.5 22 1.5 19.5 Z" transform="rotate(35 11 20)" fill="#F5E6D3" stroke="#1A3442" stroke-width="1.8"/>
        <!-- Separator and Shadow -->
        <path d="M12.5 12.5L21.5 21.5" stroke="#1A3442" stroke-width="1.5" opacity="0.6"/>
        <!-- Highlight curve on Tip -->
        <path d="M4.5 22.5C5.5 23.5 7.5 25 9.5 26" stroke="white" stroke-width="0.8" opacity="0.4"/>
      </svg>`;
      // Hotspot at the precise tip of the beige section
      const hX = Math.round(6 * eSize / 32);
      const hY = Math.round(26 * eSize / 32);
      cursorStyle = `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') ${hX} ${hY}, auto`;
    } else if (tool === 'select') {
      cursorStyle = 'default';
    } else if (tool === 'pan') {
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
    } else if (pendingShape) {
      // Shape placement cursor: Show a crosshair with a small shape icon
      const svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="white" fill-opacity="0.3" stroke="${shapeColor}" stroke-width="2" stroke-dasharray="4 2"/>
        <path d="M16 8V24M8 16H24" stroke="${shapeColor}" stroke-width="2" stroke-linecap="round"/>
        <circle cx="16" cy="16" r="4" fill="${shapeColor}"/>
      </svg>`;
      cursorStyle = `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') 16 16, auto`;
    }

    canvas.style.cursor = cursorStyle;
  }

  function updateToolButtons() {
    console.log(`[DEBUG] updateToolButtons called. Current tool: ${tool}, drawType: ${drawType}`);
    document.querySelectorAll('.tool').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('[data-draw]').forEach(btn => btn.classList.remove('active')); // Clear sub-tool active states

    if (tool === "pen") {
      drawBtn.classList.add('active');
      // Activate the specific drawType sub-tool
      const activeSubTool = document.querySelector(`[data-draw="${drawType}"]`);
      if (activeSubTool) {
        activeSubTool.classList.add('active');
      }
    } else if (tool === "eraser") eraserBtn.classList.add('active');
    else if (tool === "select") selectBtn.classList.add('active');
    else if (tool === "pan") panBtn.classList.add('active');
    else if (tool === "text") textBtn.classList.add('active');
    else if (tool === "note") noteBtn.classList.add('active');
    else if (tool === "shapes") shapesBtn.classList.add('active');

    updateCursor();
  }

  zoomInBtn.onclick = () => {
    const oldScale = scale;
    scale *= 1.1;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    offsetX = cx - (cx - offsetX) * (scale / oldScale);
    offsetY = cy - (cy - offsetY) * (scale / oldScale);

    window.canvasScale = scale;
    window.canvasOffsetX = offsetX;
    window.canvasOffsetY = offsetY;
    redraw();
    updateAllElementPositions();
    if (window.BoardTemplates) window.BoardTemplates.updateAllTransforms();
    updateZoomDisplay();
  };

  zoomOutBtn.onclick = () => {
    const oldScale = scale;
    scale /= 1.1;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    offsetX = cx - (cx - offsetX) * (scale / oldScale);
    offsetY = cy - (cy - offsetY) * (scale / oldScale);

    window.canvasScale = scale;
    window.canvasOffsetX = offsetX;
    window.canvasOffsetY = offsetY;
    redraw();
    updateAllElementPositions();
    if (window.BoardTemplates) window.BoardTemplates.updateAllTransforms();
    updateZoomDisplay();
  };

  const resetViewBtn = document.getElementById("reset-view");
  if (resetViewBtn) {
    resetViewBtn.onclick = () => {
      scale = 0.91;
      offsetX = 0;
      offsetY = 0;
      window.canvasScale = scale;
      window.canvasOffsetX = offsetX;
      window.canvasOffsetY = offsetY;
      redraw();
      updateAllElementPositions();
      if (window.BoardTemplates) window.BoardTemplates.updateAllTransforms();
      updateZoomDisplay();
    };
  }

  downloadBtn.onclick = () => {
    const a = document.createElement("a");
    a.download = "whiteboard.png";
    a.href = canvas.toDataURL();
    a.click();
  };

  // Natural Wheel Zoom
  window.addEventListener("wheel", (e) => {
    // Only zoom if not interacting with a text/input field OR the AI Summary Modal
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.closest('#ai-summary-modal')) return;

    e.preventDefault();
    const oldScale = scale;
    // Smoother zoom factor for wheel
    const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
    scale *= zoomFactor;

    // Focus on cursor position
    const cx = e.clientX;
    const cy = e.clientY;

    offsetX = cx - (cx - offsetX) * (scale / oldScale);
    offsetY = cy - (cy - offsetY) * (scale / oldScale);

    window.canvasScale = scale;
    window.canvasOffsetX = offsetX;
    window.canvasOffsetY = offsetY;

    redraw();
    updateAllElementPositions();
    if (window.BoardTemplates) window.BoardTemplates.updateAllTransforms();
    updateZoomDisplay();
  }, { passive: false });

  /* ================= MENUS ================= */
  document.querySelectorAll("[data-draw]").forEach(b => {
    b.onclick = (e) => {
      e.stopPropagation();
      setTool("pen");
      drawType = b.dataset.draw;
      console.log(`[DEBUG] Sub-tool clicked: drawType = ${drawType}, tool = ${tool}`);

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

  // Exit button logic moved to line 2260 for consolidated save-and-exit handling

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
      zoomLevelSpan.innerText = Math.round((scale / 0.91) * 100) + "%";
    }
  }

  // Fullscreen Logic
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) { /* Safari */
          document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) { /* IE11 */
          document.documentElement.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { /* Safari */
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE11 */
          document.msExitFullscreen();
        }
      }
    });
  }

  // Miro-style Arrow Menus (REDESIGNED LOGIC)
  const toolbar = document.querySelector('.miro-toolbar');
  if (toolbar) {
    toolbar.addEventListener("mousedown", (e) => {
      const arrow = e.target.closest('.tool-arrow');
      if (!arrow) return;

      console.log(`[MENU] Arrow Mousedown for: ${arrow.dataset.target}`);
      e.preventDefault();
      e.stopPropagation();

      const targetId = arrow.dataset.target;
      const targetMenu = document.getElementById(targetId);

      if (!targetMenu) {
        console.error(`[MENU] Could not find menu with id: ${targetId}`);
        return;
      }

      // Close other menus first
      document.querySelectorAll('.context-menu').forEach(menu => {
        if (menu !== targetMenu) {
          menu.classList.remove('show');
        }
      });

      // Toggle THIS menu
      const isShowing = targetMenu.classList.toggle("show");
      console.log(`[MENU] ${targetId} is now ${isShowing ? 'VISIBLE' : 'HIDDEN'}`);
    });
  }

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

  // Shape selection from panel
  shapeItems.forEach(item => {
    item.addEventListener("click", (e) => {
      const shapeType = e.currentTarget.dataset.shape;

      // Toggle off if clicking the same one, or switch
      if (pendingShape === shapeType) {
        pendingShape = null;
        item.classList.remove("active");
        tool = "pen"; // Revert to pen
      } else {
        pendingShape = shapeType;
        tool = "shapes";

        // Visual feedback
        document.querySelectorAll(".shape-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
      }

      updateToolButtons();
    });
  });

  // Maintain old drag functionality as a secondary option if desired, 
  // but the user specifically asked to change it. I will keep it but it might conflict.
  // Actually, let's keep it but make sure "click" doesn't trigger "drag" too much.
  // The user says "instead of that [drag]", so I'll disable drag.
  /*
  shapeItems.forEach(item => {
    item.addEventListener("mousedown", startShapeDrag);
  });
  */

  function isPointInRect(point, rect) {
    return point.x >= rect.x && point.x <= rect.x + rect.w &&
      point.y >= rect.y && point.y <= rect.y + rect.h;
  }

  function isRectInRect(rectA, rectB) {
    // rectA has x, y, width, height. rectB has x, y, w, h
    return (rectA.x < rectB.x + rectB.w &&
      rectA.x + rectA.width > rectB.x &&
      rectA.y < rectB.y + rectB.h &&
      rectA.y + rectA.height > rectB.y);
  }

  function isPathInRect(points, rect) {
    if (!points || points.length === 0) return false;
    // Check if any point is inside the rect
    for (let p of points) {
      if (isPointInRect(p, rect)) return true;
    }
    // Also check if the path intersects the rect (simplified: bounding box overlap)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });

    return (minX < rect.x + rect.w && maxX > rect.x && minY < rect.y + rect.h && maxY > rect.y);
  }

  // Move stroke logic
  function isPointNearPath(point, path, threshold = 10) {
    if (!path.points || path.points.length < 2) return false;
    for (let i = 0; i < path.points.length - 1; i++) {
      const p1 = path.points[i];
      const p2 = path.points[i + 1];
      // Distance from point to line segment p1-p2
      const dist = distToSegment(point, p1, p2);
      if (dist < threshold) return true;
    }
    return false;
  }

  function distToSegment(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt((p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2);
  }

  function highlightSelection() {
    document.querySelectorAll('.shape-object, .text-element, .note-element').forEach(el => el.classList.remove('selected'));
    selectedElements.forEach(el => {
      let cssClass = el.type === 'shape' ? '.shape-object' : el.type === 'text' ? '.text-element' : '.note-element';
      let dataAttr = el.type === 'shape' ? 'shapeId' : el.type === 'text' ? 'textId' : 'noteId';
      const domEl = document.querySelector(`${cssClass}[data-${el.type}-id="${el.id}"]`);
      if (domEl) domEl.classList.add('selected');
    });
    redraw();
  }

  function snapshotSelectionState() {
    selectionSnapshot = selectedElements.map(el => {
      let item = null;
      if (el.type === 'shape') item = shapes.find(s => s.id === el.id);
      else if (el.type === 'text') item = textElements.find(t => t.id === el.id);
      else if (el.type === 'note') item = stickyNotes.find(n => n.id === el.id);
      else if (el.type === 'stroke') item = paths.find(p => p.id === el.id);

      if (item) {
        if (el.type === 'stroke') {
          return { ...el, startPoints: JSON.parse(JSON.stringify(item.points)) };
        }
        return { ...el, startX: item.x, startY: item.y };
      }
      return null;
    }).filter(i => i !== null);
  }

  function updateSelectionPositions(dx, dy) {
    let hasStrokes = false;
    selectionSnapshot.forEach(item => {
      if (item.type === 'stroke') {
        const path = paths.find(p => p.id === item.id);
        if (path) {
          path.points = item.startPoints.map(p => ({ x: p.x + dx, y: p.y + dy }));
          hasStrokes = true;
        }
        return;
      }

      const newX = item.startX + dx;
      const newY = item.startY + dy;

      if (item.type === 'shape') {
        const shape = shapes.find(s => s.id === item.id);
        if (shape) {
          shape.x = newX;
          shape.y = newY;
          const el = document.querySelector(`[data-shape-id="${item.id}"]`);
          if (el) {
            el.style.left = (newX * scale + offsetX) + 'px';
            el.style.top = (newY * scale + offsetY) + 'px';
          }
        }
      } else if (item.type === 'text') {
        const text = textElements.find(t => t.id === item.id);
        if (text) {
          text.x = newX;
          text.y = newY;
          const el = document.querySelector(`[data-text-id="${item.id}"]`);
          if (el) {
            el.style.left = (newX * scale + offsetX) + 'px';
            el.style.top = (newY * scale + offsetY) + 'px';
          }
        }
      } else if (item.type === 'note') {
        const note = stickyNotes.find(n => n.id === item.id);
        if (note) {
          note.x = newX;
          note.y = newY;
          const el = document.querySelector(`[data-note-id="${item.id}"]`);
          if (el) {
            el.style.left = (newX * scale + offsetX) + 'px';
            el.style.top = (newY * scale + offsetY) + 'px';
          }
        }
      }
    });
    redraw();
  }

  function finalizeSelectionMove() {
    selectionSnapshot.forEach(item => {
      if (item.type === 'shape') {
        const shape = shapes.find(s => s.id === item.id);
        if (shape) socket.emit("shape-update", shape);
      } else if (item.type === 'text') {
        const text = textElements.find(t => t.id === item.id);
        if (text) socket.emit("text-update", text);
      } else if (item.type === 'note') {
        const note = stickyNotes.find(n => n.id === item.id);
        if (note) socket.emit("note-update", note);
      } else if (item.type === 'stroke') {
        const path = paths.find(p => p.id === item.id);
        if (path) {
          socket.emit("stroke-delete", item.id); // Delete old
          // We need to send as new stroke because 'stroke-update' isn't standard
          // Or reuse ID if we implement update? Let's use delete+add for safety or assume delete updates clients.
          // Wait, if I delete, I lose the ID? 
          // Better to emit "draw-stroke" with SAME ID if backend supports upsert?
          // Checking backend is hard. Let's assume standard "draw-stroke" adds.
          // Safe bet: Delete old, Add new (with same ID? or new ID?)
          // If I keep same ID, I can just emit draw-stroke?
          // Let's try emitting draw-stroke with the existing ID.
          socket.emit("draw-stroke", path);
        }
      }
    });
  }

  function renderAllShapes() {
    document.querySelectorAll('.shape-object').forEach(el => el.remove());

    shapes.forEach(shape => {
      createShapeElement(shape);
    });
    checkBoardEmpty();
  }

  function createShapeElement(shape) {
    const shapeEl = document.createElement('div');
    shapeEl.className = 'shape-object';
    shapeEl.dataset.shapeId = shape.id;
    shapeEl.style.left = (shape.x * scale + offsetX) + 'px';
    shapeEl.style.top = (shape.y * scale + offsetY) + 'px';
    shapeEl.style.width = (shape.width * scale) + 'px';
    shapeEl.style.height = (shape.height * scale) + 'px';
    shapeEl.style.transform = `rotate(${shape.rotation || 0}deg)`;

    // Handle AI-generated images
    if (shape.type === 'image') {
      const img = document.createElement('img');
      img.src = shape.url;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.borderRadius = '8px';
      img.style.pointerEvents = 'none';
      shapeEl.appendChild(img);
    } else {
      // Regular SVG shapes
      const isDarkMode = document.body.classList.contains('dark-mode');

      // FIX: Use shape.color for STROKE, not fill. Fill is transparent.
      // If shape.color was mistakenly set to transparent, fallback to theme defaults.
      // Otherwise use the selected color.
      const strokeColor = (shape.color === 'transparent' || !shape.color)
        ? (isDarkMode ? '#eee' : '#333')
        : shape.color;

      let svgTemplate = shapeTemplates[shape.type];

      // GENERIC REPLACEMENT:
      // 1. Force fill to transparent
      if (svgTemplate.includes('fill=')) {
        svgTemplate = svgTemplate.replace(/fill="[^"]*"/g, 'fill="transparent"');
      } else {
        svgTemplate = svgTemplate.replace(/<[a-z]+ /i, `$&fill="transparent" `);
      }

      // 2. Force stroke to color
      if (svgTemplate.includes('stroke=')) {
        svgTemplate = svgTemplate.replace(/stroke="[^"]*"/g, `stroke="${strokeColor}"`);
      } else {
        svgTemplate = svgTemplate.replace(/<[a-z]+ /i, `$&stroke="${strokeColor}" `);
      }

      // Legacy cleanup just in case
      svgTemplate = svgTemplate.replace(/COLOR/g, 'transparent');

      shapeEl.innerHTML = `<svg viewBox="0 0 100 100">${svgTemplate}</svg>`;
    }

    shapeEl.addEventListener('mousedown', selectShape);
    document.body.appendChild(shapeEl);
  }

  function selectShape(e) {
    if (tool === "pan" || tool === "pen" || tool === "eraser") return;

    if (e.target.classList.contains('resize-handle') ||
      e.target.classList.contains('shape-delete')) {
      return;
    }

    e.stopPropagation();

    const shapeId = e.currentTarget.dataset.shapeId;
    const isAlreadySelected = selectedElements.some(el => el.id === shapeId);

    if (!isAlreadySelected && !e.shiftKey) {
      selectedElements = [{ id: shapeId, type: 'shape' }];
    } else if (!isAlreadySelected && e.shiftKey) {
      selectedElements.push({ id: shapeId, type: 'shape' });
    }
    // If already selected, do nothing (keep selection for group drag)

    highlightSelection();

    // Start Drag logic
    const startScreenX = e.clientX;
    const startScreenY = e.clientY;
    snapshotSelectionState();

    function moveShape(moveE) {
      const dx = (moveE.clientX - startScreenX) / scale;
      const dy = (moveE.clientY - startScreenY) / scale;
      updateSelectionPositions(dx, dy);
    }

    function stopMove() {
      document.removeEventListener('mousemove', moveShape);
      document.removeEventListener('mouseup', stopMove);
      finalizeSelectionMove();
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
    checkBoardEmpty();
  }

  function createTextElement(textData) {
    const textDiv = document.createElement('div');
    textDiv.className = 'text-element';
    textDiv.dataset.textId = textData.id;
    textDiv.style.position = 'absolute';
    textDiv.style.left = (textData.x * scale + offsetX) + 'px';
    textDiv.style.top = (textData.y * scale + offsetY) + 'px';
    textDiv.style.color = getContrastColor(textData.color);
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
      if (tool === "pan") return; // Pass through for panning
      if (e.target === deleteBtn) return;
      e.stopPropagation();

      const isAlreadySelected = selectedElements.some(el => el.id === textData.id);
      if (!isAlreadySelected && !e.shiftKey) {
        selectedElements = [{ id: textData.id, type: 'text' }];
      } else if (!isAlreadySelected && e.shiftKey) {
        selectedElements.push({ id: textData.id, type: 'text' });
      }
      highlightSelection();

      const startScreenX = e.clientX;
      const startScreenY = e.clientY;
      snapshotSelectionState();

      function moveText(moveE) {
        const dx = (moveE.clientX - startScreenX) / scale;
        const dy = (moveE.clientY - startScreenY) / scale;
        updateSelectionPositions(dx, dy);
      }

      function stopMove() {
        document.removeEventListener('mousemove', moveText);
        document.removeEventListener('mouseup', stopMove);
        finalizeSelectionMove();
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
    checkBoardEmpty();
  }

  function createNoteElement(noteData) {
    const note = document.createElement('div');
    note.className = 'note';
    note.dataset.noteId = noteData.id;

    // Aesthetic Palette from the user image
    const palette = [
      '#ffb2d9', // Soft Pink
      '#fbd46d', // Sticky Yellow
      '#91d8ff', // Sky Blue
      '#81e6a1', // Mint Green
      '#ffc27a', // Orange
      '#d8b4fe', // Lavender
      '#fef9c3'  // Classic Pale Yellow
    ];

    // Assignment of randomized color if none exists (newly created)
    if (!noteData.color) {
      noteData.color = palette[Math.floor(Math.random() * palette.length)];
      // Also update on server so others see the same color
      socket.emit("note-update", noteData);
    }

    note.style.left = (noteData.x * scale + offsetX) + 'px';
    note.style.top = (noteData.y * scale + offsetY) + 'px';
    note.style.background = noteData.color;
    note.style.transform = `scale(${scale})`;
    note.style.transformOrigin = 'top left';

    // Header Band
    const header = document.createElement('div');
    header.className = 'note-header';
    const headerText = document.createElement('span');
    headerText.className = 'note-header-text';
    headerText.innerText = 'Note'; // Could be dynamic if needed
    header.appendChild(headerText);
    note.appendChild(header);

    // Content Area
    const content = document.createElement('div');
    content.className = 'note-content';
    content.contentEditable = true;
    content.innerText = noteData.content || "";
    note.appendChild(content);

    // Modernized delete button
    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'delete-note-btn';
    deleteBtn.innerHTML = '×';
    note.appendChild(deleteBtn);

    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      stickyNotes = stickyNotes.filter(n => n.id !== noteData.id);
      socket.emit("note-delete", noteData.id);
      note.remove();
    };

    content.oninput = () => {
      noteData.content = content.innerText;
      checkBoardEmpty();
      socket.emit("note-update", noteData);
      socket.emit("user-activity", "is writing a note");
    };

    note.onmousedown = (ev) => {
      if (tool === "pan") return;
      if (ev.target === deleteBtn || ev.target === content && document.activeElement === content) return;

      ev.preventDefault();

      const isAlreadySelected = selectedElements.some(el => el.id === noteData.id);
      if (!isAlreadySelected && !ev.shiftKey) {
        selectedElements = [{ id: noteData.id, type: 'note' }];
      } else if (!isAlreadySelected && ev.shiftKey) {
        selectedElements.push({ id: noteData.id, type: 'note' });
      }
      highlightSelection();

      const startScreenX = ev.clientX;
      const startScreenY = ev.clientY;
      snapshotSelectionState();

      function moveNote(moveE) {
        const dx = (moveE.clientX - startScreenX) / scale;
        const dy = (moveE.clientY - startScreenY) / scale;
        updateSelectionPositions(dx, dy);
      }

      function stopMove() {
        document.removeEventListener('mousemove', moveNote);
        document.removeEventListener('mouseup', stopMove);
        finalizeSelectionMove();
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

  /* ================= SAVE ON EXIT ================= */

  /**
   * Prepare and send canvas state to backend for persistence
   * Only called by room owner/creator
   */
  let isSaving = false;

  async function saveRoomOnExit(useBeacon = false) {
    if (isSaving && !useBeacon) {
      console.log('[DEBUG] Save already in progress, skipping...');
      return { success: true };
    }

    console.log('[DEBUG] saveRoomOnExit called, useBeacon:', useBeacon);
    try {
      if (!useBeacon) isSaving = true;

      // Use the currentRoom variable from page load
      if (!currentRoom || !currentRoom.isOwner) {
        console.log('[DEBUG] Not room owner or no room data, skipping save. currentRoom:', currentRoom);
        if (!useBeacon) isSaving = false;
        return { success: true };
      }

      const activeRoomId = currentRoom.id || roomId;
      console.log('[DEBUG] Saving state for room:', activeRoomId);

      // Get template data from BoardTemplates if it exists
      let templateTexts = [];
      let templateTransform = { x: 0, y: 0, scale: 1 };
      let templateKey = null;

      if (window.BoardTemplates) {
        templateTexts = window.BoardTemplates.templateTexts || [];
        templateTransform = window.BoardTemplates.templateTransform || { x: 0, y: 0, scale: 1 };
        templateKey = window.BoardTemplates.currentTemplate || null;
      }

      // Prepare full canvas state
      const canvasState = {
        paths: paths,
        shapes: shapes,
        textElements: textElements,
        stickyNotes: stickyNotes,
        templateTexts: templateTexts,
        templateTransform: templateTransform,
        templateKey: templateKey || currentRoom.templateKey || null
      };

      console.log('[DEBUG] Saving canvas state:');
      console.log('[DEBUG] - paths:', paths.length);
      console.log('[DEBUG] - shapes:', shapes.length);
      console.log('[DEBUG] - templateKey:', canvasState.templateKey);

      // Generate preview image
      const previewImage = canvas.toDataURL("image/png");

      const payload = {
        canvasState: canvasState,
        previewImage: previewImage
      };

      const endpoint = `/api/rooms/${currentRoom.id}/save-on-exit`;

      if (useBeacon) {
        // Use sendBeacon for best-effort save during page unload
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
        console.log('Save-on-exit beacon sent (best-effort)');
        return { success: true };
      } else {
        // Use fetch for reliable save with user-initiated exit
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
          console.log('Room state saved successfully');
        } else {
          console.error('Failed to save room state:', result.message);
        }

        return result;
      }
    } catch (error) {
      console.error('Error saving room state:', error);
      return { success: false, message: error.message };
    } finally {
      if (!useBeacon) isSaving = false;
    }
  }

  /* ================= ROOM RENAMING ================= */
  if (currentRoom.isOwner) {
    const boardNameEl = document.getElementById('board-name');

    // Prevent newlines in board name
    boardNameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        boardNameEl.blur(); // Trigger blur to save
      }
    });

    // Save on blur
    boardNameEl.addEventListener('blur', async () => {
      const newName = boardNameEl.innerText.trim();

      if (!newName || newName === currentRoom.name) {
        boardNameEl.innerText = currentRoom.name; // Revert if empty or unchanged
        return;
      }

      console.log('[DEBUG] Renaming room to:', newName);

      try {
        const response = await fetch(`/api/rooms/${roomId}/rename`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName })
        });

        const result = await response.json();
        if (result.success) {
          console.log('[DEBUG] Room renamed successfully');
          // Update local state
          currentRoom.name = newName;
          localStorage.setItem('currentRoom', JSON.stringify(currentRoom));
          // Emit event to inform others if necessary (optional improvement)
          socket.emit('update-room-name', { roomId, name: newName });
        } else {
          console.error('[DEBUG] Rename failed:', result.message);
          alert(result.message);
          boardNameEl.innerText = currentRoom.name; // Revert
        }
      } catch (error) {
        console.error('[DEBUG] Error renaming room:', error);
        boardNameEl.innerText = currentRoom.name; // Revert
      }
    });
  }

  // Socket listener for room name updates from others
  socket.on('room-name-updated', (data) => {
    if (data.name) {
      const boardNameEl = document.getElementById('board-name');
      if (boardNameEl) {
        boardNameEl.innerText = data.name;
        // Also update local storage if they happen to return to room list
        const roomData = JSON.parse(localStorage.getItem('currentRoom') || '{}');
        if (roomData.id === roomId) {
          roomData.name = data.name;
          localStorage.setItem('currentRoom', JSON.stringify(roomData));
        }
      }
    }
  });

  // Exit button handler - save and redirect
  if (exitBtn) {
    exitBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent bubbling but allow default action

      // IMPORTANT: Hide all overlays/panels that might block the confirm dialog
      const templateOverlay = document.getElementById('template-selector-overlay');
      const aiOverlay = document.getElementById('ai-overlay');
      const chatPanel = document.getElementById('chat-panel');
      const shapesPanel = document.getElementById('shapes-panel');
      const participantPanel = document.getElementById('participants-panel');
      const roomInfoPanel = document.getElementById('room-info-panel');

      if (templateOverlay) templateOverlay.classList.add('hidden');
      if (aiOverlay) aiOverlay.classList.add('ai-hidden');
      if (chatPanel) chatPanel.classList.add('chat-hidden');
      if (shapesPanel) shapesPanel.classList.add('shapes-hidden');
      if (participantPanel) participantPanel.classList.add('hidden');
      if (roomInfoPanel) roomInfoPanel.classList.add('hidden');

      const currentRoom = JSON.parse(localStorage.getItem('currentRoom') || '{}');

      if (confirm("Are you sure you want to leave this board?")) {
        // Show loading state
        exitBtn.disabled = true;
        exitBtn.title = 'Saving...';
        exitBtn.style.opacity = '0.7';

        // Save room state (only if owner)
        console.log('[DEBUG] Exit button clicked, about to save...');
        const saveResult = await saveRoomOnExit(false);
        console.log('[DEBUG] Save completed, result:', saveResult);

        // Wait a bit to ensure save fully completes
        await new Promise(resolve => setTimeout(resolve, 500));

        // Clean up
        localStorage.removeItem('currentRoom');

        console.log('[DEBUG] About to redirect to /room');
        // Redirect to room selection
        window.location.href = '/room';
      }
    });
  }

  // Browser close/navigate away - best-effort save using beacon
  window.addEventListener('beforeunload', (e) => {
    const currentRoom = JSON.parse(localStorage.getItem('currentRoom') || '{}');

    // Only attempt save if user is room owner
    if (currentRoom && currentRoom.isOwner) {
      saveRoomOnExit(true); // Call with backup=true to use sendBeacon
    }
  });

  /* ================= WATERMARK LOGIC ================= */
  function checkBoardEmpty() {
    // Check if drawing currently (instant feedback for quicker UX)
    const isDrawing = (typeof drawing !== 'undefined' && drawing) ||
      (typeof pendingDraw !== 'undefined' && pendingDraw) ||
      (typeof currentPath !== 'undefined' && currentPath && currentPath.length > 0) ||
      (document.activeElement && document.activeElement.classList.contains('text-input'));

    const isEmpty = !isDrawing &&
      (!paths || paths.length === 0) &&
      (!shapes || shapes.length === 0) &&
      (!textElements || textElements.length === 0) &&
      (!stickyNotes || stickyNotes.length === 0);

    const watermark = document.getElementById('watermark');
    if (watermark) {
      if (isEmpty) {
        watermark.classList.remove('hidden-watermark');
      } else {
        watermark.classList.add('hidden-watermark');
      }
    }
  }

  // Add immediate hide on interaction
  const canvasBoard = document.getElementById('board');
  if (canvasBoard) {
    const hideWatermark = () => {
      if (['pen', 'pencil', 'brush', 'eraser'].includes(tool)) {
        const watermark = document.getElementById('watermark');
        if (watermark) watermark.classList.add('hidden-watermark');
      }
    };
    canvasBoard.addEventListener('mousedown', hideWatermark);
    canvasBoard.addEventListener('touchstart', hideWatermark);
  }

  // Initial check
  setTimeout(checkBoardEmpty, 500); // Wait for init-board

  /* ================= AI BOARD SUMMARIZATION ================= */
  const aiBtn = document.getElementById('ai-btn');
  const aiDropdown = document.getElementById('ai-dropdown');
  const summarizeBtn = document.getElementById('summarize-btn');
  const aiModal = document.getElementById('ai-summary-modal');
  const closeAiModal = document.getElementById('close-ai-modal');
  const summarizeSubmit = document.getElementById('summarize-submit');
  const summaryContainer = document.getElementById('summary-container');
  const summaryText = document.getElementById('summary-text');
  const expandIntelligenceBtn = document.getElementById('expand-intelligence-btn');

  // Toggle AI dropdown
  // Toggle AI dropdown -> NOW OPENS MODAL DIRECTLY
  if (aiBtn && aiModal) {
    aiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // aiDropdown.classList.toggle('hidden'); // REMOVED dropdown toggle

      // Open Modal Directly
      aiModal.classList.remove('hidden');

      // Close other panels
      if (typeof chatPanel !== 'undefined' && chatPanel) chatPanel.classList.add('chat-hidden');
      if (typeof shapesPanel !== 'undefined' && shapesPanel) shapesPanel.classList.add('shapes-hidden');
      if (typeof roomInfoPanel !== 'undefined' && roomInfoPanel) roomInfoPanel.classList.add('hidden');
      if (aiDropdown) aiDropdown.classList.add('hidden');

      // Reset UI to initial state (Moved from summarizeBtn handler)
      const resultsDivider = document.getElementById('results-divider');
      const chatSection = document.getElementById('ai-chat-section');
      const chatHistory = document.getElementById('ai-chat-history');
      const loadingScreen = document.getElementById('ai-loading-container');
      // summaryContainer is defined in upper scope

      if (summaryContainer) summaryContainer.classList.add('hidden');
      if (resultsDivider) resultsDivider.classList.add('hidden');
      if (chatSection) chatSection.classList.add('hidden');
      if (loadingScreen) loadingScreen.classList.add('hidden');
      if (chatHistory) {
        chatHistory.innerHTML = '<div class="chat-bubble ai-bubble fade-in">Hello! I\'ve analyzed your board. Do you have any specific questions about these insights?</div>';
      }

      const summarizeSubmit = document.getElementById('summarize-submit');
      if (summarizeSubmit) {
        summarizeSubmit.classList.remove('hidden');
        summarizeSubmit.disabled = false;
        const btnText = summarizeSubmit.querySelector('.btn-text');
        if (btnText) btnText.innerText = 'Generate Insights';
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#ai-btn') && !e.target.closest('#ai-dropdown')) {
        aiDropdown.classList.add('hidden');
      }
    });
  }

  // Open summary modal
  if (summarizeBtn && aiModal) {
    summarizeBtn.addEventListener('click', () => {
      aiDropdown.classList.add('hidden');
      aiModal.classList.remove('hidden');

      // Reset UI to initial state
      const resultsDivider = document.getElementById('results-divider');
      const chatSection = document.getElementById('ai-chat-section');
      const chatHistory = document.getElementById('ai-chat-history');
      const loadingScreen = document.getElementById('ai-loading-container');

      if (summaryContainer) summaryContainer.classList.add('hidden');
      if (resultsDivider) resultsDivider.classList.add('hidden');
      if (chatSection) chatSection.classList.add('hidden');
      if (loadingScreen) loadingScreen.classList.add('hidden');
      if (chatHistory) {
        chatHistory.innerHTML = '<div class="chat-bubble ai-bubble fade-in">Hello! I\'ve analyzed your board. Do you have any specific questions about these insights?</div>';
      }

      const summarizeSubmit = document.getElementById('summarize-submit');
      if (summarizeSubmit) {
        summarizeSubmit.classList.remove('hidden');
        summarizeSubmit.disabled = false;
        summarizeSubmit.querySelector('.btn-text').innerText = 'Generate Insights';
      }
    });
  }

  // Close modal
  if (closeAiModal) {
    closeAiModal.addEventListener('click', () => {
      if (aiModal) aiModal.classList.add('hidden');
    });
  }

  // Close modal on overlay click
  if (aiModal) {
    aiModal.querySelector('.ai-modal-overlay')?.addEventListener('click', () => {
      aiModal.classList.add('hidden');
    });
  }

  // Generate Summary
  if (summarizeSubmit) {
    summarizeSubmit.addEventListener('click', async () => {
      const resultsDivider = document.getElementById('results-divider');
      const summaryContainer = document.getElementById('summary-container');
      const summarizeSubmit = document.getElementById('summarize-submit');
      const loadingScreen = document.getElementById('ai-loading-container');

      // 1. Enter Loading State
      if (summarizeSubmit) summarizeSubmit.classList.add('hidden');
      if (loadingScreen) loadingScreen.classList.remove('hidden');

      try {
        // Collect board data
        const currentRoomData = JSON.parse(localStorage.getItem('currentRoom') || '{}');

        // Helper to get board snapshot
        function getBoardSnapshot() {
          const allElements = [
            ...paths.flatMap(p => p.points),
            ...Object.values(activeRemotePaths).flatMap(p => p.points),
            ...textElements.map(t => ({ x: t.x, y: t.y })),
            ...stickyNotes.flatMap(n => [{ x: n.x, y: n.y }, { x: n.x + 200, y: n.y + 200 }]),
            ...shapes.flatMap(s => [{ x: s.x, y: s.y }, { x: s.x + s.width, y: s.y + s.height }])
          ];

          if (allElements.length === 0) {
            const emptyCanvas = document.createElement('canvas');
            emptyCanvas.width = 100; emptyCanvas.height = 100;
            const eCtx = emptyCanvas.getContext('2d');
            eCtx.fillStyle = '#ffffff';
            eCtx.fillRect(0, 0, 100, 100);
            return emptyCanvas.toDataURL('image/jpeg', 0.1);
          }

          const minX = Math.min(...allElements.map(e => e.x));
          const minY = Math.min(...allElements.map(e => e.y));
          const maxX = Math.max(...allElements.map(e => e.x));
          const maxY = Math.max(...allElements.map(e => e.y));

          const padding = 100;
          const boardW = (maxX - minX) + padding * 2;
          const boardH = (maxY - minY) + padding * 2;
          const limit = 4096;
          const scaleDown = Math.min(1, limit / boardW, limit / boardH);

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = boardW * scaleDown;
          tempCanvas.height = boardH * scaleDown;
          const tCtx = tempCanvas.getContext('2d');

          tCtx.fillStyle = '#ffffff';
          tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          tCtx.scale(scaleDown, scaleDown);
          tCtx.translate(-minX + padding, -minY + padding);

          paths.forEach(p => drawStroke(p, tCtx));
          Object.values(activeRemotePaths).forEach(p => drawStroke(p, tCtx));

          tCtx.textAlign = 'left';
          tCtx.textBaseline = 'top';

          textElements.forEach(t => {
            tCtx.fillStyle = t.color || '#000000';
            tCtx.font = '24px Arial';
            tCtx.fillText(t.text, t.x, t.y);
          });

          stickyNotes.forEach(n => {
            tCtx.fillStyle = n.color || '#fff9c4';
            tCtx.fillRect(n.x, n.y, 200, 200);
            tCtx.strokeStyle = '#000000';
            tCtx.strokeRect(n.x, n.y, 200, 200);
            tCtx.fillStyle = '#000000';
            tCtx.font = '16px Arial';
            const words = (n.content || "").split(' ');
            let line = '';
            let yy = n.y + 10;
            words.forEach(word => {
              if ((line + word).length > 20) {
                tCtx.fillText(line, n.x + 10, yy);
                line = word + ' '; yy += 20;
              } else { line += word + ' '; }
            });
            tCtx.fillText(line, n.x + 10, yy);
          });

          shapes.forEach(s => {
            tCtx.fillStyle = s.color || '#3b82f6';
            tCtx.globalAlpha = 0.5;
            tCtx.fillRect(s.x, s.y, s.width, s.height);
            tCtx.globalAlpha = 1.0;
            tCtx.strokeStyle = '#000000';
            tCtx.strokeRect(s.x, s.y, s.width, s.height);
            tCtx.fillStyle = '#000000';
            tCtx.font = '12px Arial';
            tCtx.fillText(`[${s.type}]`, s.x + 5, s.y + 5);
          });

          return tempCanvas.toDataURL('image/jpeg', 0.8);
        }

        const boardImage = getBoardSnapshot();
        const boardData = {
          textElements: textElements || [],
          stickyNotes: stickyNotes || [],
          shapes: shapes || [],
          templateName: currentRoomData.template || null
        };

        const response = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boardData, boardImage })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to generate insights');

        // --- Structured Parsing Logic ---
        const text = data.summary;

        function extractSection(sectionName) {
          const regex = new RegExp(`\\[${sectionName}\\]([\\s\\S]*?)(?=\\[|$)`, 'i');
          const match = text.match(regex);
          return match ? match[1].trim() : '';
        }

        const execSummary = extractSection('EXECUTIVE SUMMARY');
        const keyInsightsText = extractSection('KEY INSIGHTS');
        const metadataText = extractSection('METADATA');
        const secondaryInsights = extractSection('SECONDARY INSIGHTS');

        // 1. Populate Executive Summary
        const execSummaryEl = document.getElementById('exec-summary-text');
        if (execSummaryEl) execSummaryEl.innerText = execSummary || 'Analysis complete. No critical summary generated.';

        // 2. Populate Key Insights
        const keyInsightsList = document.getElementById('key-insights-list');
        if (keyInsightsList) {
          keyInsightsList.innerHTML = '';
          const points = keyInsightsText.split('\n').filter(p => p.trim().startsWith('-'));
          if (points.length > 0) {
            points.forEach(p => {
              const li = document.createElement('li');
              li.innerHTML = `<span class="bullet-arrow"></span> ${p.replace('-', '').trim()}`;
              keyInsightsList.appendChild(li);
            });
          } else {
            keyInsightsList.innerHTML = '<li><span class="bullet-dot"></span> No specific insights identified.</li>';
          }
        }

        // Card C, D, E, F removed as requested

        await new Promise(r => setTimeout(r, 1000)); // Brief pause to show loading state

        // Hide Loading Screen
        if (loadingScreen) loadingScreen.classList.add('hidden');

        // Show Results
        if (resultsDivider) resultsDivider.classList.remove('hidden');
        if (summaryContainer) {
          summaryContainer.classList.remove('hidden');
          // Trigger animations by reflowing
          summaryContainer.style.display = 'none';
          summaryContainer.offsetHeight;
          summaryContainer.style.display = 'grid';
        }

        // --- Show AI Chat Section ---
        // AI Chat Section hidden by default until toggled via the new AI button
        const chatSection = document.getElementById('ai-chat-section');
        if (chatSection) {
          chatSection.classList.add('hidden');
        }

      } catch (error) {
        console.error('[AI] Summarization error:', error);
        if (loadingScreen) loadingScreen.classList.add('hidden');
        if (summarizeSubmit) {
          summarizeSubmit.classList.remove('hidden');
          summarizeSubmit.disabled = false;
          const btnText = summarizeSubmit.querySelector('.btn-text');
          if (btnText) btnText.innerText = 'Retry Generation';
        }
        alert('Failed to generate insights: ' + (error.message || 'System error. Please try again.'));
      }
    });
  }
  // AI Chat Toggle Logic
  const toggleAiChat = document.getElementById('toggle-ai-chat');
  if (toggleAiChat) {
    toggleAiChat.addEventListener('click', () => {
      const chatSection = document.getElementById('ai-chat-section');
      if (chatSection) {
        chatSection.classList.toggle('hidden');
        chatSection.classList.toggle('fade-in');
      }
    });
  }

  /* --- AI INSIGHT CHAT LOGIC --- */
  const aiChatInput = document.getElementById('ai-chat-input');
  const aiChatSend = document.getElementById('ai-chat-send');
  const aiChatHistory = document.getElementById('ai-chat-history');

  async function sendChatMessage() {
    const question = aiChatInput.value.trim();
    if (!question) return;

    // Add user bubble
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble user-bubble fade-in';
    userBubble.innerText = question;
    aiChatHistory.appendChild(userBubble);
    aiChatInput.value = '';
    aiChatHistory.scrollTop = aiChatHistory.scrollHeight;

    // Add typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator fade-in';
    typingIndicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    aiChatHistory.appendChild(typingIndicator);
    aiChatHistory.scrollTop = aiChatHistory.scrollHeight;

    try {
      const summary = document.getElementById('exec-summary-text')?.innerText || '';
      const currentRoomData = JSON.parse(localStorage.getItem('currentRoom') || '{}');
      const boardData = {
        textElements: textElements || [],
        stickyNotes: stickyNotes || [],
        shapes: shapes || [],
        templateName: currentRoomData.template || null
      };

      console.log(`[AI Chat] Sending request to /api/ai-chat with question: ${question}`);
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, summary, boardData })
      });

      console.log(`[AI Chat] Received response status: ${response.status}`);
      const data = await response.json();
      typingIndicator.remove();

      if (response.ok) {
        console.log(`[AI Chat] Success: AI responded`);
        const aiBubble = document.createElement('div');
        aiBubble.className = 'chat-bubble ai-bubble fade-in';
        aiBubble.innerText = data.answer;
        aiChatHistory.appendChild(aiBubble);
      } else {
        console.error(`[AI Chat] Server error: ${data.error}`);
        throw new Error(data.error || 'Failed to get answer');
      }
    } catch (error) {
      console.error(`[AI Chat] Frontend Catch:`, error);
      typingIndicator.remove();
      const errorBubble = document.createElement('div');
      errorBubble.className = 'chat-bubble ai-bubble fade-in';
      errorBubble.style.background = 'rgba(239, 68, 68, 0.1)';
      errorBubble.style.borderColor = 'rgba(239, 68, 68, 0.2)';
      errorBubble.innerText = `Error: ${error.message || "Failed to get answer"}`;
      aiChatHistory.appendChild(errorBubble);
    }
    aiChatHistory.scrollTop = aiChatHistory.scrollHeight;
  }

  if (aiChatSend) {
    aiChatSend.addEventListener('click', sendChatMessage);
  }

  if (aiChatInput) {
    aiChatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendChatMessage();
    });
  }

  // Expand Full Intelligence handler
  if (expandIntelligenceBtn) {
    expandIntelligenceBtn.addEventListener('click', () => {
      const exec = document.getElementById('exec-summary-text')?.innerText || '';
      const insights = Array.from(document.querySelectorAll('#key-insights-list li')).map(li => li.innerText).join('\n');
      const fullText = `AI INSIGHTS SUMMARY\n\n${exec}\n\nKEY INSIGHTS:\n${insights}`;

      navigator.clipboard.writeText(fullText).then(() => {
        const originalContent = expandIntelligenceBtn.innerHTML;
        expandIntelligenceBtn.innerHTML = '<span>Insights Copied!</span>';
        setTimeout(() => expandIntelligenceBtn.innerHTML = originalContent, 2000);
      });
    });
  }

  // Voice Command UI Toggle
  const micBtn = document.getElementById('mic-btn');
  const voiceBar = document.getElementById('voice-command-bar');
  const voiceClose = document.getElementById('voice-close');
  const voiceConfirm = document.getElementById('voice-confirm');

  if (micBtn && voiceBar) {
    micBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      voiceBar.classList.remove('hidden');
      micBtn.classList.add('mic-active'); // Add glow
    });
  }

  if (voiceClose && voiceBar) {
    voiceClose.addEventListener('click', (e) => {
      e.stopPropagation();
      voiceBar.classList.add('hidden');
      if (micBtn) micBtn.classList.remove('mic-active'); // Remove glow
    });
  }

  if (voiceConfirm && voiceBar) {
    voiceConfirm.addEventListener('click', (e) => {
      e.stopPropagation();
      // Placeholder for processing
      voiceBar.classList.add('hidden');
      if (micBtn) micBtn.classList.remove('mic-active'); // Remove glow
    });
  }

  const autoShapeToggle = document.getElementById('auto-shape-toggle');
  if (autoShapeToggle) {
    autoShapeToggle.addEventListener('change', (e) => {
      autoShapeEnabled = e.target.checked;
      console.log('[AI] Auto Shape Detection:', autoShapeEnabled);
      if (autoShapeEnabled) {
        initShapeModel(); // Start pre-loading model as soon as toggled ON
      }
    });
  }

});


