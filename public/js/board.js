const socket = io();
const username = prompt("Enter your name") || "Anonymous";
socket.emit("join", username);

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

/* UI */
const drawBtn = document.getElementById("drawBtn");
const eraserBtn = document.getElementById("eraser");
const handBtn = document.getElementById("hand");
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const downloadBtn = document.getElementById("download");
const indicator = document.getElementById("drawer-indicator");

/* State */
let tool = "pen";
let drawType = "pen";
let color = "#000";

let canDraw = false;
let drawing = false;
let pendingDraw = false;

let scale = 1;
let offsetX = 0;
let offsetY = 0;

let paths = [];
let currentPath = [];

let px = 0, py = 0;

/* ======================
   INITIAL BOARD SYNC
   ====================== */
socket.on("init-board", (serverPaths) => {
  paths = serverPaths || [];
  redraw();
});

/* ======================
   DRAW LOCK EVENTS
   ====================== */
socket.on("draw-allowed", (allowed) => {
  canDraw = allowed;

  if (allowed && pendingDraw) {
    pendingDraw = false;
    drawing = true;
  }

  canvas.style.cursor = allowed ? "crosshair" : "not-allowed";
});

socket.on("draw-released", () => {
  canDraw = true;
  canvas.style.cursor = "crosshair";
});

/* ======================
   ACTIVE USER LABEL
   ====================== */
socket.on("active-drawer", (name) => {
  indicator.innerText = `${name} is drawing…`;
  indicator.style.display = "block";
});

socket.on("drawer-cleared", () => {
  indicator.style.display = "none";
});

/* ======================
   CANVAS SETUP
   ====================== */
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

/* ======================
   MOUSE EVENTS
   ====================== */
canvas.addEventListener("mousedown", (e) => {
  if (tool === "pen" || tool === "eraser") {
    pendingDraw = true;
    currentPath = [getPos(e)];
    socket.emit("request-draw");
    return;
  }

  if (tool === "hand") {
    px = e.clientX;
    py = e.clientY;
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;

  const point = getPos(e);
  currentPath.push(point);

  // 🔴 LIVE POINTS (NOT STORED)
  socket.emit("draw-point", {
    tool,
    drawType,
    color,
    points: [point]
  });

  redraw();
});

canvas.addEventListener("mouseup", () => {
  if (!drawing) return;

  const stroke = {
    tool,
    drawType,
    color,
    points: [...currentPath]
  };

  paths.push(stroke);

  // ✅ FINAL STROKE (STORED ON SERVER)
  socket.emit("draw-stroke", stroke);
  socket.emit("release-draw");

  drawing = false;
  currentPath = [];
});

/* ======================
   RECEIVE LIVE POINTS
   ====================== */
socket.on("draw-point", (data) => {
  if (
    !paths.length ||
    paths[paths.length - 1].temp !== true
  ) {
    paths.push({
      tool: data.tool,
      drawType: data.drawType,
      color: data.color,
      points: [],
      temp: true
    });
  }

  paths[paths.length - 1].points.push(...data.points);
  redraw();
});

/* ======================
   RECEIVE FINAL STROKE
   ====================== */
socket.on("draw-stroke", (stroke) => {
  // Remove temp live stroke if exists
  if (paths.length && paths[paths.length - 1].temp) {
    paths.pop();
  }

  paths.push(stroke);
  redraw();
});

/* ======================
   DRAWING
   ====================== */
function redraw() {
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  ctx.clearRect(
    -offsetX / scale,
    -offsetY / scale,
    canvas.width / scale,
    canvas.height / scale
  );

  paths.forEach(drawStroke);
  if (currentPath.length) {
    drawStroke({ tool, drawType, color, points: currentPath });
  }
}

function drawStroke(p) {
  ctx.beginPath();
  ctx.lineCap = "round";

  if (p.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 20;
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = p.color;
    ctx.lineWidth =
      p.drawType === "pen" ? 3 :
      p.drawType === "pencil" ? 1 : 8;
  }

  p.points.forEach((pt, i) => {
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });

  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

/* ======================
   ZOOM & DOWNLOAD
   ====================== */
zoomInBtn.onclick = () => { scale *= 1.1; redraw(); };
zoomOutBtn.onclick = () => { scale /= 1.1; redraw(); };

downloadBtn.onclick = () => {
  const link = document.createElement("a");
  link.download = "whiteboard.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
};
