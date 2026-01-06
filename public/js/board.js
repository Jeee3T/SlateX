const canvas = document.getElementById("board");
const container = document.getElementById("board-container");
const ctx = canvas.getContext("2d");

/* Buttons */
const drawBtn = document.getElementById("drawBtn");
const eraserBtn = document.getElementById("eraser");
const textBtn = document.getElementById("text");
const noteBtn = document.getElementById("note");
const handBtn = document.getElementById("hand");
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const downloadBtn = document.getElementById("download");

/* Menus */
const drawMenu = document.getElementById("drawMenu");
const colorMenu = document.getElementById("colorMenu");

/* State */
let tool = "pen";
let drawType = "pen";
let color = "#000";

let drawing = false;
let panning = false;

let scale = 1;
let offsetX = 0;
let offsetY = 0;

let paths = [];
let currentPath = [];

let px = 0, py = 0;

/* Resize */
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  redraw();
}
window.addEventListener("resize", resize);
resize();

/* Utilities */
function getPos(e) {
  return {
    x: (e.clientX - offsetX) / scale,
    y: (e.clientY - offsetY) / scale
  };
}

function closeMenus() {
  drawMenu.classList.remove("show");
  colorMenu.classList.remove("show");
}

/* Menu toggles */
document.querySelectorAll(".arrow").forEach(a => {
  a.onclick = e => {
    e.stopPropagation();
    closeMenus();
    document.getElementById(a.dataset.target).classList.add("show");
  };
});
document.addEventListener("click", closeMenus);

/* Tool activation */
function activate(btn, name) {
  document.querySelectorAll(".tool").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  tool = name;

  canvas.style.cursor =
    name === "hand" ? "grab" :
    name === "text" ? "text" :
    "crosshair";
}

drawBtn.onclick = () => activate(drawBtn, "pen");
eraserBtn.onclick = () => activate(eraserBtn, "eraser");
textBtn.onclick = () => activate(textBtn, "text");
noteBtn.onclick = () => activate(noteBtn, "note");
handBtn.onclick = () => activate(handBtn, "hand");

/* Sub tools */
document.querySelectorAll("[data-draw]").forEach(b => {
  b.onclick = e => {
    e.stopPropagation();
    drawType = b.dataset.draw;
    activate(drawBtn, "pen");
    closeMenus();
  };
});

document.querySelectorAll("[data-color]").forEach(c => {
  c.onclick = e => {
    e.stopPropagation();
    color = c.dataset.color;
    closeMenus();
  };
});

/* Mouse events */
canvas.addEventListener("mousedown", e => {
  if (tool === "pen" || tool === "eraser") {
    drawing = true;
    currentPath = [getPos(e)];
  }

  if (tool === "hand") {
    panning = true;
    px = e.clientX;
    py = e.clientY;
    canvas.style.cursor = "grabbing";
  }
});

canvas.addEventListener("mousemove", e => {
  if (drawing) {
    currentPath.push(getPos(e));
    redraw();
  }

  if (panning) {
    offsetX += e.clientX - px;
    offsetY += e.clientY - py;
    px = e.clientX;
    py = e.clientY;
    redraw();
  }
});

canvas.addEventListener("mouseup", () => {
  if (drawing) {
    paths.push({ tool, drawType, color, points: [...currentPath] });
    currentPath = [];
    drawing = false;
  }

  if (panning) {
    panning = false;
    canvas.style.cursor = "grab";
  }
});

/* Redraw */
function redraw() {
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  ctx.clearRect(
    -offsetX / scale,
    -offsetY / scale,
    canvas.width / scale,
    canvas.height / scale
  );

  paths.forEach(p => drawStroke(p));
  if (currentPath.length) drawStroke({ tool, drawType, color, points: currentPath });
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
      p.drawType === "pencil" ? 1 :
      8;
  }

  p.points.forEach((pt, i) => {
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });

  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

/* Text tool */
canvas.addEventListener("click", e => {
  if (tool !== "text") return;

  const pos = getPos(e);
  const input = document.createElement("div");
  input.className = "text-input";
  input.contentEditable = true;
  input.style.left = pos.x * scale + offsetX + "px";
  input.style.top = pos.y * scale + offsetY + "px";
  input.style.color = color;
  container.appendChild(input);
  input.focus();

  input.onblur = () => {
    ctx.fillStyle = color;
    ctx.font = "20px Segoe UI";
    ctx.fillText(input.innerText, pos.x, pos.y);
    input.remove();
  };
});

/* Sticky note */
canvas.addEventListener("click", e => {
  if (tool !== "note") return;

  const note = document.createElement("div");
  note.className = "note";
  note.contentEditable = true;
  note.style.left = e.clientX + "px";
  note.style.top = e.clientY + "px";
  container.appendChild(note);
  note.focus();

  let drag = false, sx, sy;
  note.onmousedown = ev => {
    drag = true;
    sx = ev.clientX - note.offsetLeft;
    sy = ev.clientY - note.offsetTop;
  };
  document.onmousemove = ev => {
    if (!drag) return;
    note.style.left = ev.clientX - sx + "px";
    note.style.top = ev.clientY - sy + "px";
  };
  document.onmouseup = () => drag = false;
});

/* Zoom */
zoomInBtn.onclick = () => { scale *= 1.1; redraw(); };
zoomOutBtn.onclick = () => { scale /= 1.1; redraw(); };

/* Download */
downloadBtn.onclick = () => {
  const link = document.createElement("a");
  link.download = "whiteboard.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
};
