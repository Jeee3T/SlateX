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

// 🔐 Auth page (MISSING BEFORE)
app.get("/auth", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "auth.html"));
});

// 🎨 Canvas / Whiteboard page
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

  // ✅ send FULL board to late joiners
  socket.emit("init-board", boardPaths);

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
