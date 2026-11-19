import { generateWorld, generateTraffic, generatePedestrians, makeRng } from "./world.js";
import {
  createPlayer, accelerate, nearestStealable, enterCar, exitCar,
  fire, hurt, earn, bumpWanted
} from "./player.js";
import { createPolice, updatePolice } from "./police.js";
import { renderScene, renderStart, renderEnd } from "./render.js";
import { renderShot } from "./shots.js";

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
let viewW = 960;
let viewH = 540;

function sizeCanvas() {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  viewW = Math.max(320, canvas.clientWidth || window.innerWidth || 960);
  viewH = Math.max(240, canvas.clientHeight || window.innerHeight || 540);
  canvas.width = Math.round(viewW * ratio);
  canvas.height = Math.round(viewH * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

const params = new URLSearchParams(location.search);
const shotMode = params.get("shot");
const seedArg = Number.parseInt(params.get("seed") || "1", 10);
const seed = Number.isFinite(seedArg) ? seedArg : 1;

sizeCanvas();
if (shotMode) {
  renderShot(ctx, shotMode, seed, viewW, viewH);
} else {
  bootGame(seed);
}

function bootGame(gameSeed) {
  const world = generateWorld(gameSeed);
  const rng = makeRng(gameSeed + 4242);
  const keys = Object.create(null);
  const mouse = { x: viewW / 2, y: viewH / 2, down: false };
  const SAVE_KEY = "neon-hustle-save-v1";
  let screen = "start";
  let state = freshState();

  function freshState() {
    return {
      world,
      player: createPlayer(gameSeed),
      cars: generateTraffic(world, 20),
      people: generatePedestrians(world, 30),
      police: createPolice(world, 6),
      shots: [],
      missionIndex: 0,
      missionProgress: 0,
      missionPeak: 0,
      prompt: "",
      promptUntil: 0,
      peakWanted: 0,
      elapsed: 0,
      endReason: "complete",
      best: 0,
      camera: null,
      seed: gameSeed
    };
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        best: state.best,
        cash: state.player.cash,
        seed: gameSeed
      }));
    } catch (err) {
      return;
    }
  }

  function showPrompt(text) {
    state.prompt = text;
    state.promptUntil = state.elapsed + 2.4;
  }

  function finish(reason) {
    if (screen === "end") return;
    state.endReason = reason;
    const previous = loadSave();
    state.best = Math.max(state.best, state.player.cash, (previous && previous.best) || 0);
    saveGame();
    screen = "end";
  }

  function completeMission() {
    const mission = world.missions[state.missionIndex % world.missions.length];
    state.player.cash += mission.reward;
    state.missionIndex += 1;
    state.missionProgress = 0;
    state.missionPeak = 0;
    showPrompt("CONTRACT CLEARED  +$" + mission.reward);
    if (state.missionIndex >= world.missions.length) finish("complete");
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    keys[key] = true;
    if (key === " " || key.indexOf("arrow") === 0) event.preventDefault();
    if (key === "enter") {
      if (screen === "start") {
        const saved = loadSave();
        state.best = (saved && saved.best) || 0;
        screen = "play";
        showPrompt("GET MOVING, ROOK");
      } else if (screen === "end") {
        state = freshState();
        screen = "play";
        showPrompt("NEW SHIFT STARTED");
      }
    }
    if (key === "e" && screen === "play") {
      if (state.player.inCar) {
        const left = exitCar(state.player, state.cars);
        if (left && left.stolen) {
          state.player.delivered += 1;
          if (state.missionIndex === 2) {
            state.missionProgress += 1;
            if (state.missionProgress >= 5) completeMission();
          }
        }
      } else {
        const target = nearestStealable(state.player, state.cars);
        if (target && enterCar(state.player, target)) {
          bumpWanted(state.player, 1);
          showPrompt("HOTWIRE COMPLETE  +$250");
          state.player.cash += 250;
        } else {
          showPrompt("NO VEHICLE IN RANGE");
        }
      }
    }
  });

  window.addEventListener("keyup", (event) => {
    keys[event.key.toLowerCase()] = false;
  });

  canvas.addEventListener("mousemove", (event) => {
    const bounds = canvas.getBoundingClientRect();
    mouse.x = event.clientX - bounds.left;
    mouse.y = event.clientY - bounds.top;
  });
  canvas.addEventListener("mousedown", () => { mouse.down = true; });
  window.addEventListener("mouseup", () => { mouse.down = false; });
  window.addEventListener("resize", sizeCanvas);

  function step(dt) {
    const player = state.player;
    state.elapsed += dt;
    if (state.prompt && state.elapsed > state.promptUntil) state.prompt = "";

    accelerate(player, {
      up: !!(keys["w"] || keys["arrowup"]),
      down: !!(keys["s"] || keys["arrowdown"]),
      left: !!(keys["a"] || keys["arrowleft"]),
      right: !!(keys["d"] || keys["arrowright"]),
      boost: !!keys["shift"]
    }, dt);

    for (const car of state.cars) {
      if (car.kind === "police" || car.occupied) continue;
      const stride = car.speed * 42 * dt;
      car.x += Math.cos(car.angle) * stride;
      car.y += Math.sin(car.angle) * stride;
      if (car.x < 20 || car.x > world.width - 20) car.angle = Math.PI - car.angle;
      if (car.y < 20 || car.y > world.height - 20) car.angle = -car.angle;
      car.x = Math.max(20, Math.min(world.width - 20, car.x));
      car.y = Math.max(20, Math.min(world.height - 20, car.y));
    }

    for (const ped of state.people) {
      ped.x += Math.cos(ped.angle) * 12 * dt;
      ped.y += Math.sin(ped.angle) * 12 * dt;
      ped.x = Math.max(20, Math.min(world.width - 20, ped.x));
      ped.y = Math.max(20, Math.min(world.height - 20, ped.y));
    }

    if ((mouse.down || keys[" "]) && player.ammo > 0) {
      const aim = {
        x: mouse.x + player.x - viewW / 2,
        y: mouse.y + player.y - viewH / 2
      };
      const bullet = fire(player, aim, rng);
      if (bullet) state.shots.push(bullet);
    }

    for (const shot of state.shots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (!shot.friendly) {
        const dx = player.x - shot.x;
        const dy = player.y - shot.y;
        if (dx * dx + dy * dy < 22 * 22) {
          hurt(player, shot.damage);
          shot.life = 0;
        }
      } else {
        for (const unit of state.police) {
          const dx = unit.x - shot.x;
          const dy = unit.y - shot.y;
          if (dx * dx + dy * dy < 20 * 20) {
            unit.health -= shot.damage;
            shot.life = 0;
            if (unit.health <= 0) {
              player.kills += 1;
              player.cash += 100;
              bumpWanted(player, 1);
              unit.health = 90;
              showPrompt("UNIT DOWN  +$100");
            }
            break;
          }
        }
      }
    }
    state.shots = state.shots.filter(shot =>
      shot.life > 0 && shot.x > 0 && shot.y > 0 &&
      shot.x < world.width && shot.y < world.height
    );

    const policeBullet = updatePolice(state.police, player, dt, rng);
    if (policeBullet) state.shots.push(policeBullet);

    for (const unit of state.police) {
      const dx = player.x - unit.x;
      const dy = player.y - unit.y;
      if (dx * dx + dy * dy < 30 * 30) hurt(player, 8 * dt);
    }

    let pursued = false;
    for (const unit of state.police) {
      if (Math.hypot(player.x - unit.x, player.y - unit.y) < 420) {
        pursued = true;
        break;
      }
    }
    if (!pursued && player.wanted > 0) {
      player.wanted = Math.max(0, player.wanted - dt * 0.12);
    }
    state.peakWanted = Math.max(state.peakWanted, Math.floor(player.wanted));
    state.missionPeak = Math.max(state.missionPeak, Math.floor(player.wanted));
    if (state.missionIndex === 1 && state.missionPeak >= 3 && player.wanted === 0) {
      completeMission();
    }

    for (const drop of world.cash) {
      if (drop.taken) continue;
      const dx = player.x - drop.x;
      const dy = player.y - drop.y;
      if (dx * dx + dy * dy < 26 * 26) {
        drop.taken = true;
        earn(player, drop.amount);
        showPrompt("CASH GRABBED  +$" + drop.amount);
        if (state.missionIndex === 0) {
          state.missionProgress += 1;
          if (state.missionProgress >= 3) completeMission();
        }
      }
    }

    if (!player.alive) finish("busted");
  }

  function draw() {
    if (screen === "start") renderStart(ctx, state, viewW, viewH);
    else if (screen === "end") renderEnd(ctx, state, viewW, viewH);
    else renderScene(ctx, state, viewW, viewH);
  }

  let previousFrame = 0;
  function frame(timestamp) {
    if (!previousFrame) previousFrame = timestamp;
    const dt = Math.min(0.05, (timestamp - previousFrame) / 1000);
    previousFrame = timestamp;
    if (screen === "play") step(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
