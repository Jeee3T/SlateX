document.addEventListener('DOMContentLoaded', function() {
  const canvas = document.getElementById('demoCanvas');
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    drawDemoShapes();
  }

  function drawDemoShapes() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 2;

    ctx.strokeRect(canvas.width * 0.15, canvas.height * 0.25, canvas.width * 0.25, canvas.height * 0.2);

    ctx.beginPath();
    ctx.arc(canvas.width * 0.75, canvas.height * 0.3, canvas.width * 0.12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.45, canvas.height * 0.65);
    ctx.lineTo(canvas.width * 0.65, canvas.height * 0.55);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.7, canvas.height * 0.68);
    ctx.lineTo(canvas.width * 0.82, canvas.height * 0.62);
    ctx.stroke();
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const toolButtons = document.querySelectorAll('.tool-btn');
  toolButtons.forEach(button => {
    button.addEventListener('click', function() {
      toolButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
    });
  });

  const primaryButtons = document.querySelectorAll('.btn-primary');
  primaryButtons.forEach(button => {
    button.addEventListener('click', function() {
      console.log('Opening whiteboard...');
    });
  });

  const learnMoreButton = document.querySelector('.btn-secondary');
  if (learnMoreButton) {
    learnMoreButton.addEventListener('click', function() {
      document.querySelector('#features').scrollIntoView({ behavior: 'smooth' });
    });
  }

  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetSection = document.querySelector(targetId);
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});
