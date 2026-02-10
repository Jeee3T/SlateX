document.addEventListener("DOMContentLoaded", function () {
  const canvas = document.getElementById("demoCanvas");
  const ctx = canvas.getContext("2d");

  let currentTool = "pen";
  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let demoDrawn = false;

  // ======================
  // 🎨 CANVAS SETUP
  // ======================
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const prevImage = ctx.getImageData(0, 0, canvas.width, canvas.height);

    canvas.width = rect.width;
    canvas.height = rect.height;

    if (!demoDrawn) {
      drawDemoShapes();
      demoDrawn = true;
    } else {
      ctx.putImageData(prevImage, 0, 0);
    }
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  ctx.strokeStyle = "#4b5563";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  // ======================
  // 🧱 DEMO SHAPES (INITIAL)
  // ======================
  function drawDemoShapes() {
    // Rectangle
    ctx.strokeRect(
      canvas.width * 0.15,
      canvas.height * 0.25,
      canvas.width * 0.25,
      canvas.height * 0.2
    );

    // Circle
    ctx.beginPath();
    ctx.arc(
      canvas.width * 0.7,
      canvas.height * 0.3,
      canvas.width * 0.12,
      0,
      Math.PI * 2
    );
    ctx.stroke();

    // Lines
    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.45, canvas.height * 0.65);
    ctx.lineTo(canvas.width * 0.65, canvas.height * 0.55);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.7, canvas.height * 0.7);
    ctx.lineTo(canvas.width * 0.82, canvas.height * 0.62);
    ctx.stroke();
  }

  // ======================
  // 🧰 TOOLBAR LOGIC
  // ======================
  const toolButtons = document.querySelectorAll(".tool-btn");

  toolButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      toolButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      if (index === 0) currentTool = "pen";
      if (index === 1) currentTool = "rect";
      if (index === 2) currentTool = "circle";
    });
  });

  // ======================
  // 🖱️ DRAWING LOGIC
  // ======================
  canvas.addEventListener("mousedown", (e) => {
    isDrawing = true;
    startX = e.offsetX;
    startY = e.offsetY;

    if (currentTool === "pen") {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!isDrawing) return;

    const x = e.offsetX;
    const y = e.offsetY;

    if (currentTool === "pen") {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  });

  canvas.addEventListener("mouseup", (e) => {
    if (!isDrawing) return;
    isDrawing = false;

    const x = e.offsetX;
    const y = e.offsetY;

    if (currentTool === "rect") {
      ctx.strokeRect(startX, startY, x - startX, y - startY);
    }

    if (currentTool === "circle") {
      const radius = Math.hypot(x - startX, y - startY);
      ctx.beginPath();
      ctx.arc(startX, startY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  canvas.addEventListener("mouseleave", () => {
    isDrawing = false;
  });

  // ======================
  // 🔗 UI INTERACTIONS
  // ======================
  const learnMoreButton = document.querySelector(".btn-secondary");
  if (learnMoreButton) {
    learnMoreButton.addEventListener("click", () => {
      document
        .querySelector("#features")
        .scrollIntoView({ behavior: "smooth" });
    });
  }

  const navLinks = document.querySelectorAll(".nav-links a");
  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      const href = this.getAttribute("href");

      // Only prevent default and scroll if it's an anchor link on the same page
      if (href.startsWith("#")) {
        e.preventDefault();
        const targetSection = document.querySelector(href);
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: "smooth" });
        }
      }
      // Otherwise, allow the default link behavior (e.g., navigating to /about)
    });
  });


});
