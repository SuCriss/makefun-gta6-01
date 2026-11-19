import { WORLD_W, WORLD_H, clamp, makeRng, seedFromText, createWorld, spawnTraffic, spawnPedestrians, spawnCash, updateTraffic, updatePedestrians, MISSIONS } from './world.js';
import { createPlayer, updatePlayer, collectCash, damagePlayer } from './player.js';
import { createPolice, updatePolice, spawnCruiser, spawnOfficer } from './police.js';
import { createShots, updateShots, fireShot, burst } from './shots.js';
import { renderScene } from './render.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const shotMode = params.get('shot');
const rawSeed = params.get('seed');
const seed = rawSeed ? (Number.parseInt(rawSeed, 10) || seedFromText(rawSeed)) : 1;
const view = { w: shotMode ? 1280 : window.innerWidth, h: shotMode ? 720 : window.innerHeight };
canvas.width = view.w;
canvas.height = view.h;

const SAVE_KEY = 'neon-hustle-save-v1';
const STEP = 1 / 60;

const LABELS = {
  start: { scene: 'START SCREEN', tag: 'SCENE 01', caption: 'A neon skyline, a hot car, and a city that never sleeps. Press Enter to begin.' },
  play: { scene: 'LIVE CHASE', tag: 'SCENE 02', caption: 'Wanted level 3 — cruisers close in while cash and traffic fill the avenue.' },
  end: { scene: 'RESULTS', tag: 'SCENE 03', caption: 'The hustle is over: banked bounties, closed contracts, and a city conquered.' },
};

function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function writeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (error) {
    return;
  }
}

const input = { keys: new Set(), mouseDown: false, action: false, reload: false, aimX: view.w / 2, aimY: view.h / 2 };

const game = {
  screen: 'start',
  deterministic: Boolean(shotMode),
  shot: shotMode,
  seed: seed,
  rng: makeRng(seed),
  tick: 0,
  paused: false,
  shake: 0,
  toastText: '',
  toastTimer: 0,
  endReason: 'busted',
  missionIndex: 0,
  missionsDone: 0,
  cashCollected: 0,
  maxWanted: 0,
  score: 0,
  save: shotMode ? {} : loadSave(),
  camera: { x: view.w / 2, y: view.h / 2 },
  pointer: { x: view.w / 2, y: view.h / 2 },
  world: null,
  player: null,
  police: createPolice(),
  shots: createShots(),
  label: null,
  toast: function (text) {
    game.toastText = text;
    game.toastTimer = 2.1;
  },
};

const hooks = {
  rng: game.rng,
  player: null,
  police: game.police,
  damagePlayer: function (amount) {
    damagePlayer(game.player, amount, game);
  },
};

function cameraTarget() {
  const halfW = view.w / 2;
  const halfH = view.h / 2;
  const limitX = Math.max(halfW, WORLD_W - halfW);
  const limitY = Math.max(halfH, WORLD_H - halfH);
  return { x: clamp(game.player.x, halfW, limitX), y: clamp(game.player.y, halfH, limitY) };
}

function snapCamera() {
  if (!game.player) return;
  const target = cameraTarget();
  game.camera.x = target.x;
  game.camera.y = target.y;
}

function updateCamera() {
  if (!game.player) return;
  const target = cameraTarget();
  if (game.deterministic) {
    game.camera.x = target.x;
    game.camera.y = target.y;
  } else {
    game.camera.x += (target.x - game.camera.x) * 0.14;
    game.camera.y += (target.y - game.camera.y) * 0.14;
  }
}

function newGame() {
  game.rng = makeRng(seed ^ 0x2f6e2b1);
  hooks.rng = game.rng;
  game.world = createWorld(seed);
  spawnTraffic(game.world, makeRng(seed ^ 0x1a2b3c4d), 30);
  spawnPedestrians(game.world, makeRng(seed ^ 0x7c8d9eaf), 64);
  spawnCash(game.world, makeRng(seed ^ 0x3d4e5f60), 22);
  game.player = createPlayer(game.world);
  game.police = createPolice();
  game.shots = createShots();
  hooks.player = game.player;
  hooks.police = game.police;
  game.tick = 0;
  game.shake = 0;
  game.paused = false;
  game.toastText = '';
  game.toastTimer = 0;
  game.missionIndex = 0;
  game.missionsDone = 0;
  game.cashCollected = 0;
  game.maxWanted = 0;
  game.score = 0;
  game.endReason = 'busted';
  input.action = false;
  input.reload = false;
  snapCamera();
}

function finish(reason) {
  if (game.screen === 'end') return;
  game.endReason = reason;
  game.screen = 'end';
  game.score = game.player.cash + game.missionsDone * 500 + (reason === 'legend' ? 5000 : 0);
  if (!game.deterministic) {
    const save = loadSave();
    if (game.score > (save.high || 0)) save.high = game.score;
    save.runs = (save.runs || 0) + 1;
    writeSave(save);
    game.save = save;
  }
}

function updateMissions() {
  const mission = MISSIONS[game.missionIndex];
  if (!mission) return;
  let metric = 0;
  if (mission.kind === 'cash') metric = game.cashCollected;
  else if (mission.kind === 'drive') metric = game.player.driveDistance;
  else if (mission.kind === 'wanted') metric = game.player.wanted;
  else if (mission.kind === 'evade') metric = game.player.evadedCount;
  else if (mission.kind === 'bank') metric = game.player.cash;
  if (metric < mission.goal) return;
  game.player.cash += mission.reward;
  game.missionsDone += 1;
  game.missionIndex += 1;
  game.toast('CONTRACT CLOSED · +' + mission.reward);
  game.score = game.player.cash + game.missionsDone * 500;
  if (game.missionIndex >= MISSIONS.length) finish('legend');
}

function step(dt) {
  game.tick += 1;
  game.shake *= Math.pow(0.02, dt);
  updateTraffic(game.world.traffic, dt);
  updatePedestrians(game.world.pedestrians, dt);
  updateShots(game.shots, game.world, dt, hooks);
  if (game.screen !== 'play') return;

  updatePlayer(game.player, input, game.world, dt, game);
  collectCash(game.player, game.world, game);
  updatePolice(game.police, game.player, game.world, dt, game);
  game.maxWanted = Math.max(game.maxWanted, game.player.wanted);
  game.score = game.player.cash + game.missionsDone * 500;
  updateMissions();
  game.toastTimer = Math.max(0, game.toastTimer - dt);
  updateCamera();
  if (!game.player.alive) finish('busted');
}

function startPlay() {
  newGame();
  game.screen = 'play';
  game.toast('WELCOME TO NEON HUSTLE');
}

function composeShot() {
  newGame();
  game.label = LABELS[shotMode] || LABELS.start;

  if (shotMode === 'start') {
    game.screen = 'start';
    game.tick = 96;
    for (let index = 0; index < 6; index += 1) step(STEP);
    game.shake = 0;
    game.toastTimer = 0;
  } else if (shotMode === 'play') {
    game.screen = 'play';
    const player = game.player;
    const car = game.world.traffic[0];
    car.controlled = true;
    car.stolen = true;
    player.inCar = true;
    player.car = car;
    player.x = car.x;
    player.y = car.y;
    player.angle = car.heading;
    player.wanted = 3;
    player.cash = 1240;
    player.ammo = 11;
    game.cashCollected = 3;
    game.maxWanted = 3;
    for (let index = 0; index < 3; index += 1) spawnCruiser(game.police, player, game.world, game);
    for (let index = 0; index < 4; index += 1) spawnOfficer(game.police, player, game);
    fireShot(game.shots, player.x + Math.cos(player.angle) * 24, player.y + Math.sin(player.angle) * 24, player.angle, 'player', 760, 26, '#ffe45c', game.rng);
    fireShot(game.shots, player.x - 90, player.y + 40, 2.3, 'police', 560, 9, '#ff5b6e', game.rng);
    burst(game.shots, player.x + 40, player.y - 30, '#ff9f43', 8, game.rng);
    for (let index = 0; index < 30; index += 1) step(STEP);
    game.shake = 0;
    game.toastTimer = 0;
  } else {
    game.screen = 'end';
    const player = game.player;
    player.cash = 3820;
    player.health = 74;
    player.wanted = 2;
    player.driveDistance = 1840;
    player.evadedCount = 2;
    game.cashCollected = 12;
    game.missionsDone = MISSIONS.length;
    game.missionIndex = MISSIONS.length;
    game.maxWanted = 4;
    game.endReason = 'legend';
    game.score = player.cash + game.missionsDone * 500 + 5000;
    for (let index = 0; index < 2; index += 1) spawnCruiser(game.police, player, game.world, game);
    game.tick = 180;
    for (let index = 0; index < 4; index += 1) step(STEP);
    game.shake = 0;
    game.toastTimer = 0;
  }
  snapCamera();
}

function onKeyDown(event) {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(event.code) !== -1) event.preventDefault();
  if (event.code === 'Enter' && game.screen === 'start') startPlay();
  else if (event.code === 'KeyR' && game.screen === 'end') startPlay();
  else if (event.code === 'KeyP' && game.screen === 'play') game.paused = !game.paused;
  else if (event.code === 'Space' || event.code === 'KeyE') input.action = true;
  else if (event.code === 'KeyR') input.reload = true;
  input.keys.add(event.code);
}

function onMouseMove(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = view.w / (rect.width || view.w);
  const scaleY = view.h / (rect.height || view.h);
  const screenX = (event.clientX - rect.left) * scaleX;
  const screenY = (event.clientY - rect.top) * scaleY;
  game.pointer.x = screenX;
  game.pointer.y = screenY;
  input.aimX = screenX + game.camera.x - view.w / 2;
  input.aimY = screenY + game.camera.y - view.h / 2;
}

if (!shotMode) {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', function (event) { input.keys.delete(event.code); });
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', function (event) { if (event.button === 0) input.mouseDown = true; });
  window.addEventListener('mouseup', function (event) { if (event.button === 0) input.mouseDown = false; });
  window.addEventListener('blur', function () { input.keys.clear(); input.mouseDown = false; });
  canvas.addEventListener('contextmenu', function (event) { event.preventDefault(); });
}

let lastTime = 0;
let accumulator = 0;

function frame(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let elapsed = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  if (elapsed > 0.2) elapsed = 0.2;

  if (!game.paused && game.screen === 'play') {
    accumulator += elapsed;
    let guard = 0;
    while (accumulator >= STEP && guard < 8) {
      step(STEP);
      accumulator -= STEP;
      guard += 1;
      if (game.screen !== 'play') break;
    }
  } else {
    game.tick += 1;
    updateCamera();
  }

  input.action = false;
  input.reload = false;
  renderScene(ctx, game, view);
  requestAnimationFrame(frame);
}

if (shotMode) {
  composeShot();
  renderScene(ctx, game, view);
} else {
  newGame();
  requestAnimationFrame(frame);
}
