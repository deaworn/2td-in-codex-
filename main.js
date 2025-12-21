const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');

// Egyszerű, fix útvonal (töréspontokkal), amin az ellenfél végighalad.
const pathPoints = [
  { x: 40, y: 200 },
  { x: 200, y: 90 },
  { x: 420, y: 130 },
  { x: 620, y: 80 },
  { x: 760, y: 200 },
  { x: 680, y: 330 },
  { x: 520, y: 340 },
];

// Ellenfél állapota (egy darab szereplő létezik).
const enemy = {
  x: pathPoints[0].x,
  y: pathPoints[0].y,
  speed: 120, // pixel/másodperc
  segmentIndex: 0,
  progress: 0, // 0..1 arány a szakaszon belül
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
  let remainingTime = deltaSeconds;

  while (remainingTime > 0 && enemy.segmentIndex < pathPoints.length - 1) {
    const from = pathPoints[enemy.segmentIndex];
    const to = pathPoints[enemy.segmentIndex + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const segmentLength = Math.hypot(dx, dy);
    const distanceThisFrame = enemy.speed * remainingTime;
    const distanceLeftOnSegment = (1 - enemy.progress) * segmentLength;

    if (distanceThisFrame < distanceLeftOnSegment) {
      // Maradunk ugyanazon a szakaszon.
      enemy.progress += distanceThisFrame / segmentLength;
      remainingTime = 0;
    } else {
      // A szakasz végére értünk, továbblépünk a következőre.
      remainingTime -= distanceLeftOnSegment / enemy.speed;
      enemy.segmentIndex += 1;
      enemy.progress = 0;
    }

    // Frissítjük a tényleges pozíciót az aktuális progressz alapján.
    const progress = enemy.progress;
    enemy.x = from.x + dx * progress;
    enemy.y = from.y + dy * progress;
  }

  // Ha nincs több szakasz, a játék megáll.
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
  drawGrid();
  drawPath();
  drawEnemy();
}

function drawGrid() {
  ctx.strokeStyle = '#eeeeee';
  ctx.lineWidth = 1;
  for (let x = 40; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 40; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawPath() {
  ctx.lineWidth = 28;
  ctx.strokeStyle = '#c5d86d';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pathPoints.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();

  // Keskenyebb körvonal a kontraszthoz.
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#859755';
  ctx.beginPath();
  pathPoints.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();
}

function drawEnemy() {
  ctx.fillStyle = '#ff6b6b';
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// Kezdő rajzolás, hogy a pálya a Start előtt is látszódjon.
drawScene();
