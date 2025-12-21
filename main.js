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

let playing = false;
let lastTime = 0;
let animationId = null;

startButton.addEventListener('click', () => {
  if (playing) return;
  resetEnemy();
  playing = true;
  startButton.disabled = true;
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
    cancelAnimationFrame(animationId);
  }
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSky();
  drawPath();
  drawTrail();
  drawEnemy();
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#e0f2fe');
  gradient.addColorStop(0.5, '#f8fafc');
  gradient.addColorStop(1, '#fff7ed');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawPath() {
  ctx.lineWidth = 26;
  ctx.strokeStyle = '#c8f169';
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
  ctx.strokeStyle = '#5c7c1f';
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
    ctx.fillStyle = `rgba(6, 182, 212, ${alpha * 0.6})`;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 8 * alpha, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawEnemy() {
  const pulse = 2 + Math.sin(performance.now() / 200) * 1.6;
  ctx.fillStyle = '#ef4444';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, 12 + pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Kis csillanás a tetején.
  ctx.fillStyle = '#fef2f2';
  ctx.beginPath();
  ctx.arc(enemy.x - 4, enemy.y - 6, 4, 0, Math.PI * 2);
  ctx.fill();
}

// Rajzoljuk ki az alap állapotot, hogy Start előtt is látszódjon a pálya.
drawScene();
