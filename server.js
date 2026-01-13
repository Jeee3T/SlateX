require('dotenv').config();
const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const authRoutes = require("./routes/auth");
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
// 🧠 WHITEBOARD STATE
// =======================

let currentDrawer = null;
let boardPaths = [];
let boardShapes = [];
let boardTextElements = [];
let boardStickyNotes = [];
let templateTexts = [];
let templateTransform = { x: 0, y: 0, scale: 1 };
let users = {};

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
    touchAfter: 24 * 3600 // lazy session update
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

// =======================
// 🔌 SOCKET.IO LOGIC
// =======================

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (name) => {
    users[socket.id] = name;
  });

  // Chat
  socket.on("chat-message", (msg) => {
    io.emit("chat-message", msg);
  });

  // Send full board state to new users
  socket.emit("init-board", {
    paths: boardPaths,
    shapes: boardShapes,
    textElements: boardTextElements,
    stickyNotes: boardStickyNotes,
    templateTexts: templateTexts,
    templateTransform: templateTransform
  });

  socket.on("request-draw", () => {
    if (currentDrawer === null) {
      currentDrawer = socket.id;
      socket.emit("draw-allowed", true);
      io.emit("active-drawer", users[socket.id] || "Someone");
    } else {
      socket.emit("draw-allowed", false);
    }
  });

  socket.on("draw-point", (data) => {
    socket.broadcast.emit("draw-point", data);
  });

  socket.on("draw-stroke", (stroke) => {
    boardPaths.push(stroke);
    socket.broadcast.emit("draw-stroke", stroke);
  });

  socket.on("release-draw", () => {
    if (currentDrawer === socket.id) {
      currentDrawer = null;
      io.emit("draw-released");
      io.emit("drawer-cleared");
    }
  });

  // Shapes events
  socket.on("shape-add", (shape) => {
    boardShapes.push(shape);
    socket.broadcast.emit("shape-added", shape);
  });

  socket.on("shape-update", (updatedShape) => {
    const idx = boardShapes.findIndex(s => s.id === updatedShape.id);
    if (idx !== -1) {
      boardShapes[idx] = updatedShape;
      socket.broadcast.emit("shape-updated", updatedShape);
    }
  });

  socket.on("shape-delete", (shapeId) => {
    boardShapes = boardShapes.filter(s => s.id !== shapeId);
    socket.broadcast.emit("shape-deleted", shapeId);
  });

  socket.on("clear-all", () => {
    boardPaths = [];
    boardShapes = [];
    boardTextElements = [];
    boardStickyNotes = [];
    templateTexts = [];
    io.emit("clear-all");
  });

  // Text events
  socket.on("text-add", (textElement) => {
    boardTextElements.push(textElement);
    socket.broadcast.emit("text-added", textElement);
  });

  socket.on("text-update", (updatedText) => {
    const idx = boardTextElements.findIndex(t => t.id === updatedText.id);
    if (idx !== -1) {
      boardTextElements[idx] = updatedText;
      socket.broadcast.emit("text-updated", updatedText);
    }
  });

  socket.on("text-delete", (textId) => {
    boardTextElements = boardTextElements.filter(t => t.id !== textId);
    socket.broadcast.emit("text-deleted", textId);
  });

  // Sticky notes events
  socket.on("note-add", (note) => {
    boardStickyNotes.push(note);
    socket.broadcast.emit("note-added", note);
  });

  socket.on("note-update", (updatedNote) => {
    const idx = boardStickyNotes.findIndex(n => n.id === updatedNote.id);
    if (idx !== -1) {
      boardStickyNotes[idx] = updatedNote;
      socket.broadcast.emit("note-updated", updatedNote);
    }
  });

  socket.on("note-delete", (noteId) => {
    boardStickyNotes = boardStickyNotes.filter(n => n.id !== noteId);
    socket.broadcast.emit("note-deleted", noteId);
  });

  // Template text events
  socket.on("template-text-add", (textData) => {
    templateTexts.push(textData);
    socket.broadcast.emit("template-text-added", textData);
  });

  socket.on("template-text-update", (updatedText) => {
    const idx = templateTexts.findIndex(t => t.id === updatedText.id);
    if (idx !== -1) {
      templateTexts[idx] = updatedText;
      socket.broadcast.emit("template-text-updated", updatedText);
    }
  });

  socket.on("template-text-delete", (textId) => {
    templateTexts = templateTexts.filter(t => t.id !== textId);
    socket.broadcast.emit("template-text-deleted", textId);
  });

  // Template transform events
  socket.on("template-transform-update", (transform) => {
    templateTransform = transform;
    socket.broadcast.emit("template-transform-updated", transform);
  });

  // Disconnect
  socket.on("disconnect", (reason) => {
    console.log("User disconnected:", socket.id, "Reason:", reason);

    if (currentDrawer === socket.id) {
      currentDrawer = null;
      io.emit("draw-released");
      io.emit("drawer-cleared");
    }

    delete users[socket.id];
  });
});

// =======================
// 🚀 START SERVER
// =======================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});