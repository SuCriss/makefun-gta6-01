import { CITY, createWorld, makeRng, updateTraffic, updatePedestrians, clamp } from "./world.js";
import { createPlayer, updatePlayer, toggleVehicle, addWanted, playerPosition } from "./player.js";
import { createPolice, updatePolice, updateProjectiles, updateParticles } from "./police.js";
import { renderScene, renderMinimap } from "./render.js";
import { buildShotScene, shotLabels } from "./shots.js";

const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");
const minimap = document.getElementById("minimap");
const minimapCtx = minimap.getContext("2d");
const screen = document.getElementById("screen");
const hud = document.getElementById("hud");
const healthBar = document.getElementById("healthBar");
const healthText = document.getElementById("healthText");
const cashText = document.getElementById("cashText");
const wantedText = document.getElementById("wantedText");
const ammoText = document.getElementById("ammoText");
const missionText = document.getElementById("missionText");
const toast = document.getElementById("toast");

const SAVE_KEY = "neon-hustle-save-v1";
const params = new URLSearchParams(location.search);
const shotMode = params.get("shot");
const parsedSeed = Number.parseInt(params.get("seed") || "20261119", 10);
const seed = Number.isFinite(parsedSeed) ? parsedSeed : 20261119;

function readSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function writeSave(record) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(record));
  } catch (error) {
    return;
  }
}

function showToast(message) {
  state.toastMessage = message;
  state.toastClock = 2.2;
  toast.textContent = message;
  toast.classList.add("show");
}

function freshState() {
  const world = createWorld(seed);
  const player = createPlayer(world);
  return {
    shot: null,
    mode: "start",
    world,
    player,
    police: createPolice(),
    projectiles: [],
    particles: [],
    camera: {
      x: clamp(player.x - 640, 0, CITY.width - 1280),
      y: clamp(player.y - 360, 0, CITY.height - 720)
    },
    tick: 0,
    missionIndex: 0,
    hotRideDone: false,
    survivalClock: 0,
    toastClock: 0,
    toastMessage: "",
    rng: makeRng(seed + 313),
    keys: {},
    mouse: { x: 640, y: 360, down: false },
    stats: { collected: 0, takedowns: 0, distance: 0, elapsed: 0, jobs: 0 },
    notify: showToast
  };
}

let state = shotMode ? buildShotScene(shotMode, seed) : freshState();
state.notify = showToast;

function panelMarkup(info) {
  const chips = (info.chips || []).map((chip) => '<span class="chip ' + chip.tone + '">' + chip.text + "</span>").join("");
  const controls = info.controls
    ? '<div class="controls">' + info.controls.map((row) => "<div><b>" + row[0] + "</b> &nbsp;" + row[1] + "</div>").join("") + "</div>"
    : "";
  const stats = info.stats
    ? '<div class="stats">' + info.stats.map((item) => '<div class="stat"><span>' + item[0] + "</span><strong>" + item[1] + "</strong></div>").join("") + "</div>"
    : "";
  return (
    '<div class="panel">' +
    '<p class="kicker">' + info.kicker + "</p>" +
    '<h1 class="title">' + info.title + "</h1>" +
    '<p class="subtitle">' + info.subtitle + "</p>" +
    '<div class="chips">' + chips + "</div>" +
    stats + controls +
    '<button id="primaryAction" class="action" type="button">' + info.button + "</button>" +
    '<p class="footnote">' + info.footnote + "</p>" +
    "</div>"
  );
}

function showScreen(info, action) {
  screen.innerHTML = panelMarkup(info);
  screen.dataset.action = action;
  const button = document.getElementById("primaryAction");
  if (button) {
    button.addEventListener("click", () => {
      const choice = screen.dataset.action;
      if (choice === "launch") {
        location.search = "";
        return;
      }
      if (choice === "resume") {
        resumeRun();
        return;
      }
      startRun();
    });
  }
}

function clearScreen() {
  screen.innerHTML = "";
  screen.dataset.action = "";
}

function startInfo() {
  const save = readSave();
  const info = shotLabels("start");
  info.footnote = "OFFLINE BROWSER GAME // BEST CASH $" + (save.bestCash || 0);
  return info;
}

function showStart() {
  state.mode = "start";
  hud.classList.add("hidden");
  showScreen(startInfo(), shotMode ? "launch" : "start");
}

function resultInfo(outcome) {
  const info = shotLabels("end");
  info.kicker = outcome;
  info.stats = [
    ["CASH", "$" + state.player.cash],
    ["TAKEDOWNS", String(state.stats.takedowns)],
    ["JOBS", state.stats.jobs + " / 3"]
  ];
  info.footnote = "RUN SUMMARY // DISTANCE " + Math.round(state.stats.distance / 1000 * 10) / 10 + " KM";
  return info;
}

function finishRun(outcome) {
  if (state.mode === "results") return;
  state.mode = "results";
  state.mouse.down = false;
  const record = readSave();
  record.bestCash = Math.max(record.bestCash || 0, state.player.cash);
  record.runs = (record.runs || 0) + 1;
  writeSave(record);
  hud.classList.add("hidden");
  showScreen(resultInfo(outcome), shotMode ? "launch" : "restart");
}

function pauseRun() {
  if (state.mode !== "play") return;
  state.mode = "paused";
  state.mouse.down = false;
  showScreen(
    {
      kicker: "HUSTLE ON HOLD",
      title: "TAKE A <em>BREATH</em>",
      subtitle: "The city keeps glowing. Get back out there when you are ready.",
      chips: [{ text: "PAUSED", tone: "" }, { text: "SAVE READY", tone: "gold" }],
      stats: [["CASH", "$" + state.player.cash], ["WANTED", state.player.wanted + " / 5"], ["JOBS", state.stats.jobs + " / 3"]],
      button: "RESUME",
      footnote: "PRESS ESC AGAIN TO RESUME"
    },
    "resume"
  );
}

function resumeRun() {
  if (state.mode !== "paused") return;
  state.mode = "play";
  clearScreen();
}

function startRun() {
  state = freshState();
  state.mode = "play";
  clearScreen();
  hud.classList.remove("hidden");
  showToast("JOB 1: GRAB THREE CASH DROPS");
  launchLoop();
}

function updateHud() {
  const player = state.player;
  healthBar.style.width = Math.max(0, player.hp / player.maxHp * 100) + "%";
  healthText.textContent = String(Math.ceil(player.hp));
  cashText.textContent = "$" + player.cash;
  wantedText.textContent = "★".repeat(player.wanted) + "☆".repeat(5 - player.wanted);
  ammoText.textContent = player.ammo + " / " + player.reserve;
  const mission = state.world.missions[state.missionIndex];
  if (!mission) {
    missionText.textContent = "ALL JOBS COMPLETE";
  } else {
    let progress = 0;
    if (mission.id === 0) progress = Math.min(mission.goal, state.stats.collected);
    if (mission.id === 1) progress = state.hotRideDone ? 1 : 0;
    if (mission.id === 2) progress = Math.min(mission.goal, Math.floor(state.survivalClock));
    missionText.textContent = "JOB " + (mission.id + 1) + "/3 · " + mission.title + " · " + progress + "/" + mission.goal;
  }
  if (state.toastClock <= 0) toast.classList.remove("show");
}

function advanceMissions(dt) {
  const mission = state.world.missions[state.missionIndex];
  if (!mission) return;
  let done = false;
  if (mission.id === 0) done = state.stats.collected >= mission.goal;
  if (mission.id === 1) done = state.hotRideDone;
  if (mission.id === 2) {
    if (state.player.wanted >= 3) state.survivalClock += dt;
    done = state.survivalClock >= mission.goal;
  }
  if (!done) return;
  state.player.cash += mission.reward;
  state.stats.jobs += 1;
  state.missionIndex += 1;
  state.survivalClock = 0;
  addWanted(state.player, 1);
  if (state.missionIndex >= state.world.missions.length) {
    showToast("ALL JOBS COMPLETE +$" + mission.reward);
    finishRun("CITY CLEARED // ALL JOBS DONE");
  } else {
    showToast("JOB COMPLETE +$" + mission.reward);
  }
}

function updateCamera(dt) {
  const me = playerPosition(state.player);
  const targetX = clamp(me.x - 640, 0, CITY.width - 1280);
  const targetY = clamp(me.y - 360, 0, CITY.height - 720);
  const blend = Math.min(1, dt * 5);
  state.camera.x += (targetX - state.camera.x) * blend;
  state.camera.y += (targetY - state.camera.y) * blend;
}

let lastFrame = 0;
let loopActive = false;

function simulate(dt) {
  state.tick += dt;
  state.stats.elapsed += dt;
  state.stats.distance = Math.round(state.player.distance);
  state.toastClock = Math.max(0, state.toastClock - dt);
  updateTraffic(state.world.traffic, dt);
  updatePedestrians(state.world.pedestrians, dt, state.rng);
  updatePlayer(state.player, state, dt);
  updatePolice(state.police, state.player, state, dt);
  updateProjectiles(state, dt);
  updateParticles(state.particles, dt);
  updateCamera(dt);
  advanceMissions(dt);
  updateHud();
  if (state.player.hp <= 0) finishRun("RUN OVER // WASTED");
}

function frame(now) {
  const dt = lastFrame ? Math.min(0.04, (now - lastFrame) / 1000) : 0.016;
  lastFrame = now;
  if (state.mode === "play") simulate(dt);
  renderScene(ctx, state);
  renderMinimap(minimapCtx, state);
  requestAnimationFrame(frame);
}

function launchLoop() {
  if (loopActive) return;
  loopActive = true;
  lastFrame = 0;
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
  if (event.code === "Escape") {
    if (state.mode === "play") pauseRun();
    else if (state.mode === "paused") resumeRun();
    return;
  }
  if (state.mode !== "play") return;
  state.keys[event.code] = true;
  if (event.code === "KeyE") {
    toggleVehicle(state.player, state.world, showToast);
    if (state.player.vehicle && state.player.vehicle.kind === "sport" && state.player.vehicle.stolen) state.hotRideDone = true;
  }
});

window.addEventListener("keyup", (event) => {
  state.keys[event.code] = false;
});

canvas.addEventListener("mousemove", (event) => {
  const bounds = canvas.getBoundingClientRect();
  state.mouse.x = (event.clientX - bounds.left) * canvas.width / bounds.width;
  state.mouse.y = (event.clientY - bounds.top) * canvas.height / bounds.height;
});

canvas.addEventListener("mousedown", (event) => {
  if (event.button === 0) state.mouse.down = true;
});

window.addEventListener("mouseup", () => {
  state.mouse.down = false;
});

canvas.addEventListener("contextmenu", (event) => event.preventDefault());

if (shotMode) {
  const info = shotLabels(state.shot);
  if (state.mode === "results") {
    hud.classList.add("hidden");
  } else {
    hud.classList.remove("hidden");
  }
  showScreen(info, "launch");
  updateHud();
  renderScene(ctx, state);
  renderMinimap(minimapCtx, state);
} else {
  showStart();
  renderScene(ctx, state);
  renderMinimap(minimapCtx, state);
}
