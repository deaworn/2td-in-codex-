const VERSION = '0.3.0';
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const versionBadge = document.getElementById('versionBadge');

const goldEl = document.getElementById('gold');
const livesEl = document.getElementById('lives');
const waveEl = document.getElementById('wave');
const enemiesEl = document.getElementById('enemies');
const towerNameEl = document.getElementById('towerName');
const upgradePointsEl = document.getElementById('upgradePoints');
const startBtn = document.getElementById('startWave');
const resetBtn = document.getElementById('resetGame');
const speedSelect = document.getElementById('speedSelect');
const towerButtons = Array.from(document.querySelectorAll('.tower-btn'));

document.title = `TD Academy v${VERSION}`;
if (versionBadge) versionBadge.textContent = `v${VERSION}`;

const CELL = 45;
const COLS = canvas.width / CELL;
const ROWS = canvas.height / CELL;
const RANGE = CELL * 3.1;

const towerTypes = {
  flame: {
    name: 'Lángtorony',
    cost: 45,
    range: RANGE,
    fireRate: 1.25,
    damage: 22,
    bulletSpeed: 380,
    color: '#f97316'
  },
  frost: {
    name: 'Fagyasztó torony',
    cost: 55,
    range: RANGE * 0.92,
    fireRate: 1,
    damage: 12,
    bulletSpeed: 320,
    color: '#38bdf8',
    slow: {
      amount: 0.55,
      duration: 1.6
    }
  },
  tesla: {
    name: 'Szikra torony',
    cost: 70,
    range: RANGE * 1.05,
    fireRate: 0.9,
    damage: 18,
    bulletSpeed: 420,
    color: '#a855f7',
    chain: {
      range: 110,
      falloff: 0.55
    }
  }
};

const pathCells = [
  { c: 0, r: 3 },
  { c: 4, r: 3 },
  { c: 4, r: 1 },
  { c: 9, r: 1 },
  { c: 9, r: 5 },
  { c: 13, r: 5 },
  { c: 13, r: 9 },
  { c: 17, r: 9 },
  { c: 17, r: 6 },
  { c: 19, r: 6 }
];

const waves = [
  { count: 8, hp: 28, speed: 45, reward: 6, tint: '#fef08a' },
  { count: 10, hp: 36, speed: 55, reward: 7, tint: '#f87171' },
  { count: 12, hp: 44, speed: 62, reward: 8, tint: '#60a5fa' },
  { count: 14, hp: 60, speed: 70, reward: 9, tint: '#10b981' },
  { count: 12, hp: 90, speed: 56, reward: 10, armor: 0.12, tint: '#f97316' },
  { count: 16, hp: 95, speed: 78, reward: 10, tint: '#a855f7' },
  { count: 18, hp: 120, speed: 82, reward: 11, armor: 0.18, tint: '#fb7185' },
  { count: 12, hp: 200, speed: 85, reward: 13, armor: 0.22, tint: '#22d3ee' },
  { count: 1, hp: 600, speed: 70, reward: 40, armor: 0.3, tint: '#facc15', boss: true }
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
  message: 'Készen állsz! Válassz tornyot és kattints a pályára.',
  speed: 1,
  selectedTower: 'flame',
  hover: null,
  upgradePoints: 0
};

towerNameEl.textContent = `${towerTypes[state.selectedTower].name} (${towerTypes[state.selectedTower].cost})`;

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

function withAlpha(hex, alpha) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

function drawHex(ctx, x, y, size) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i - Math.PI / 6;
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawDiamond(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x, y + h / 2);
  ctx.lineTo(x - w / 2, y);
  ctx.closePath();
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
    this.radius = waveData.boss ? 16 : 12;
    this.isDead = false;
    this.slowTimer = 0;
    this.speedFactor = 1;
    this.isBoss = Boolean(waveData.boss);
  }

  update(dt) {
    if (this.isDead) return;
    let remaining = this.speed * this.speedFactor * dt;
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

    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.speedFactor = 1;
      }
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
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 2, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-18, -24, 36, 7);
    ctx.fillStyle = pct > 0.6 ? '#22c55e' : '#fbbf24';
    if (pct <= 0.25) ctx.fillStyle = '#f87171';
    ctx.fillRect(-18, -24, 36 * pct, 7);
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
      if (this.isBoss) {
        state.upgradePoints += 2;
        state.message = 'Főellenség elfüstölt! +2 fejlesztési pont';
      } else {
        state.message = 'Ellenség legyőzve – bónusz arany!';
      }
    }
  }

  applySlow(factor, duration) {
    this.speedFactor = Math.min(this.speedFactor, factor);
    this.slowTimer = Math.max(this.slowTimer, duration);
  }
}

class Tower {
  constructor(col, row, typeKey) {
    this.col = col;
    this.row = row;
    this.x = col * CELL + CELL / 2;
    this.y = row * CELL + CELL / 2;
    this.type = typeKey;
    this.config = towerTypes[typeKey];
    this.range = this.config.range;
    this.cooldown = 0;
    this.fireDelay = 1 / this.config.fireRate;
    this.level = 1;
    this.damageBonus = 0;
    this.rangeBonus = 0;
    this.fireRateBonus = 0;
    this.pendingUpgradeGlow = 0;
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
    state.bullets.push(new Bullet(this.x, this.y, target, this.type, this.config, this.damageBonus));
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f172a';

    if (this.pendingUpgradeGlow > 0) {
      ctx.shadowColor = this.config.color;
      ctx.shadowBlur = 20 * this.pendingUpgradeGlow;
      this.pendingUpgradeGlow = Math.max(0, this.pendingUpgradeGlow - 0.02);
    } else {
      ctx.shadowBlur = 0;
    }

    if (this.type === 'flame') {
      const gradient = ctx.createLinearGradient(-14, -14, 14, 14);
      gradient.addColorStop(0, '#fb923c');
      gradient.addColorStop(1, '#f97316');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fff3e0';
      drawDiamond(ctx, 0, 0, 10, 14);
      ctx.fill();
    } else if (this.type === 'frost') {
      ctx.fillStyle = '#38bdf8';
      drawHex(ctx, 0, 0, 13);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'tesla') {
      ctx.fillStyle = '#a855f7';
      roundRect(ctx, -14, -14, 28, 28, 6);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-8, 4);
      ctx.lineTo(-2, -6);
      ctx.lineTo(4, 6);
      ctx.lineTo(9, -4);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(14, -14, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 10px \"Inter\", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.level, 14, -14.5);

    ctx.restore();
  }

  upgrade() {
    if (state.upgradePoints <= 0) return false;
    state.upgradePoints -= 1;
    this.level += 1;
    this.damageBonus += this.config.damage * 0.15;
    this.rangeBonus += this.config.range * 0.06;
    this.fireRateBonus += 0.07;
    this.range += this.config.range * 0.06;
    this.fireDelay = 1 / (this.config.fireRate + this.fireRateBonus);
    this.pendingUpgradeGlow = 1;
    state.message = `${this.config.name} fejlesztve (Lv.${this.level})`;
    return true;
  }
}

class Bullet {
  constructor(x, y, target, typeKey, config, damageBonus = 0) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.type = typeKey;
    this.config = config;
    this.speed = config.bulletSpeed;
    this.damage = config.damage + damageBonus;
  }

  update(dt) {
    if (!this.target || this.target.isDead) return true;
    const pos = this.target.position();
    const dx = pos.x - this.x;
    const dy = pos.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      this.target.takeDamage(this.damage);
      if (this.config.slow && !this.target.isDead) {
        this.target.applySlow(this.config.slow.amount, this.config.slow.duration);
      }
      if (this.config.chain) {
        const nearby = state.enemies.find(e => !e.isDead && e !== this.target && Math.hypot(e.position().x - pos.x, e.position().y - pos.y) <= this.config.chain.range);
        if (nearby) {
          nearby.takeDamage(this.damage * this.config.chain.falloff);
        }
      }
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
    ctx.lineWidth = 3;
    if (this.type === 'flame') {
      ctx.strokeStyle = withAlpha('#fb923c', 0.95);
      ctx.shadowColor = '#fb923c';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.target.position().x, this.target.position().y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (this.type === 'frost') {
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = withAlpha('#7dd3fc', 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      drawDiamond(ctx, this.x, this.y, 10, 14);
      ctx.fill();
      ctx.stroke();
    } else if (this.type === 'tesla') {
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      const midX = (this.x + this.target.position().x) / 2;
      const midY = (this.y + this.target.position().y) / 2;
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(midX + 6, midY - 8);
      ctx.lineTo(this.target.position().x, this.target.position().y);
      ctx.stroke();
    }
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

function getPointer(evt) {
  if (evt.touches && evt.touches[0]) return evt.touches[0];
  return evt;
}

function screenToGrid(event) {
  const point = getPointer(event);
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (point.clientX - rect.left) * scaleX;
  const y = (point.clientY - rect.top) * scaleY;
  return { col: Math.floor(x / CELL), row: Math.floor(y / CELL) };
}

function handleCanvasClick(event) {
  const { col, row } = screenToGrid(event);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  if (isPathCell(col, row)) {
    state.message = 'Az ösvényre nem építhetsz!';
    return;
  }
  const towerHere = state.towers.find(t => t.col === col && t.row === row);
  if (towerHere) {
    if (state.upgradePoints > 0) {
      const upgraded = towerHere.upgrade();
      if (upgraded) return;
    } else {
      state.message = 'Nincs elég fejlesztési pontod. Hullámok után kapsz +1-et, a boss +2-t ad.';
      return;
    }
    state.message = 'Itt már áll egy torony. Fejlesztéshez szerezz pontot hullámokból!';
    return;
  }

  const config = towerTypes[state.selectedTower];
  if (state.gold < config.cost) {
    state.message = `Nincs elég aranyod (${config.cost}) ehhez a toronyhoz.`;
    return;
  }

  state.gold -= config.cost;
  state.towers.push(new Tower(col, row, state.selectedTower));
  state.message = `${config.name} felállítva!`;
}

function updateHoverFromPoint(event) {
  const { col, row } = screenToGrid(event);
  const inBounds = col >= 0 && col < COLS && row >= 0 && row < ROWS;
  if (!inBounds) {
    state.hover = null;
    return;
  }
  const config = towerTypes[state.selectedTower];
  const occupied = state.towers.some(t => t.col === col && t.row === row);
  const valid = !isPathCell(col, row) && !occupied && state.gold >= config.cost;
  state.hover = { col, row, valid, config };
}

canvas.addEventListener('click', handleCanvasClick);

canvas.addEventListener('mousemove', updateHoverFromPoint);

canvas.addEventListener('touchstart', event => {
  const pointer = getPointer(event);
  if (!pointer) return;
  handleCanvasClick(pointer);
  updateHoverFromPoint(pointer);
  event.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', event => {
  const pointer = getPointer(event);
  if (!pointer) return;
  updateHoverFromPoint(pointer);
  event.preventDefault();
}, { passive: false });

canvas.addEventListener('mouseleave', () => {
  state.hover = null;
});

canvas.addEventListener('touchend', () => {
  state.hover = null;
});

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

towerButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const towerKey = btn.dataset.tower;
    state.selectedTower = towerKey;
    towerButtons.forEach(b => b.classList.toggle('active', b.dataset.tower === towerKey));
    updateTowerHud();
    state.message = `${towerTypes[towerKey].name} kiválasztva. Kattints a lerakáshoz!`;
  });
});

function startNextWave() {
  if (state.waveIndex >= waves.length - 1) return;
  state.waveIndex++;
  state.spawned = 0;
  state.spawnTimer = 0;
  state.running = true;
  const waveInfo = waves[state.waveIndex];
  state.message = waveInfo.boss ? 'Főellenség érkezik! Készülj!' : `Hullám #${state.waveIndex + 1} elindult!`;
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
  state.upgradePoints = 0;
  state.message = 'Újrakezdve! Válassz tornyot és indítsd a hullámot.';
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
      state.upgradePoints += 1;
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
  ctx.strokeStyle = '#0f172a';
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

function drawPlayfieldBase() {
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.45, '#0c1324');
  grad.addColorStop(1, '#0b1324');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pads = [
    { c: 1, r: 6, w: 5, h: 2 },
    { c: 7, r: 8, w: 6, h: 2 },
    { c: 10, r: 2, w: 6, h: 2 },
    { c: 3, r: 9, w: 3, h: 2 }
  ];
  pads.forEach(pad => {
    const x = pad.c * CELL;
    const y = pad.r * CELL;
    const w = pad.w * CELL;
    const h = pad.h * CELL;
    ctx.fillStyle = 'rgba(16, 185, 129, 0.06)';
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.14)';
    ctx.lineWidth = 2;
    roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 10);
    ctx.fill();
    ctx.stroke();
  });

  const deco = [
    { x: canvas.width * 0.26, y: canvas.height * 0.22, r: 46, c: 'rgba(34, 211, 238, 0.12)' },
    { x: canvas.width * 0.75, y: canvas.height * 0.72, r: 54, c: 'rgba(124, 58, 237, 0.1)' },
    { x: canvas.width * 0.58, y: canvas.height * 0.38, r: 38, c: 'rgba(16, 185, 129, 0.1)' }
  ];
  deco.forEach(d => {
    const radial = ctx.createRadialGradient(d.x, d.y, d.r * 0.1, d.x, d.y, d.r);
    radial.addColorStop(0, d.c);
    radial.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

function drawPath() {
  ctx.save();
  ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
  ctx.lineWidth = 3.2;
  ctx.shadowColor = 'rgba(16, 185, 129, 0.35)';
  ctx.shadowBlur = 14;
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
  ctx.shadowBlur = 0;

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  pathCells.forEach(cell => {
    const px = cell.c * CELL + CELL / 2;
    const py = cell.r * CELL + CELL / 2;
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.stroke();
  });

  const startPos = toPixels(pathCells[0]);
  const endPos = toPixels(pathCells[pathCells.length - 1]);

  ctx.fillStyle = '#22c55e';
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(startPos.x, startPos.y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
  ctx.beginPath();
  ctx.arc(endPos.x, endPos.y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawGhostPlacement() {
  if (!state.hover) return;
  const { col, row, valid, config } = state.hover;
  const x = col * CELL + CELL / 2;
  const y = row * CELL + CELL / 2;
  ctx.save();
  ctx.fillStyle = valid ? withAlpha(config.color, 0.2) : 'rgba(248, 113, 113, 0.25)';
  ctx.strokeStyle = valid ? withAlpha(config.color, 0.45) : 'rgba(248, 113, 113, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, config.range, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = valid ? withAlpha(config.color, 0.8) : 'rgba(248, 113, 113, 0.9)';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
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
  state.towers.forEach(t => {
    ctx.fillStyle = withAlpha(t.config.color, 0.08);
    ctx.strokeStyle = withAlpha(t.config.color, 0.2);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function drawMessage() {
  ctx.save();
  const pad = 16;
  const height = 54;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  roundRect(ctx, pad, canvas.height - height - 12, canvas.width - pad * 2, height, 12);
  ctx.fill();
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '600 16px "Inter", "Segoe UI", sans-serif';
  ctx.fillText(state.message, pad + 12, canvas.height - 24);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPlayfieldBase();
  drawGrid();
  drawPath();
  drawGhostPlacement();
  drawRangeHighlights();
  drawTowers();
  drawBullets();
  drawEnemies();
  drawMessage();
}

function updateTowerHud() {
  const config = towerTypes[state.selectedTower];
  towerNameEl.textContent = `${config.name} (${config.cost}) • fejlesztés: 1 pont / szint`;
}

function updateHud() {
  goldEl.textContent = Math.floor(state.gold);
  livesEl.textContent = state.lives;
  waveEl.textContent = `${Math.max(state.waveIndex + 1, 0)} / ${waves.length}`;
  enemiesEl.textContent = state.enemies.filter(e => !e.isDead).length;
  upgradePointsEl.textContent = state.upgradePoints;
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
updateTowerHud();
tick(lastTime);

console.log(`TD Academy v${VERSION} betöltve`);
