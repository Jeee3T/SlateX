const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 🔐 lock
let currentDrawer = null;

// 🧠 FULL STROKES ONLY
let boardPaths = [];

// 👤 users
let users = {};

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "canvas.html"))
);

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (name) => {
    users[socket.id] = name;
  });

  // ✅ send FULL strokes to late joiner
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

  // 🔴 LIVE POINTS (do NOT store)
  socket.on("draw-point", (data) => {
    socket.broadcast.emit("draw-point", data);
  });

  // ✅ FINAL STROKE (store this)
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

  socket.on("disconnect", () => {
    if (currentDrawer === socket.id) {
      currentDrawer = null;
      io.emit("draw-released");
      io.emit("drawer-cleared");
    }
    delete users[socket.id];
  });
});

server.listen(3000, () =>
  console.log("Server running at http://localhost:3000")
);
