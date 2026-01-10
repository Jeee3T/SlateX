const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// =======================
// 🧠 WHITEBOARD STATE
// =======================

// 🔐 lock (only one drawer at a time)
let currentDrawer = null;

// 🧠 store FULL strokes
let boardPaths = [];

// 🎨 store shapes
let boardShapes = [];

// 📝 store text elements
let boardTextElements = [];

// 📋 store sticky notes
let boardStickyNotes = [];

// 👤 connected users
let users = {};

// =======================
// 📁 STATIC FILES
// =======================

app.use(express.static(path.join(__dirname, "public")));

// =======================
// 🌐 ROUTES
// =======================

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Canvas / Whiteboard page
app.get("/canvas", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "canvas.html"));
});

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

  // ✅ send FULL board to late joiners (paths + shapes + text + notes)
  socket.emit("init-board", {
    paths: boardPaths,
    shapes: boardShapes,
    textElements: boardTextElements,
    stickyNotes: boardStickyNotes
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

  // 🔴 LIVE POINTS (not stored)
  socket.on("draw-point", (data) => {
    socket.broadcast.emit("draw-point", data);
  });

  // ✅ FINAL STROKE (store)
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

  // =======================
  // 🎨 SHAPES EVENTS
  // =======================

  // Add shape
  socket.on("shape-add", (shape) => {
    boardShapes.push(shape);
    socket.broadcast.emit("shape-added", shape);
  });

  // Update shape (move/resize)
  socket.on("shape-update", (updatedShape) => {
    const idx = boardShapes.findIndex(s => s.id === updatedShape.id);
    if (idx !== -1) {
      boardShapes[idx] = updatedShape;
      socket.broadcast.emit("shape-updated", updatedShape);
    }
  });

  // Delete shape
  socket.on("shape-delete", (shapeId) => {
    boardShapes = boardShapes.filter(s => s.id !== shapeId);
    socket.broadcast.emit("shape-deleted", shapeId);
  });

  // Clear all
  socket.on("clear-all", () => {
    boardPaths = [];
    boardShapes = [];
    boardTextElements = [];
    boardStickyNotes = [];
    io.emit("clear-all");
  });

  // =======================
  // 📝 TEXT EVENTS
  // =======================

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

  // =======================
  // 📋 STICKY NOTES EVENTS
  // =======================

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

  // =======================
  // 🔌 DISCONNECT
  // =======================

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
  console.log(`Server running at http://localhost:${PORT}`);
});