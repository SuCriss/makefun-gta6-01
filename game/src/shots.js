import { CITY, createWorld, makeRng } from "./world.js";
import { createPlayer } from "./player.js";

const CONTROL_ROWS = [
  ["W A S D", "Move / drive"],
  ["MOUSE", "Aim and fire"],
  ["E", "Enter or steal car"],
  ["SPACE", "Dash / handbrake"],
  ["R", "Reload weapon"],
  ["ESC", "Pause the hustle"]
];

export function shotLabels(shot) {
  if (shot === "end") {
    return {
      kicker: "RUN COMPLETE // GTA6-01",
      title: "CITY <em>CLEARED</em>",
      subtitle: "Three jobs, one stolen ride, and a citywide pursuit. The neon never sleeps, but this run is yours.",
      chips: [
        { text: "SEED 1", tone: "" },
        { text: "5 WANTED STARS", tone: "pink" },
        { text: "ALL MISSIONS DONE", tone: "gold" }
      ],
      stats: [["CASH", "$8,640"], ["TAKEDOWNS", "12"], ["DISTANCE", "6.2 KM"]],
      button: "RUN IT BACK",
      footnote: "DETERMINISTIC RESULTS SCENE // NEON HUSTLE"
    };
  }
  if (shot === "start") {
    return {
      kicker: "MAKE.FUN BOUNTY // GTA6-01",
      title: "NEON<em>HUSTLE</em>",
      subtitle: "Own the grid. Steal the fastest ride, grab the cash, and disappear before the blue and red lights close in.",
      chips: [
        { text: "OPEN WORLD", tone: "" },
        { text: "POLICE CHASE", tone: "pink" },
        { text: "3 STORY JOBS", tone: "gold" }
      ],
      controls: CONTROL_ROWS,
      button: "START HUSTLE",
      footnote: "OFFLINE BROWSER GAME // NO NETWORK REQUIRED"
    };
  }
  return {
    kicker: "LIVE GAMEPLAY // GTA6-01",
    title: "WANTED <em>04</em>",
    subtitle: "Composed play frame: stolen sports car, active shootout, cash on the street, and a citywide response.",
    chips: [
      { text: "SHOT: PLAY", tone: "" },
      { text: "WANTED 04", tone: "pink" },
      { text: "CASH $4,200", tone: "gold" }
    ],
    controls: CONTROL_ROWS,
    button: "START HUSTLE",
    footnote: "DETERMINISTIC PLAY SCENE // STABLE SEED"
  };
}

function cameraFor(x, y) {
  return {
    x: Math.max(0, Math.min(CITY.width - 1280, x - 640)),
    y: Math.max(0, Math.min(CITY.height - 720, y - 360))
  };
}

function baseState(shot, seed, mode) {
  const world = createWorld(seed);
  const player = createPlayer(world);
  return {
    shot,
    mode,
    world,
    player,
    police: [],
    projectiles: [],
    particles: [],
    camera: cameraFor(player.x, player.y),
    tick: 3.2,
    missionIndex: 0,
    rng: makeRng(seed + 313),
    keys: {},
    mouse: { x: 640, y: 360, down: false },
    stats: { collected: 0, takedowns: 0, distance: 0, elapsed: 0, jobs: 0 }
  };
}

function mountStolenCar(state, carIndex, x, y, angle, kind) {
  const car = state.world.traffic[carIndex];
  car.x = x;
  car.y = y;
  car.vertical = false;
  car.dir = 1;
  car.angle = angle;
  car.kind = kind;
  car.stolen = true;
  state.player.vehicle = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.player.aim = angle;
  state.camera = cameraFor(x, y);
}

function addOfficer(state, x, y, angle, hue) {
  state.police.push({
    x,
    y,
    angle,
    speed: 176,
    turn: 2.4,
    fireClock: 0.5,
    hp: 80,
    hue
  });
}

function addParticle(state, x, y, hue, size, vx, vy, life) {
  state.particles.push({ x, y, vx, vy, life, max: life, hue, size });
}

export function buildShotScene(shot, seed) {
  const requested = shot === "start" || shot === "play" || shot === "end" ? shot : "start";
  const mode = requested === "start" ? "start" : requested === "end" ? "results" : "play";
  const state = baseState(requested, seed, mode);

  if (requested === "start") {
    state.player.x = 1216;
    state.player.y = 1536;
    state.player.aim = -0.35;
    state.camera = cameraFor(1216, 1536);
    state.player.cash = 260;
    for (let i = 0; i < 5; i += 1) {
      const drop = state.world.pickups[i];
      drop.taken = false;
    }
    addParticle(state, 1240, 1518, 186, 4, 12, -18, 0.3);
    return state;
  }

  if (requested === "play") {
    mountStolenCar(state, 3, 1440, 1200, -0.22, "sport");
    state.player.hp = 74;
    state.player.cash = 4200;
    state.player.wanted = 4;
    state.player.wantedClock = 12;
    state.player.ammo = 17;
    state.player.reserve = 84;
    state.player.speed = 214;
    state.missionIndex = 1;
    state.stats = { collected: 8, takedowns: 4, distance: 1820, elapsed: 96, jobs: 1 };
    addOfficer(state, 1180, 1040, 0.52, 350);
    addOfficer(state, 1720, 1120, Math.PI - 0.35, 200);
    addOfficer(state, 1600, 1480, -2.3, 350);
    addOfficer(state, 1280, 1520, -0.8, 200);
    state.projectiles.push(
      { x: 1330, y: 1130, px: 1240, py: 1090, vx: 520, vy: 220, life: 0.6, team: "police", damage: 9, hue: 350 },
      { x: 1550, y: 1160, px: 1620, py: 1210, vx: -560, vy: -260, life: 0.6, team: "player", damage: 26, hue: 186 },
      { x: 1508, y: 1336, px: 1450, py: 1280, vx: 260, vy: 420, life: 0.6, team: "police", damage: 9, hue: 200 }
    );
    for (let i = 0; i < 9; i += 1) {
      const rng = makeRng(seed + 900 + i);
      addParticle(state, 1440 + rng() * 80 - 40, 1200 + rng() * 60 - 30, i % 2 ? 42 : 186, 3 + rng() * 4, (rng() - 0.5) * 140, (rng() - 0.5) * 140, 0.25 + rng() * 0.2);
    }
    return state;
  }

  mountStolenCar(state, 7, 2880, 2160, 0.4, "sport");
  state.player.hp = 100;
  state.player.cash = 8640;
  state.player.wanted = 5;
  state.player.ammo = 9;
  state.player.reserve = 36;
  state.missionIndex = 3;
  state.stats = { collected: 21, takedowns: 12, distance: 6240, elapsed: 312, jobs: 3 };
  addOfficer(state, 2640, 2040, 0.6, 350);
  addOfficer(state, 3120, 2280, -2.4, 200);
  addOfficer(state, 2760, 2420, -0.9, 350);
  state.projectiles.push(
    { x: 2710, y: 2100, px: 2620, py: 2050, vx: 480, vy: 260, life: 0.5, team: "police", damage: 9, hue: 200 }
  );
  for (const drop of state.world.pickups) drop.taken = true;
  return state;
}
