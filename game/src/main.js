import {
  VIEW_W, VIEW_H, CELL, ROAD, WORLD, GRID,
  makeRng, rnd, clamp, wrapAngle, createWorld, createCar, roadPoint, districtName,
} from './world.js';
import { createPlayer, updatePlayer, tryEnterVehicle } from './player.js';
import { createPolice, spawnPolice, updatePolice } from './police.js';
import { createCombat, spawn as spawnShot, burst, explosion, updateCombat } from './shots.js';
import { renderGame, renderMinimap, updateCamera } from './render.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const mini = $('minimap');
const mctx = mini.getContext('2d');

const ui = {
  stage: $('stage'),
  hud: $('hud'),
  start: $('startScreen'),
  end: $('endScreen'),
  healthText: $('healthText'),
  healthBar: $('healthBar'),
  wantedText: $('wantedText'),
  moneyText: $('moneyText'),
  districtText: $('districtText'),
  missionTitle: $('missionTitle'),
  missionDesc: $('missionDesc'),
  missionBar: $('missionBar'),
  missionCount: $('missionCount'),
  toast: $('toast'),
  endKicker: $('endKicker'),
  endTitle: $('endTitle'),
  endSubtitle: $('endSubtitle'),
  statCash: $('statCash'),
  statMissions: $('statMissions'),
  statWanted: $('statWanted'),
  statKills: $('statKills'),
};

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const shotMode = shot === 'start' || shot === 'play' || shot === 'end';
const seed = Math.max(1, parseInt(params.get('seed') || '1', 10) || 1);
const SAVE_KEY = 'neon-hustle-save-v1';

const MISSIONS = [
  { title: 'CASH RUN', desc: 'Collect 5 bundles of marked cash', target: 5, reward: 300, type: 'money' },
  { title: 'HOT RIDE', desc: 'Steal a car and reach the gold drop point', target: 1, reward: 600, type: 'car' },
  { title: 'CLEAN SWEEP', desc: 'Disable 4 pursuit cruisers', target: 4, reward: 1200, type: 'police' },
];

const game = {
  shotMode, shot, seed, frame: 0, mode: 'start',
  rng: makeRng(seed + 991),
  world: null, player: null, traffic: [], police: [], combat: null,
  input: { keys: new Set(), down: false, mx: VIEW_W / 2, my: VIEW_H / 2 },
  worldMouse: { x: 0, y: 0 },
  camera: { x: VIEW_W / 2, y: VIEW_H / 2 },
  missionIndex: 0, missionProgress: 0, carArmed: false,
  toastText: '', toastFrames: 0,
  lastCrime: 0,
  stats: { earned: 0, missions: 0, maxWanted: 0, kills: 0 },
  save: { best: 0, runs: 0 },
  endReason: 'win',
  saved: false,
  paused: false,

  addWanted(n) {
    if (this.player.wanted >= 5) return;
    this.player.wanted = Math.min(5, this.player.wanted + n);
    this.lastCrime = this.frame;
    this.stats.maxWanted = Math.max(this.stats.maxWanted, this.player.wanted);
    const need = this.player.wanted + 1;
    while (this.police.length < need) spawnPolice(this, 1);
    if (!this.shotMode) this.toast('WANTED LEVEL ' + this.player.wanted);
  },

  toast(msg) {
    this.toastText = msg;
    this.toastFrames = 120;
  },

  onKill(type) {
    if (type === 'police') {
      this.stats.kills++;
      this.player.money += 50;
      this.stats.earned += 50;
      if (this.missionIndex === 2 && MISSIONS[2].type === 'police') {
        this.missionProgress++;
        checkMission();
      }
    } else {
      this.addWanted(1);
    }
  },
};

function resize() {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  ui.stage.style.setProperty('--scale', String(clamp(scale, 0.25, 2.4)));
}

function loadSave() {
  if (shotMode) return;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      game.save.best = data.best || 0;
      game.save.runs = data.runs || 0;
    }
  } catch (err) {
    game.save.best = 0;
    game.save.runs = 0;
  }
}

function persist() {
  if (shotMode) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      best: Math.max(game.save.best, game.stats.earned),
      runs: game.save.runs + 1,
    }));
  } catch (err) {
    return;
  }
}

function buildRun() {
  game.frame = 0;
  game.rng = makeRng((seed + 991 + game.save.runs * 17) >>> 0);
  game.world = createWorld(seed, null);
  game.combat = createCombat(makeRng((seed ^ 0x5bf03635) >>> 0));
  game.combat.spawn = (x, y, a, o, s, c) => spawnShot(game.combat, x, y, a, o, s, c);
  game.combat.burst = (x, y, c, n) => burst(game.combat, x, y, c, n);
  game.combat.explosion = (x, y) => explosion(game.combat, x, y);
  game.player = createPlayer(game.world, game.rng);
  game.traffic = [];
  for (let i = 0; i < 14; i++) {
    const p = roadPoint(game.rng);
    const c = createCar(game.rng, p.x, p.y, p.angle, false);
    c.speed = c.maxSpeed * 0.75;
    c.nextTurn = rnd(game.rng, 140, 420);
    c.travelled = 0;
    c.cooldown = 0;
    game.traffic.push(c);
  }
  game.police = createPolice(game.rng, 2);
  game.missionIndex = 0;
  game.missionProgress = 0;
  game.carArmed = false;
  game.lastCrime = 0;
  game.stats = { earned: 0, missions: 0, maxWanted: 0, kills: 0 };
  game.toastText = '';
  game.toastFrames = 0;
  game.saved = false;
  game.paused = false;
  game.worldMouse.x = game.player.x + 120;
  game.worldMouse.y = game.player.y - 60;
  updateCamera(game, true);
}

function checkMission() {
  const m = MISSIONS[game.missionIndex];
  if (!m || game.missionProgress < m.target) return;
  game.player.money += m.reward;
  game.stats.earned += m.reward;
  game.stats.missions++;
  game.missionIndex++;
  game.missionProgress = 0;
  game.carArmed = false;
  game.toast('CONTRACT CLOSED  +$' + m.reward);
  if (game.missionIndex >= MISSIONS.length) {
    game.endReason = 'win';
    game.mode = 'end';
  }
}

function syncScreens() {
  ui.start.classList.toggle('hidden', game.mode !== 'start');
  ui.end.classList.toggle('hidden', game.mode !== 'end');
  ui.hud.classList.toggle('hidden', game.mode !== 'play');
}

function showEnd() {
  const win = game.endReason === 'win';
  ui.endKicker.textContent = win ? 'ALL CONTRACTS CLOSED' : 'THE HEAT CAUGHT UP';
  ui.endTitle.textContent = win ? 'CITY CLEARED' : 'BUSTED';
  ui.endSubtitle.textContent = win
    ? 'Every contract closed. Lumen Bay remembers your name.'
    : 'The cruisers closed in. The city keeps the cash.';
  ui.statCash.textContent = '$' + game.stats.earned;
  ui.statMissions.textContent = game.stats.missions + ' / 3';
  ui.statWanted.textContent = game.stats.maxWanted + ' STARS';
  ui.statKills.textContent = String(game.stats.kills);
}

function composeShot() {
  const p = game.player;
  if (shot === 'start') {
    game.frame = 36;
    p.inCar = true;
    p.speed = 0.6;
    p.car.speed = 0.6;
    p.wanted = 0;
    p.money = 0;
    const spots = [
      { x: p.x - 180, y: p.y - 70, a: 0 },
      { x: p.x + 190, y: p.y + 60, a: Math.PI / 2 },
      { x: p.x + 80, y: p.y - 160, a: 0 },
    ];
    for (let i = 0; i < spots.length && i < game.traffic.length; i++) {
      const c = game.traffic[i];
      c.x = spots[i].x; c.y = spots[i].y; c.angle = spots[i].a;
    }
    for (let i = 0; i < game.police.length; i++) {
      game.police[i].x = clamp(p.x + 760 + i * 40, 40, WORLD - 40);
      game.police[i].y = clamp(p.y - 500, 40, WORLD - 40);
    }
    game.world.money[0].x = p.x + 96; game.world.money[0].y = p.y - 74;
    game.world.money[1].x = p.x - 84; game.world.money[1].y = p.y + 82;
    game.world.missionPoints[0] = { x: p.x + 250, y: p.y - 130 };
    updateCamera(game, true);
    return;
  }

  if (shot === 'play') {
    game.frame = 180;
    p.inCar = true;
    p.car.speed = 1.35;
    p.wanted = 3;
    p.health = 86;
    p.money = 1240;
    game.stats = { earned: 1240, missions: 1, maxWanted: 3, kills: 2 };
    game.missionIndex = 0;
    game.missionProgress = 3;
    const offsets = [
      { x: -150, y: -96 }, { x: 176, y: 74 }, { x: 96, y: -152 }, { x: -210, y: 118 },
    ];
    game.police = createPolice(makeRng(seed + 77), offsets.length);
    for (let i = 0; i < game.police.length; i++) {
      const c = game.police[i];
      c.x = clamp(p.x + offsets[i].x, 20, WORLD - 20);
      c.y = clamp(p.y + offsets[i].y, 20, WORLD - 20);
      c.angle = Math.atan2(p.y - c.y, p.x - c.x);
      c.speed = 1.2;
      c.flash = i * 5;
    }
    game.traffic[0].x = p.x + 210; game.traffic[0].y = p.y + 108; game.traffic[0].angle = 0;
    game.traffic[1].x = p.x - 240; game.traffic[1].y = p.y - 40; game.traffic[1].angle = Math.PI / 2;
    game.world.missionPoints[0] = { x: p.x + 232, y: p.y - 122 };
    for (let i = 0; i < 3; i++) {
      const m = game.world.money[i];
      m.taken = false;
      m.x = p.x + 70 + i * 46;
      m.y = p.y - 60 - (i % 2) * 44;
    }
    game.combat.spawn(p.x + 24, p.y - 6, -0.35, 'player', 5.4, '#ffe66b');
    game.combat.spawn(p.x + 34, p.y - 12, -0.2, 'player', 5.4, '#ffe66b');
    game.combat.spawn(game.police[0].x + 16, game.police[0].y + 4, 0.42, 'police', 3.9, '#ff5b6e');
    game.combat.burst(p.x + 60, p.y - 40, '#ffd23f', 8);
    updateCamera(game, true);
    game.toastText = 'CONTRACT 1 OF 3';
    game.toastFrames = 120;
    return;
  }

  game.frame = 260;
  p.inCar = true;
  p.car.speed = 0.9;
  p.wanted = 4;
  p.health = 100;
  p.money = 2480;
  game.stats = { earned: 2480, missions: 3, maxWanted: 4, kills: 11 };
  game.missionIndex = 3;
  game.missionProgress = 0;
  game.endReason = 'win';
  game.mode = 'end';
  const offsets = [
    { x: -160, y: -110 }, { x: 190, y: 90 }, { x: 120, y: -170 }, { x: -230, y: 130 },
  ];
  game.police = createPolice(makeRng(seed + 91), offsets.length);
  for (let i = 0; i < game.police.length; i++) {
    const c = game.police[i];
    c.x = clamp(p.x + offsets[i].x, 20, WORLD - 20);
    c.y = clamp(p.y + offsets[i].y, 20, WORLD - 20);
    c.angle = Math.atan2(p.y - c.y, p.x - c.x);
  }
  game.combat.explosion(game.police[0].x, game.police[0].y);
  game.combat.burst(p.x + 40, p.y - 50, '#ffd23f', 12);
  updateCamera(game, true);
  showEnd();
}

function updateMouseWorld() {
  const r = canvas.getBoundingClientRect();
  const sx = (game.input.mx - r.left) * (VIEW_W / Math.max(1, r.width));
  const sy = (game.input.my - r.top) * (VIEW_H / Math.max(1, r.height));
  game.worldMouse.x = sx - VIEW_W / 2 + game.camera.x;
  game.worldMouse.y = sy - VIEW_H / 2 + game.camera.y;
}

function updateTraffic(dt) {
  const rng = game.rng;
  for (let i = 0; i < game.traffic.length; i++) {
    const c = game.traffic[i];
    c.speed = c.maxSpeed * 0.72;
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (c.x < 0) c.x = WORLD;
    if (c.x > WORLD) c.x = 0;
    if (c.y < 0) c.y = WORLD;
    if (c.y > WORLD) c.y = 0;
    c.travelled += c.speed * dt;
    if (c.travelled > c.nextTurn) {
      c.travelled = 0;
      c.nextTurn = rnd(rng, 150, 430);
      if (rng() < 0.55) {
        c.angle = wrapAngle(c.angle + c.turn * Math.PI / 2);
        c.turn = rng() < 0.5 ? -1 : 1;
      }
    }
    if (Math.abs(Math.cos(c.angle)) > 0.5) c.y = Math.round(c.y / CELL) * CELL + (c.turn > 0 ? 14 : -14);
    else c.x = Math.round(c.x / CELL) * CELL + (c.turn > 0 ? -14 : 14);
  }
}

function updatePeds(dt) {
  const peds = game.world.peds;
  for (let i = 0; i < peds.length; i++) {
    const ped = peds[i];
    if (!ped.alive) continue;
    const target = ped.path[ped.idx];
    const dx = target.x - ped.x;
    const dy = target.y - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 5) ped.idx = (ped.idx + 1) % ped.path.length;
    else {
      ped.angle = Math.atan2(dy, dx);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
  }
}

function collectMoney() {
  const p = game.player;
  for (let i = 0; i < game.world.money.length; i++) {
    const m = game.world.money[i];
    if (m.taken || Math.hypot(m.x - p.x, m.y - p.y) > 28) continue;
    m.taken = true;
    p.money += m.value;
    game.stats.earned += m.value;
    game.combat.burst(m.x, m.y, '#3dffa8', 7);
    if (game.missionIndex === 0 && MISSIONS[0].type === 'money') {
      game.missionProgress++;
      checkMission();
    }
  }
}

function missionLogic() {
  const p = game.player;
  const m = MISSIONS[game.missionIndex];
  if (!m) return;
  if (m.type === 'car') {
    if (!game.carArmed && p.inCar && p.car && p.car.stolen) {
      game.carArmed = true;
      game.toast('RIDE SECURED — FIND THE DROP');
    }
    const drop = game.world.missionPoints[1];
    if (game.carArmed && p.inCar && Math.hypot(p.x - drop.x, p.y - drop.y) < 64) {
      game.missionProgress = 1;
      checkMission();
    }
  }
}

function wantedDecay() {
  const p = game.player;
  if (p.wanted > 0 && game.frame - game.lastCrime > 60 * 16) {
    p.wanted--;
    game.lastCrime = game.frame;
    game.toast('HEAT COOLING');
  }
}

function step() {
  game.frame++;
  if (game.toastFrames > 0) game.toastFrames--;
  updateTraffic(1);
  updatePeds(1);
  if (game.mode !== 'play') {
    updateCamera(game, false);
    return;
  }
  updateMouseWorld();
  const wasInCar = game.player.inCar;
  updatePlayer(game.player, game, 1);
  if (!wasInCar && game.player.inCar) game.toast('RIDE SECURED');
  updatePolice(game.police, game, 1);
  updateCombat(game.combat, game, 1);
  collectMoney();
  missionLogic();
  wantedDecay();
  updateCamera(game, false);
  if (game.mode === 'end' && !game.saved) {
    game.saved = true;
    persist();
    showEnd();
    syncScreens();
  }
}

function updateHud() {
  const p = game.player;
  ui.healthText.textContent = String(Math.ceil(p.health));
  ui.healthBar.style.width = clamp(p.health, 0, 100) + '%';
  ui.wantedText.textContent = '★'.repeat(p.wanted) + '☆'.repeat(5 - p.wanted);
  ui.moneyText.textContent = '$' + p.money;
  ui.districtText.textContent = districtName(p.x, p.y);
  const m = MISSIONS[game.missionIndex];
  if (m) {
    ui.missionTitle.textContent = m.title;
    ui.missionDesc.textContent = m.desc;
    ui.missionCount.textContent = Math.min(game.missionProgress, m.target) + ' / ' + m.target;
    ui.missionBar.style.width = clamp(game.missionProgress / m.target, 0, 1) * 100 + '%';
  } else {
    ui.missionTitle.textContent = 'ALL CONTRACTS CLOSED';
    ui.missionDesc.textContent = 'Lumen Bay is yours tonight';
    ui.missionCount.textContent = '3 / 3';
    ui.missionBar.style.width = '100%';
  }
  ui.toast.textContent = game.toastText;
  ui.toast.classList.toggle('show', game.toastFrames > 0 && game.mode === 'play');
  renderMinimap(mctx, game);
}

function loop() {
  if (game.shotMode) return;
  if (!game.paused) {
    step();
    renderGame(ctx, game);
    updateHud();
  }
  requestAnimationFrame(loop);
}

function startRun() {
  if (game.shotMode || game.mode !== 'start') return;
  game.mode = 'play';
  game.lastCrime = game.frame;
  game.toast('CONTRACT 1 OF 3');
  syncScreens();
}

function restart() {
  if (game.shotMode) return;
  buildRun();
  game.mode = 'play';
  game.lastCrime = 0;
  game.toast('NEW RUN — CONTRACT 1 OF 3');
  syncScreens();
  renderGame(ctx, game);
  updateHud();
}

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  game.input.keys.add(key);
  if (key === ' ' || key.startsWith('arrow')) e.preventDefault();
  if (game.shotMode) return;
  if (game.mode === 'start' && key === 'enter') startRun();
  if (game.mode === 'end' && key === 'r') restart();
  if (game.mode === 'play' && key === 'e') tryEnterVehicle(game.player, game);
  if (key === 'escape' && game.mode === 'play') game.paused = !game.paused;
});

window.addEventListener('keyup', (e) => {
  game.input.keys.delete(e.key.toLowerCase());
});

window.addEventListener('mousemove', (e) => {
  game.input.mx = e.clientX;
  game.input.my = e.clientY;
});

window.addEventListener('mousedown', (e) => {
  if (game.shotMode || game.mode !== 'play') return;
  if (e.target === canvas) game.input.down = true;
});

window.addEventListener('mouseup', () => {
  game.input.down = false;
});

$('startBtn').addEventListener('click', startRun);
$('restartBtn').addEventListener('click', restart);
window.addEventListener('resize', resize);

resize();
loadSave();
buildRun();

if (shotMode) {
  game.mode = shot;
  composeShot();
  syncScreens();
  renderGame(ctx, game);
  updateHud();
} else {
  game.mode = 'start';
  syncScreens();
  renderGame(ctx, game);
  updateHud();
  requestAnimationFrame(loop);
}
