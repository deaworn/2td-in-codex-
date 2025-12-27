const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');

// Színes, lágy kanyarokkal rendelkező útvonal.
const pathPoints = [
  { x: 80, y: 380 },
  { x: 200, y: 180 },
  { x: 340, y: 240 },
  { x: 480, y: 140 },
  { x: 650, y: 200 },
  { x: 780, y: 120 },
  { x: 840, y: 320 },
];

// Egyetlen ellenfél állapota.
const enemy = {
  x: pathPoints[0].x,
  y: pathPoints[0].y,
  speed: 160,
  segmentIndex: 0,
  progress: 0,
  trail: [], // fénycsóvák pozíciói
};

const stars = Array.from({ length: 70 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: Math.random() * 1.6 + 0.4,
}));

let playing = false;
let lastTime = 0;
let animationId = null;

startButton.addEventListener('click', () => {
  if (playing) return;
  resetEnemy();
  playing = true;
  startButton.disabled = true;
  startButton.textContent = 'Szimuláció folyamatban...';
  lastTime = performance.now();
  animationId = requestAnimationFrame(update);
});

function resetEnemy() {
  enemy.x = pathPoints[0].x;
  enemy.y = pathPoints[0].y;
  enemy.segmentIndex = 0;
  enemy.progress = 0;
  enemy.trail = [];
}

function update(timestamp) {
  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  moveEnemy(delta);
  drawScene();

  if (playing) {
    animationId = requestAnimationFrame(update);
  }
}

function moveEnemy(deltaSeconds) {
  let remaining = deltaSeconds;

  while (remaining > 0 && enemy.segmentIndex < pathPoints.length - 1) {
    const from = pathPoints[enemy.segmentIndex];
    const to = pathPoints[enemy.segmentIndex + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const segLen = Math.hypot(dx, dy);
    const distFrame = enemy.speed * remaining;
    const distLeft = (1 - enemy.progress) * segLen;

    if (distFrame < distLeft) {
      enemy.progress += distFrame / segLen;
      remaining = 0;
    } else {
      remaining -= distLeft / enemy.speed;
      enemy.segmentIndex += 1;
      enemy.progress = 0;
    }

    const t = enemy.progress;
    enemy.x = from.x + dx * t;
    enemy.y = from.y + dy * t;
  }

  // Trail rögzítése az út mentén.
  enemy.trail.push({ x: enemy.x, y: enemy.y, life: 1 });
  enemy.trail = enemy.trail.slice(-40);

  // Végpont elérése.
  if (enemy.segmentIndex >= pathPoints.length - 1) {
    const lastPoint = pathPoints[pathPoints.length - 1];
    enemy.x = lastPoint.x;
    enemy.y = lastPoint.y;
    playing = false;
    startButton.disabled = false;
    startButton.textContent = 'Hologram futtatása';
    cancelAnimationFrame(animationId);
  }
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSky();
  // extra grid overlay
  drawGrid();
  drawPath();
  drawTrail();
  drawEnemy();
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#0b1220');
  gradient.addColorStop(0.5, '#0d1a2f');
  gradient.addColorStop(1, '#081020');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // halvány csillagok
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  stars.forEach((star) => {
    const size = star.r;
    ctx.beginPath();
    ctx.arc(star.x, star.y, size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.08)';
  ctx.lineWidth = 1;
  const spacing = 36;
  ctx.beginPath();
  for (let x = spacing; x < canvas.width; x += spacing) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  for (let y = spacing; y < canvas.height; y += spacing) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();
}

function drawPath() {
  ctx.lineWidth = 26;
  ctx.strokeStyle = '#22f0b6';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pathPoints.forEach((p, i) => {
    if (i === 0) {
      ctx.moveTo(p.x, p.y);
    } else {
      ctx.lineTo(p.x, p.y);
    }
  });
  ctx.stroke();

  ctx.lineWidth = 4;
  ctx.strokeStyle = '#0ea5e9';
  ctx.beginPath();
  pathPoints.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
}

function drawTrail() {
  enemy.trail.forEach((dot, index) => {
    const alpha = (index + 1) / enemy.trail.length;
    ctx.fillStyle = `rgba(34, 211, 238, ${alpha * 0.7})`;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 8 * alpha, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawEnemy() {
  const pulse = 3 + Math.sin(performance.now() / 200) * 2;
  ctx.fillStyle = '#f43f5e';
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, 12 + pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Kis csillanás a tetején.
  ctx.fillStyle = '#fef2f2';
  ctx.beginPath();
  ctx.arc(enemy.x - 4, enemy.y - 6, 4, 0, Math.PI * 2);
  ctx.fill();

  // Hátsó ion-fény
  const glowRadius = 22 + pulse;
  const gradient = ctx.createRadialGradient(enemy.x, enemy.y, 0, enemy.x, enemy.y, glowRadius);
  gradient.addColorStop(0, 'rgba(34, 211, 238, 0.35)');
  gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, glowRadius, 0, Math.PI * 2);
  ctx.fill();
}

// Rajzoljuk ki az alap állapotot, hogy Start előtt is látszódjon a pálya.
drawScene();
