const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const energyDisplay = document.getElementById('energyDisplay');
const lifeDisplay = document.getElementById('lifeDisplay');
const waveDisplay = document.getElementById('waveDisplay');
const statusDisplay = document.querySelector('#statusDisplay .value');
const towerButtons = [...document.querySelectorAll('.tower')];

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

// Hullámok és játék állapota.
const waves = [
  { enemies: 8, speed: 140, life: 40 },
  { enemies: 10, speed: 150, life: 45 },
  { enemies: 12, speed: 170, life: 55 },
  { enemies: 1, speed: 120, life: 240, boss: true },
];

const state = {
  energy: 200,
  life: 20,
  wave: 0,
  placing: 'laser',
  enemies: [],
  trails: [],
  projectiles: [],
  towers: [],
  playing: false,
  lastTime: 0,
  animationId: null,
};

const enemyTemplate = {
  x: pathPoints[0].x,
  y: pathPoints[0].y,
  speed: 160,
  segmentIndex: 0,
  progress: 0,
  trailIndex: 0,
  life: 40,
  alive: true,
  boss: false,
};

startButton.addEventListener('click', () => {
  if (state.playing) return;
  spawnWave();
  state.playing = true;
  startButton.disabled = true;
  statusDisplay.textContent = 'Harcban';
  state.lastTime = performance.now();
  state.animationId = requestAnimationFrame(update);
});

canvas.addEventListener('mousemove', (e) => {
  const { left, top } = canvas.getBoundingClientRect();
  hoverPos.x = e.clientX - left;
  hoverPos.y = e.clientY - top;
});

canvas.addEventListener('mouseleave', () => {
  hoverPos.x = null;
  hoverPos.y = null;
});

canvas.addEventListener('click', () => {
  placeTower();
});

window.addEventListener('keydown', (e) => {
  if (e.key === '1') selectTower('laser');
  if (e.key === '2') selectTower('plasma');
  if (e.key === '3') selectTower('chrono');
});

towerButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    selectTower(btn.dataset.tower);
  });
});

const towerCatalog = {
  laser: { cost: 100, range: 120, fireRate: 1.2, color: '#38bdf8', damage: 16, name: 'Lézer' },
  plasma: { cost: 150, range: 140, fireRate: 0.7, color: '#fb923c', damage: 34, name: 'Plazma' },
  chrono: { cost: 180, range: 110, fireRate: 0.5, color: '#a855f7', damage: 8, slow: 0.6, name: 'Idő' },
};

function update(timestamp) {
  const delta = Math.min((timestamp - state.lastTime) / 1000, 0.05);
  state.lastTime = timestamp;

  updateEnemies(delta);
  updateTowers(delta);
  updateProjectiles(delta);
  cleanupDead();
  updateHUD();

  drawScene();

  if (state.playing) {
    state.animationId = requestAnimationFrame(update);
  }
}

function updateEnemies(delta) {
  let active = 0;
  state.enemies.forEach((enemy) => {
    if (!enemy.alive) return;

    let remaining = delta;

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

    state.trails.push({ x: enemy.x, y: enemy.y, life: 1 });

    if (enemy.segmentIndex >= pathPoints.length - 1 && enemy.alive) {
      enemy.alive = false;
      state.life -= 1;
      statusDisplay.textContent = 'Támadás alatt';
    }

    if (enemy.alive) active += 1;
  });

  state.trails = state.trails.slice(-120);

  if (active === 0 && state.playing) {
    endWave();
  }
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSky();
  drawPath();
  drawTrail();
  drawTowers();
  drawProjectiles();
  drawEnemies();
  drawCursorGhost();
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
  state.trails.forEach((dot, index) => {
    const alpha = (index + 1) / state.trails.length;
    ctx.fillStyle = `rgba(6, 182, 212, ${alpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 9 * alpha, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawEnemies() {
  state.enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    const pulse = 2 + Math.sin(performance.now() / 200) * 1.6;
    ctx.fillStyle = enemy.boss ? '#a855f7' : '#ef4444';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, (enemy.boss ? 16 : 12) + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef2f2';
    ctx.beginPath();
    ctx.arc(enemy.x - 4, enemy.y - 6, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

const hoverPos = { x: null, y: null };

function drawCursorGhost() {
  if (hoverPos.x === null || hoverPos.y === null) return;
  const tower = towerCatalog[state.placing];
  if (!tower) return;
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = tower.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hoverPos.x, hoverPos.y, tower.range, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTowers() {
  state.towers.forEach((t) => {
    ctx.fillStyle = t.color;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

function drawProjectiles() {
  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 3;
  state.projectiles.forEach((p) => {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.targetX, p.targetY);
    ctx.stroke();
  });
}

function spawnWave() {
  if (state.wave >= waves.length) {
    statusDisplay.textContent = 'Minden hullám legyőzve!';
    state.playing = false;
    startButton.disabled = false;
    return;
  }
  const def = waves[state.wave];
  state.enemies = Array.from({ length: def.enemies }, (_, i) => ({
    ...enemyTemplate,
    speed: def.speed * (1 + i * 0.01),
    life: def.life,
    boss: !!def.boss,
  }));
  state.wave += 1;
  state.trails = [];
  state.projectiles = [];
  state.towers.forEach((t) => (t.cooldown = 0));
  waveDisplay.textContent = `${state.wave}/${waves.length}`;
}

function endWave() {
  state.playing = false;
  startButton.disabled = false;
  statusDisplay.textContent = 'Következő hullámra vár';
  state.energy += 80;
  if (state.wave >= waves.length) {
    statusDisplay.textContent = 'Minden hullám legyőzve!';
  }
}

function selectTower(kind) {
  if (!towerCatalog[kind]) return;
  state.placing = kind;
  towerButtons.forEach((b) => b.classList.toggle('active', b.dataset.tower === kind));
}

function placeTower() {
  const tower = towerCatalog[state.placing];
  if (!tower || hoverPos.x === null || hoverPos.y === null) return;
  if (state.energy < tower.cost) return;

  // Ne helyezzük el az útvonalra: ellenőrizzük a legközelebbi szakaszt.
  const onPath = isPointNearPath(hoverPos.x, hoverPos.y, 24);
  if (onPath) return;

  state.towers.push({
    x: hoverPos.x,
    y: hoverPos.y,
    range: tower.range,
    fireRate: tower.fireRate,
    color: tower.color,
    damage: tower.damage,
    slow: tower.slow || 0,
    cooldown: 0,
    name: tower.name,
  });
  state.energy -= tower.cost;
}

function isPointNearPath(x, y, threshold) {
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const a = pathPoints[i];
    const b = pathPoints[i + 1];
    const dist = distancePointToSegment(x, y, a.x, a.y, b.x, b.y);
    if (dist < threshold) return true;
  }
  return false;
}

function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function updateTowers(delta) {
  state.towers.forEach((t) => {
    t.cooldown -= delta;
    if (t.cooldown > 0) return;
    const target = findTarget(t);
    if (!target) return;

    fireProjectile(t, target);
    t.cooldown = 1 / t.fireRate;
  });
}

function findTarget(tower) {
  let best = null;
  let bestProg = -1;
  state.enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    const dist = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
    if (dist > tower.range) return;
    if (enemy.progress > bestProg) {
      bestProg = enemy.progress;
      best = enemy;
    }
  });
  return best;
}

function fireProjectile(tower, enemy) {
  state.projectiles.push({
    x: tower.x,
    y: tower.y,
    target: enemy,
    speed: 420,
    damage: tower.damage,
    slow: tower.slow,
  });
}

function updateProjectiles(delta) {
  state.projectiles.forEach((p) => {
    if (!p.target || !p.target.alive) {
      p.done = true;
      return;
    }
    const dx = p.target.x - p.x;
    const dy = p.target.y - p.y;
    const dist = Math.hypot(dx, dy);
    const step = p.speed * delta;
    if (step >= dist) {
      hitEnemy(p.target, p.damage, p.slow);
      p.x = p.target.x;
      p.y = p.target.y;
      p.targetX = p.target.x;
      p.targetY = p.target.y;
      p.done = true;
    } else {
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
      p.targetX = p.target.x;
      p.targetY = p.target.y;
    }
  });
}

function hitEnemy(enemy, damage, slow) {
  enemy.life -= damage;
  if (slow) enemy.speed *= 1 - slow;
  if (enemy.life <= 0) {
    enemy.alive = false;
    state.energy += enemy.boss ? 120 : 20;
  }
}

function cleanupDead() {
  state.projectiles = state.projectiles.filter((p) => !p.done);
  state.enemies = state.enemies.filter((e) => e.alive || e.segmentIndex < pathPoints.length - 1);
  if (state.life <= 0) {
    state.playing = false;
    startButton.disabled = false;
    statusDisplay.textContent = 'Védelem elesett';
  }
}

function updateHUD() {
  energyDisplay.textContent = `${state.energy}`;
  lifeDisplay.textContent = `${state.life}`;
  waveDisplay.textContent = `${Math.min(state.wave + (state.playing ? 0 : 0), waves.length)}/${waves.length}`;
}

// Rajzoljuk ki az alap állapotot, hogy Start előtt is látszódjon a pálya.
drawScene();
