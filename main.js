const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const goldEl = document.getElementById('gold');
const livesEl = document.getElementById('lives');
const waveEl = document.getElementById('wave');
const enemiesEl = document.getElementById('enemies');
const towerCostEl = document.getElementById('towerCost');
const startBtn = document.getElementById('startWave');
const resetBtn = document.getElementById('resetGame');
const speedSelect = document.getElementById('speedSelect');

const CELL = 45;
const COLS = canvas.width / CELL;
const ROWS = canvas.height / CELL;
const TOWER_COST = 45;
const RANGE = CELL * 3.1;
const FIRE_RATE = 1.2;
const BULLET_SPEED = 380;

const pathCells = [
  { c: 0, r: 6 },
  { c: 4, r: 6 },
  { c: 4, r: 3 },
  { c: 9, r: 3 },
  { c: 9, r: 8 },
  { c: 14, r: 8 },
  { c: 14, r: 4 },
  { c: 19, r: 4 }
];

const waves = [
  { count: 8, hp: 28, speed: 45, reward: 6, tint: '#fef08a' },
  { count: 10, hp: 36, speed: 55, reward: 7, tint: '#f87171' },
  { count: 12, hp: 44, speed: 62, reward: 8, tint: '#60a5fa' },
  { count: 14, hp: 60, speed: 70, reward: 9, tint: '#10b981' },
  { count: 12, hp: 90, speed: 56, reward: 10, armor: 0.12, tint: '#f97316' },
  { count: 16, hp: 95, speed: 78, reward: 10, tint: '#a855f7' },
  { count: 18, hp: 120, speed: 82, reward: 11, armor: 0.18, tint: '#fb7185' },
  { count: 20, hp: 150, speed: 92, reward: 12, armor: 0.22, tint: '#22d3ee' }
];

const state = {
  gold: 120,
  lives: 20,
  waveIndex: -1,
  enemies: [],
  towers: [],
  bullets: [],
  running: false,
  spawnTimer: 0,
  spawned: 0,
  message: 'Készen állsz! Helyezz tornyot a szabad mezőkre.',
  speed: 1
};

towerCostEl.textContent = TOWER_COST;

function toPixels(cell) {
  return {
    x: cell.c * CELL + CELL / 2,
    y: cell.r * CELL + CELL / 2
  };
}

const pathPoints = pathCells.map(toPixels);

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
}

class Enemy {
  constructor(waveData) {
    this.maxHp = waveData.hp;
    this.hp = waveData.hp;
    this.speed = waveData.speed;
    this.reward = waveData.reward;
    this.armor = waveData.armor ?? 0;
    this.tint = waveData.tint;
    this.segment = 0;
    this.progress = 0;
    this.radius = 12;
    this.isDead = false;
  }

  update(dt) {
    if (this.isDead) return;
    let remaining = this.speed * dt;
    while (remaining > 0 && this.segment < pathPoints.length - 1) {
      const from = pathPoints[this.segment];
      const to = pathPoints[this.segment + 1];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.hypot(dx, dy);
      const segmentRemaining = dist * (1 - this.progress);

      if (remaining < segmentRemaining) {
        this.progress += remaining / dist;
        remaining = 0;
      } else {
        remaining -= segmentRemaining;
        this.segment++;
        this.progress = 0;
      }
    }

    if (this.segment >= pathPoints.length - 1) {
      this.isDead = true;
      state.lives = Math.max(0, state.lives - 1);
      state.message = 'Egy egység áttört!';
    }
  }

  draw(ctx) {
    if (this.isDead) return;
    const pos = this.position();
    const pct = this.hp / this.maxHp;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.fillStyle = this.tint;
    ctx.shadowColor = this.tint;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 2, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    // HP bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-16, -22, 32, 6);
    ctx.fillStyle = pct > 0.5 ? '#22c55e' : '#fbbf24';
    if (pct <= 0.25) ctx.fillStyle = '#f87171';
    ctx.fillRect(-16, -22, 32 * pct, 6);
    ctx.restore();
  }

  position() {
    const from = pathPoints[this.segment] ?? pathPoints[0];
    const to = pathPoints[this.segment + 1] ?? pathPoints[pathPoints.length - 1];
    return {
      x: lerp(from.x, to.x, this.progress),
      y: lerp(from.y, to.y, this.progress)
    };
  }

  takeDamage(amount) {
    const mitigated = amount * (1 - this.armor);
    this.hp -= mitigated;
    if (this.hp <= 0 && !this.isDead) {
      this.isDead = true;
      state.gold += this.reward;
    }
  }
}

class Tower {
  constructor(col, row) {
    this.col = col;
    this.row = row;
    this.x = col * CELL + CELL / 2;
    this.y = row * CELL + CELL / 2;
    this.range = RANGE;
    this.cooldown = 0;
    this.fireDelay = 1 / FIRE_RATE;
  }

  update(dt) {
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      const target = this.findTarget();
      if (target) {
        this.fire(target);
        this.cooldown = this.fireDelay;
      }
    }
  }

  findTarget() {
    let chosen = null;
    let bestProgress = -Infinity;
    for (const enemy of state.enemies) {
      if (enemy.isDead) continue;
      const pos = enemy.position();
      const dist = Math.hypot(pos.x - this.x, pos.y - this.y);
      if (dist <= this.range) {
        const progressScore = enemy.segment + enemy.progress;
        if (progressScore > bestProgress) {
          bestProgress = progressScore;
          chosen = enemy;
        }
      }
    }
    return chosen;
  }

  fire(target) {
    state.bullets.push(
      new Bullet(this.x, this.y, target)
    );
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const gradient = ctx.createLinearGradient(-12, -12, 12, 12);
    gradient.addColorStop(0, '#7c3aed');
    gradient.addColorStop(1, '#22d3ee');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Bullet {
  constructor(x, y, target) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.speed = BULLET_SPEED;
    this.damage = 22;
  }

  update(dt) {
    if (!this.target || this.target.isDead) return true;
    const pos = this.target.position();
    const dx = pos.x - this.x;
    const dy = pos.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      this.target.takeDamage(this.damage);
      return true;
    }
    const move = this.speed * dt;
    const nx = dx / dist;
    const ny = dy / dist;
    this.x += nx * Math.min(move, dist);
    this.y += ny * Math.min(move, dist);
    return false;
  }

  draw(ctx) {
    if (!this.target || this.target.isDead) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.target.position().x, this.target.position().y);
    ctx.stroke();
    ctx.restore();
  }
}

function isPathCell(col, row) {
  return pathCells.some((cell, i) => {
    const next = pathCells[i + 1];
    if (!next) return col === cell.c && row === cell.r;
    const minC = Math.min(cell.c, next.c);
    const maxC = Math.max(cell.c, next.c);
    const minR = Math.min(cell.r, next.r);
    const maxR = Math.max(cell.r, next.r);
    return col >= minC && col <= maxC && row >= minR && row <= maxR;
  });
}

function handleCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const col = Math.floor(x / CELL);
  const row = Math.floor(y / CELL);

  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  if (isPathCell(col, row)) {
    state.message = 'Az ösvényre nem építhetsz!';
    return;
  }
  const occupied = state.towers.some(t => t.col === col && t.row === row);
  if (occupied) {
    state.message = 'Itt már áll egy torony.';
    return;
  }
  if (state.gold < TOWER_COST) {
    state.message = 'Nincs elég aranyod ehhez a toronyhoz.';
    return;
  }

  state.gold -= TOWER_COST;
  state.towers.push(new Tower(col, row));
  state.message = 'Új Lángtorony felállítva!';
}

canvas.addEventListener('click', handleCanvasClick);

startBtn.addEventListener('click', () => {
  if (state.waveIndex >= waves.length - 1 && !state.running && state.enemies.length === 0) {
    state.message = 'Már minden hullámot túléltél!';
    return;
  }
  if (state.running) {
    state.message = 'A hullám már folyamatban van!';
    return;
  }
  startNextWave();
});

resetBtn.addEventListener('click', resetGame);

speedSelect.addEventListener('change', () => {
  state.speed = Number(speedSelect.value);
});

function startNextWave() {
  if (state.waveIndex >= waves.length - 1) return;
  state.waveIndex++;
  state.spawned = 0;
  state.spawnTimer = 0;
  state.running = true;
  state.message = `Hullám #${state.waveIndex + 1} elindult!`;
}

function resetGame() {
  state.gold = 120;
  state.lives = 20;
  state.waveIndex = -1;
  state.enemies = [];
  state.towers = [];
  state.bullets = [];
  state.running = false;
  state.spawnTimer = 0;
  state.spawned = 0;
  state.message = 'Újrakezdve! Helyezz tornyokat és indítsd a hullámot.';
}

function spawnEnemy(dt) {
  const wave = waves[state.waveIndex];
  if (!wave) return;
  const spawnInterval = Math.max(0.45, 1 - state.waveIndex * 0.05);
  state.spawnTimer += dt * state.speed;
  if (state.spawnTimer >= spawnInterval && state.spawned < wave.count) {
    state.spawnTimer = 0;
    state.spawned++;
    state.enemies.push(new Enemy(wave));
  }

  if (state.spawned >= wave.count && state.enemies.every(e => e.isDead)) {
    state.running = false;
    if (state.waveIndex >= waves.length - 1) {
      if (state.lives > 0) state.message = 'Győzelem! Minden hullámot megállítottál.';
    } else {
      state.message = 'Hullám vége! Jöhet a következő.';
    }
  }
}

function update(dt) {
  if (state.running) {
    spawnEnemy(dt);
  }

  state.enemies.forEach(e => e.update(dt * state.speed));

  state.towers.forEach(t => t.update(dt * state.speed));

  state.bullets = state.bullets.filter(b => !b.update(dt * state.speed));

  state.enemies = state.enemies.filter(e => !e.isDead);

  if (state.lives <= 0) {
    state.running = false;
    state.message = 'Elbuktad a kristályt! Próbáld újra az Újrakezdés gombbal.';
  }
}

function drawGrid() {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#111827';
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, canvas.height);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(canvas.width, r * CELL);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPath() {
  ctx.save();
  ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
  ctx.lineWidth = 3;
  pathCells.forEach((cell, i) => {
    const next = pathCells[i + 1];
    if (!next) return;
    const minC = Math.min(cell.c, next.c);
    const maxC = Math.max(cell.c, next.c);
    const minR = Math.min(cell.r, next.r);
    const maxR = Math.max(cell.r, next.r);
    const width = (maxC - minC + 1) * CELL;
    const height = (maxR - minR + 1) * CELL;
    roundRect(ctx, minC * CELL, minR * CELL, width, height, 6);
    ctx.fill();
    ctx.stroke();
  });

  const startPos = toPixels(pathCells[0]);
  const endPos = toPixels(pathCells[pathCells.length - 1]);

  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(startPos.x, startPos.y, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(endPos.x, endPos.y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTowers() {
  state.towers.forEach(tower => tower.draw(ctx));
}

function drawBullets() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  state.bullets.forEach(b => b.draw(ctx));
  ctx.restore();
}

function drawEnemies() {
  state.enemies.forEach(e => e.draw(ctx));
}

function drawRangeHighlights() {
  ctx.save();
  ctx.fillStyle = 'rgba(124, 58, 237, 0.07)';
  ctx.strokeStyle = 'rgba(124, 58, 237, 0.2)';
  ctx.lineWidth = 2;
  state.towers.forEach(t => {
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function drawMessage() {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(16, canvas.height - 62, canvas.width - 32, 46);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '600 16px "Inter", "Segoe UI", sans-serif';
  ctx.fillText(state.message, 28, canvas.height - 32);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawPath();
  drawRangeHighlights();
  drawTowers();
  drawBullets();
  drawEnemies();
  drawMessage();
}

function updateHud() {
  goldEl.textContent = Math.floor(state.gold);
  livesEl.textContent = state.lives;
  waveEl.textContent = `${Math.max(state.waveIndex + 1, 0)} / ${waves.length}`;
  enemiesEl.textContent = state.enemies.filter(e => !e.isDead).length;
}

let lastTime = performance.now();
function tick(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  update(dt);
  draw();
  updateHud();
  requestAnimationFrame(tick);
}

resetGame();
tick(lastTime);

console.log('TD Academy v0.1.0 betöltve');
