const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.IO
const io = new Server(server);

// 🔐 Only one user can draw at a time
let currentDrawer = null;

// 🧠 Board state (for late joiners)
let boardPaths = [];

// 👤 socket.id -> username
let users = {};

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "canvas.html"));
});

/* =========================
   SOCKET.IO LOGIC
   ========================= */
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Receive username
  socket.on("join", (username) => {
    users[socket.id] = username;
  });

  // 🟢 Send existing board to new user
  socket.emit("init-board", boardPaths);

  // 🔐 Request permission to draw
  socket.on("request-draw", () => {
    if (currentDrawer === null) {
      currentDrawer = socket.id;

      socket.emit("draw-allowed", true);

      // 🔥 Notify everyone who is drawing
      io.emit("active-drawer", users[socket.id] || "Someone");
    } else {
      socket.emit("draw-allowed", false);
    }
  });

  // ✏️ LIVE drawing data
  socket.on("draw", (data) => {
    // Save stroke/points for late joiners
    boardPaths.push(data);

    // Broadcast to everyone except sender
    socket.broadcast.emit("draw", data);
  });

  // 🔓 Release drawing lock
  socket.on("release-draw", () => {
    if (currentDrawer === socket.id) {
      currentDrawer = null;
      io.emit("draw-released");
      io.emit("drawer-cleared");
    }
  });

  // ❌ Handle disconnect
  socket.on("disconnect", () => {
    if (currentDrawer === socket.id) {
      currentDrawer = null;
      io.emit("draw-released");
      io.emit("drawer-cleared");
    }

    delete users[socket.id];
    console.log("User disconnected:", socket.id);
  });
});

const PORT = 3000;

// IMPORTANT: listen on server, not app
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
