const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

let drawing = false;

canvas.addEventListener("mousedown", () => {
  drawing = true;
  ctx.beginPath();
});

canvas.addEventListener("mouseup", () => {
  drawing = false;
});

canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "black";

  ctx.lineTo(x, y);
  ctx.stroke();
});