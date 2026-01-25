// ============================================
// UPDATE YOUR server.js FILE
// ============================================

require('dotenv').config();
const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const authRoutes = require("./routes/auth");
const roomRoutes = require("./routes/rooms"); // ADD THIS LINE
const { isAuthenticated, redirectIfAuthenticated } = require("./middleware/authMiddleware");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// =======================
// 🗄️ DATABASE CONNECTION
// =======================

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// =======================
// 🧠 WHITEBOARD STATE (Now Room-based)
// =======================

// Store active room sessions in memory
const activeRooms = new Map();

// =======================
// ⚙️ MIDDLEWARE
// =======================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// =======================
// 🌐 ROUTES
// =======================

// Landing page (public)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Auth page (redirect if already logged in)
app.get("/auth", redirectIfAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "auth.html"));
});

// Room selection (protected - requires login)
app.get("/room", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "room.html"));
});

// Domain selection (protected - requires login)
app.get("/domain", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "domain.html"));
});

// Canvas page (protected - requires login)
app.get("/canvas", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "canvas.html"));
});

// Auth API routes
app.use("/api/auth", authRoutes);

// Room API routes - ADD THIS LINE
app.use("/api/rooms", roomRoutes);

// =======================
// 📌 SOCKET.IO LOGIC (Room-based)
// =======================

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  let currentRoom = null;
  let currentDrawer = null;

  // Join a room
  socket.on("join-room", async (rawRoomId, username, userId) => {
    try {
      const roomId = rawRoomId.toUpperCase();
      currentRoom = roomId;
      socket.join(roomId);

      // Initialize room if it doesn't exist in memory
      if (!activeRooms.has(roomId)) {
        // Load room state from MongoDB
        const Room = require('./models/Room');
        const room = await Room.findOne({ roomId }).populate('creator');

        if (room) {
          activeRooms.set(roomId, {
            currentDrawer: null,
            users: {}, // { socketId: { username, isAdmin, hasAccess } }
            boardState: room.boardState,
            creatorId: room.creator._id.toString(),
            creatorUsername: room.creator.username
          });
        } else {
          activeRooms.set(roomId, {
            currentDrawer: null,
            users: {},
            boardState: {
              paths: [],
              shapes: [],
              textElements: [],
              stickyNotes: [],
              templateTexts: [],
              templateTransform: { x: 0, y: 0, scale: 1 },
              templateKey: null
            },
            creatorId: null,
            creatorUsername: null
          });
        }
      } else {
        // Enrichment: If room exists in memory but lacks metadata (due to previous code version), re-fetch it
        const roomData = activeRooms.get(roomId);
        if (roomData && (!roomData.creatorUsername || !roomData.creatorId)) {
          const Room = require('./models/Room');
          const room = await Room.findOne({ roomId }).populate('creator');
          if (room) {
            roomData.creatorId = room.creator._id.toString();
            roomData.creatorUsername = room.creator.username;
          }
        }
      }

      const roomData = activeRooms.get(roomId);

      // --- 🛡️ DEFINITIVE ADMIN & IDENTITY LOGIC ---

      const normalizedUsername = username.trim().toLowerCase();
      const creatorUsernameInput = (roomData.creatorUsername || "").trim().toLowerCase();
      const dbCreatorId = roomData.creatorId ? String(roomData.creatorId) : null;
      const clientUserId = userId ? String(userId) : null;

      // 1. Find if this user was already in the room (Session Handover)
      let inheritedAdmin = false;
      let inheritedAccess = false;

      const userSocketIds = Object.keys(roomData.users);
      for (const oldSocketId of userSocketIds) {
        const u = roomData.users[oldSocketId];
        const isSameByUserId = (clientUserId && u.userId && String(u.userId) === clientUserId);
        const isSameByUsername = (u.username.trim().toLowerCase() === normalizedUsername);

        if (isSameByUserId || isSameByUsername) {
          inheritedAdmin = u.isAdmin;
          inheritedAccess = u.hasAccess;
          delete roomData.users[oldSocketId]; // Wipe old session to prevent ID conflicts
          console.log(`[SlateX] Handover: ${username} (Socket ${oldSocketId} -> ${socket.id})`);
        }
      }

      // 2. Definitive Creator Check (Source of Truth)
      // We use String() to ensure ObjectIds and Strings compare correctly
      const isCreator = (clientUserId && dbCreatorId && clientUserId === dbCreatorId) ||
        (normalizedUsername === creatorUsernameInput && creatorUsernameInput !== "");

      // 3. Admin Designation
      // FORCE Admin if they are the creator OR if they inherited it OR if they are the first joiner
      const isAdmin = isCreator || inheritedAdmin || (Object.keys(roomData.users).length === 0);

      // 4. Access Designation
      // Admins ALWAYS have access. Others inherit it.
      const hasAccess = isAdmin || inheritedAccess;

      // --- DIAGNOSTICS ---
      console.log(`[SlateX] ${username} re-joined ${roomId}: isAdmin=${isAdmin}, isCreator=${isCreator}, inherited=${inheritedAdmin}`);

      // 5. Register New Session
      roomData.users[socket.id] = {
        userId: clientUserId,
        username,
        isAdmin,
        hasAccess
      };

      // Sync state
      socket.emit("init-board", roomData.boardState);
      socket.emit("user-permissions", { isAdmin, hasAccess });

      // Notify others
      if (inheritedAdmin || inheritedAccess) {
        io.to(roomId).emit("user-list-updated", Object.values(roomData.users));
      } else {
        io.to(roomId).emit("user-joined", {
          username,
          users: Object.values(roomData.users)
        });
      }
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("room-error", "Failed to join room");
    }
  });

  // Chat
  socket.on("chat-message", (msg) => {
    if (currentRoom) {
      io.to(currentRoom).emit("chat-message", msg);
    }
  });

  socket.on("client-typing", (data) => {
    if (currentRoom) {
      console.log(`[CHAT] Typing event in ${currentRoom}: ${data.user} (${data.isTyping})`);
      socket.to(currentRoom).emit("client-typing", data);
    }
  });

  // Handle room name updates
  socket.on('update-room-name', (data) => {
    if (data.roomId && data.name) {
      io.to(data.roomId.toUpperCase()).emit('room-name-updated', { name: data.name });
    }
  });

  // Activity indicator
  socket.on("user-activity", (activity) => {
    if (currentRoom) {
      socket.to(currentRoom).emit("user-activity", {
        username: activeRooms.get(currentRoom)?.users[socket.id]?.username || "Someone",
        activity: activity
      });
    }
  });

  // Drawing permissions
  socket.on("request-draw", () => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      const userData = roomData?.users[socket.id];

      if (roomData && userData && userData.hasAccess && roomData.currentDrawer === null) {
        roomData.currentDrawer = socket.id;
        socket.emit("draw-allowed", true);
        io.to(currentRoom).emit("active-drawer", userData.username || "Someone");
      } else {
        socket.emit("draw-allowed", false);
      }
    }
  });

  socket.on("draw-point", (data) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        socket.to(currentRoom).emit("draw-point", data);
      }
    }
  });

  socket.on("draw-stroke", (stroke) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.paths.push(stroke);
        socket.to(currentRoom).emit("draw-stroke", stroke);
      }
    }
  });

  socket.on("stroke-delete", (strokeId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.paths = roomData.boardState.paths.filter(p => p.id !== strokeId);
        socket.to(currentRoom).emit("stroke-deleted", strokeId);
      }
    }
  });

  socket.on("release-draw", () => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.currentDrawer === socket.id) {
        roomData.currentDrawer = null;
        io.to(currentRoom).emit("draw-released");
        io.to(currentRoom).emit("drawer-cleared");
      }
    }
  });

  // Shapes events
  socket.on("shape-add", (shape) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.shapes.push(shape);
        socket.to(currentRoom).emit("shape-added", shape);
      }
    }
  });

  socket.on("shape-update", (updatedShape) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        const idx = roomData.boardState.shapes.findIndex(s => s.id === updatedShape.id);
        if (idx !== -1) {
          roomData.boardState.shapes[idx] = updatedShape;
        }
        socket.to(currentRoom).emit("shape-updated", updatedShape);
      }
    }
  });

  socket.on("shape-delete", (shapeId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.shapes = roomData.boardState.shapes.filter(s => s.id !== shapeId);
        socket.to(currentRoom).emit("shape-deleted", shapeId);
      }
    }
  });

  socket.on("clear-all", () => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) { // Only Admin can clear
        roomData.boardState = {
          paths: [],
          shapes: [],
          textElements: [],
          stickyNotes: [],
          templateTexts: [],
          templateTransform: { x: 0, y: 0, scale: 1 },
          templateKey: roomData.boardState.templateKey // Keep template on clear
        };
        io.to(currentRoom).emit("clear-all");
      }
    }
  });

  // Text events
  socket.on("text-add", (textElement) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.textElements.push(textElement);
        socket.to(currentRoom).emit("text-added", textElement);
      }
    }
  });

  socket.on("text-update", (updatedText) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        const idx = roomData.boardState.textElements.findIndex(t => t.id === updatedText.id);
        if (idx !== -1) {
          roomData.boardState.textElements[idx] = updatedText;
        }
        socket.to(currentRoom).emit("text-updated", updatedText);
      }
    }
  });

  socket.on("text-delete", (textId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.textElements = roomData.boardState.textElements.filter(t => t.id !== textId);
        socket.to(currentRoom).emit("text-deleted", textId);
      }
    }
  });

  // Sticky notes events
  socket.on("note-add", (note) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.stickyNotes.push(note);
        socket.to(currentRoom).emit("note-added", note);
      }
    }
  });

  socket.on("note-update", (updatedNote) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        const idx = roomData.boardState.stickyNotes.findIndex(n => n.id === updatedNote.id);
        if (idx !== -1) {
          roomData.boardState.stickyNotes[idx] = updatedNote;
        }
        socket.to(currentRoom).emit("note-updated", updatedNote);
      }
    }
  });

  socket.on("note-delete", (noteId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.stickyNotes = roomData.boardState.stickyNotes.filter(n => n.id !== noteId);
        socket.to(currentRoom).emit("note-deleted", noteId);
      }
    }
  });

  // Template text events
  socket.on("template-text-add", (textData) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.templateTexts.push(textData);
        socket.to(currentRoom).emit("template-text-added", textData);
      }
    }
  });

  socket.on("template-text-update", (updatedText) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        const idx = roomData.boardState.templateTexts.findIndex(t => t.id === updatedText.id);
        if (idx !== -1) {
          roomData.boardState.templateTexts[idx] = updatedText;
        }
        socket.to(currentRoom).emit("template-text-updated", updatedText);
      }
    }
  });

  socket.on("template-text-delete", (textId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) {
        roomData.boardState.templateTexts = roomData.boardState.templateTexts.filter(t => t.id !== textId);
        socket.to(currentRoom).emit("template-text-deleted", textId);
      }
    }
  });

  // Admin Actions
  socket.on("give-access", (targetUsername) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) {
        // Find target user
        const targetSocketId = Object.keys(roomData.users).find(id => roomData.users[id].username === targetUsername);
        if (targetSocketId) {
          roomData.users[targetSocketId].hasAccess = true;
          // Notify target user
          io.to(targetSocketId).emit("permissions-updated", { hasAccess: true });
          // Notify everyone to refresh participant list
          io.to(currentRoom).emit("user-list-updated", Object.values(roomData.users));
        }
      }
    }
  });

  socket.on("revoke-access", (targetUsername) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) {
        const targetSocketId = Object.keys(roomData.users).find(id => roomData.users[id].username === targetUsername);
        if (targetSocketId) {
          roomData.users[targetSocketId].hasAccess = false;
          // If they were drawing, release it
          if (roomData.currentDrawer === targetSocketId) {
            roomData.currentDrawer = null;
            io.to(currentRoom).emit("draw-released");
            io.to(currentRoom).emit("drawer-cleared");
          }
          // Notify target user
          io.to(targetSocketId).emit("permissions-updated", { hasAccess: false });
          // Notify everyone to refresh participant list
          io.to(currentRoom).emit("user-list-updated", Object.values(roomData.users));
        }
      }
    }
  });

  socket.on("kick-user", (targetUsername) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) {
        // Find target user
        const targetSocketId = Object.keys(roomData.users).find(id => roomData.users[id].username === targetUsername);
        if (targetSocketId) {
          const adminUsername = roomData.users[socket.id]?.username || "the Administrator";
          // Notify target user they are kicked
          io.to(targetSocketId).emit("user-kicked", { by: adminUsername });
          // The disconnect event will handle cleanup
        }
      }
    }
  });

  // Template selection synchronization
  socket.on("template-select", (templateKey) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) {
        roomData.boardState.templateKey = templateKey;
        // Optionally clear current template texts if template changed? 
        // For now, just sync the key
        io.to(currentRoom).emit("template-selected", templateKey);
      }
    }
  });

  // Template transform events
  socket.on("template-transform-update", (transform) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) {
        roomData.boardState.templateTransform = transform;
        socket.to(currentRoom).emit("template-transform-updated", transform);
      }
    }
  });

  // Disconnect
  socket.on("disconnect", async (reason) => {
    console.log("User disconnected:", socket.id, "Reason:", reason);

    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);

      if (roomData) {
        // Release drawing permissions
        if (roomData.currentDrawer === socket.id) {
          roomData.currentDrawer = null;
          io.to(currentRoom).emit("draw-released");
          io.to(currentRoom).emit("drawer-cleared");
        }

        // Remove user
        const userData = roomData.users[socket.id];
        const username = userData?.username;
        delete roomData.users[socket.id];

        // Notify room
        io.to(currentRoom).emit("user-left", {
          username,
          users: Object.values(roomData.users)
        });

        // NOTE: Save is now handled explicitly via API call on room exit
        // No auto-save on disconnect per requirements

        // Clean up empty rooms
        if (Object.keys(roomData.users).length === 0) {
          activeRooms.delete(currentRoom);
          console.log(`Room ${currentRoom} cleaned up (empty)`);
        }
      }
    }
  });
});

// =======================
// 🚀 START SERVER
// =======================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});