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
  socket.on("join-room", async (roomId, username) => {
    try {
      currentRoom = roomId;
      socket.join(roomId);

      // Initialize room if it doesn't exist in memory
      if (!activeRooms.has(roomId)) {
        // Load room state from MongoDB
        const Room = require('./models/Room');
        const room = await Room.findOne({ roomId: roomId.toUpperCase() });

        if (room) {
          activeRooms.set(roomId, {
            currentDrawer: null,
            users: {},
            boardState: room.boardState
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
              templateTransform: { x: 0, y: 0, scale: 1 }
            }
          });
        }
      }

      const roomData = activeRooms.get(roomId);
      roomData.users[socket.id] = username;

      // Send current board state to new user
      socket.emit("init-board", roomData.boardState);

      // Notify room of new user
      io.to(roomId).emit("user-joined", {
        username,
        userCount: Object.keys(roomData.users).length
      });

      console.log(`User ${username} joined room ${roomId}`);
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

  // Activity indicator
  socket.on("user-activity", (activity) => {
    if (currentRoom) {
      socket.to(currentRoom).emit("user-activity", {
        username: activeRooms.get(currentRoom)?.users[socket.id] || "Someone",
        activity: activity
      });
    }
  });

  // Drawing permissions
  socket.on("request-draw", () => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.currentDrawer === null) {
        roomData.currentDrawer = socket.id;
        socket.emit("draw-allowed", true);
        io.to(currentRoom).emit("active-drawer", roomData.users[socket.id] || "Someone");
      } else {
        socket.emit("draw-allowed", false);
      }
    }
  });

  socket.on("draw-point", (data) => {
    if (currentRoom) {
      socket.to(currentRoom).emit("draw-point", data);
    }
  });

  socket.on("draw-stroke", (stroke) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData) {
        roomData.boardState.paths.push(stroke);
      }
      socket.to(currentRoom).emit("draw-stroke", stroke);
    }
  });

  socket.on("stroke-delete", (strokeId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData) {
        roomData.boardState.paths = roomData.boardState.paths.filter(p => p.id !== strokeId);
      }
      socket.to(currentRoom).emit("stroke-deleted", strokeId);
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
      if (roomData) {
        roomData.boardState.shapes.push(shape);
      }
      socket.to(currentRoom).emit("shape-added", shape);
    }
  });

  socket.on("shape-update", (updatedShape) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData) {
        const idx = roomData.boardState.shapes.findIndex(s => s.id === updatedShape.id);
        if (idx !== -1) {
          roomData.boardState.shapes[idx] = updatedShape;
        }
      }
      socket.to(currentRoom).emit("shape-updated", updatedShape);
    }
  });

  socket.on("shape-delete", (shapeId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData) {
        roomData.boardState.shapes = roomData.boardState.shapes.filter(s => s.id !== shapeId);
      }
      socket.to(currentRoom).emit("shape-deleted", shapeId);
    }
  });

  socket.on("clear-all", () => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData) {
        roomData.boardState = {
          paths: [],
          shapes: [],
          textElements: [],
          stickyNotes: [],
          templateTexts: [],
          templateTransform: { x: 0, y: 0, scale: 1 }
        };
      }
      io.to(currentRoom).emit("clear-all");
    }
  });

  // Text events
  socket.on("text-add", (textElement) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData) {
        roomData.boardState.textElements.push(textElement);
      }
      socket.to(currentRoom).emit("text-added", textElement);
    }
  });

  socket.on("text-update", (updatedText) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData) {
        const idx = roomData.boardState.textElements.findIndex(t => t.id === updatedText.id);
        if (idx !== -1) {
          roomData.boardState.textElements[idx] = updatedText;
        }
      }
      socket.to(currentRoom).emit("text-updated", updatedText);
    }
  });

  socket.on("text-delete", (textId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData) {
        roomData.boardState.textElements = roomData.boardState.textElements.filter(t => t.id !== textId);
      }
      socket.to(currentRoom).emit("text-deleted", textId);
    }
  });

  // Sticky notes events
  socket.on("note-add", (note) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData) {
        roomData.boardState.stickyNotes.push(note);
      }
      socket.to(currentRoom).emit("note-added", note);
    }
  });

  socket.on("note-update", (updatedNote) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData) {
        const idx = roomData.boardState.stickyNotes.findIndex(n => n.id === updatedNote.id);
        if (idx !== -1) {
          roomData.boardState.stickyNotes[idx] = updatedNote;
        }
      }
      socket.to(currentRoom).emit("note-updated", updatedNote);
    }
  });

  socket.on("note-delete", (noteId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData) {
        roomData.boardState.stickyNotes = roomData.boardState.stickyNotes.filter(n => n.id !== noteId);
      }
      socket.to(currentRoom).emit("note-deleted", noteId);
    }
  });

  // Template text events
  socket.on("template-text-add", (textData) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData) {
        roomData.boardState.templateTexts.push(textData);
      }
      socket.to(currentRoom).emit("template-text-added", textData);
    }
  });

  socket.on("template-text-update", (updatedText) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData) {
        const idx = roomData.boardState.templateTexts.findIndex(t => t.id === updatedText.id);
        if (idx !== -1) {
          roomData.boardState.templateTexts[idx] = updatedText;
        }
      }
      socket.to(currentRoom).emit("template-text-updated", updatedText);
    }
  });

  socket.on("template-text-delete", (textId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData) {
        roomData.boardState.templateTexts = roomData.boardState.templateTexts.filter(t => t.id !== textId);
      }
      socket.to(currentRoom).emit("template-text-deleted", textId);
    }
  });

  // Template transform events
  socket.on("template-transform-update", (transform) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData) {
        roomData.boardState.templateTransform = transform;
      }
      socket.to(currentRoom).emit("template-transform-updated", transform);
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
        const username = roomData.users[socket.id];
        delete roomData.users[socket.id];

        // Notify room
        io.to(currentRoom).emit("user-left", {
          username,
          userCount: Object.keys(roomData.users).length
        });

        // Save board state to MongoDB before cleanup
        try {
          const Room = require('./models/Room');
          await Room.findOneAndUpdate(
            { roomId: currentRoom.toUpperCase() },
            {
              boardState: roomData.boardState,
              lastActivity: new Date()
            }
          );
        } catch (error) {
          console.error("Error saving room state:", error);
        }

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