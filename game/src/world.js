export const VIEW_W = 1280;
export const VIEW_H = 720;
export const CELL = 260;
export const ROAD = 76;
export const GRID = 9;
export const WORLD = CELL * GRID;

const BUILDING_FILLS = ['#16203c', '#22173f', '#102f3e', '#391a34', '#15303a', '#2a1e3e', '#1b2444'];
const NEONS = ['#22e0ff', '#ff3ea5', '#ffd23f', '#9b6bff', '#3dffa8', '#ff7a45'];
const CAR_COLORS = ['#ff3b5c', '#ffd23f', '#22e0ff', '#9b6bff', '#3dffa8', '#dfe9f2', '#ff8a3d'];
const PED_COLORS = ['#ff6b9d', '#5ce1ff', '#ffd166', '#b388ff', '#7dffb0', '#ffffff'];
const SIGN_WORDS = ['NOVA', 'ZEN', 'KIRA', 'VOLT', 'ONYX', 'LUNA', 'FLUX', 'RUSH'];
const DISTRICTS = ['GLASS QUARTER', 'NEON DOCKS', 'SUNSET WARD', 'IRON MARKET', 'LUMEN CORE', 'AURORA ROW', 'OLD HARBOR', 'CIRCUIT FLATS', 'CRESCENT PARK'];

export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rnd(rng, a, b) {
  return a + (b - a) * rng();
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function isRoad(x, y) {
  const mx = ((x % CELL) + CELL) % CELL;
  const my = ((y % CELL) + CELL) % CELL;
  const h = ROAD / 2;
  return mx < h || mx > CELL - h || my < h || my > CELL - h;
}

export function clampToWorld(v) {
  return clamp(v, 10, WORLD - 10);
}

export function districtName(x, y) {
  const col = clamp(Math.floor(x / CELL), 0, GRID - 1);
  const row = clamp(Math.floor(y / CELL), 0, GRID - 1);
  return DISTRICTS[(col + row * 4) % DISTRICTS.length];
}

export function roadPoint(rng) {
  const line = Math.floor(rng() * GRID);
  const along = rnd(rng, 50, WORLD - 50);
  if (rng() < 0.5) return { x: line * CELL, y: along, angle: Math.PI / 2 };
  return { x: along, y: line * CELL, angle: 0 };
}

function makeWindows(rng, w, h) {
  const out = [];
  const step = 15;
  for (let yy = 9; yy < h - 9; yy += step) {
    for (let xx = 9; xx < w - 9; xx += step) {
      if (rng() < 0.55) out.push({ x: xx, y: yy, lit: rng() < 0.72, hot: rng() < 0.12 });
    }
  }
  return out;
}

export function createCar(rng, x, y, angle, parked) {
  return {
    x, y, angle,
    color: pick(rng, CAR_COLORS),
    speed: parked ? 0 : rnd(rng, 0.45, 0.9),
    maxSpeed: rnd(rng, 1.15, 1.85),
    turn: rng() < 0.5 ? -1 : 1,
    hp: 3,
    parked: !!parked,
    stolen: false,
    flash: 0,
  };
}

export function createPed(rng, bx, by, bw, bh) {
  const pad = 9;
  const path = [
    { x: bx - pad, y: by - pad },
    { x: bx + bw + pad, y: by - pad },
    { x: bx + bw + pad, y: by + bh + pad },
    { x: bx - pad, y: by + bh + pad },
  ];
  const idx = Math.floor(rng() * path.length);
  return {
    x: path[idx].x,
    y: path[idx].y,
    path,
    idx,
    angle: rng() * Math.PI * 2,
    color: pick(rng, PED_COLORS),
    speed: rnd(rng, 0.22, 0.42),
    phase: rng() * 6.283,
    alive: true,
  };
}

export function pointInBuilding(world, x, y) {
  const list = world.buildings;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

export function createWorld(seed, shot) {
  const rng = makeRng((seed ^ 0x9e3779b9) >>> 0);
  const blocks = [];
  const buildings = [];
  const lamps = [];
  const parked = [];
  const peds = [];
  const money = [];
  const trees = [];

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const bx = gx * CELL + ROAD / 2 + 12;
      const by = gy * CELL + ROAD / 2 + 12;
      const bw = CELL - ROAD - 24;
      const bh = CELL - ROAD - 24;
      blocks.push({ x: bx, y: by, w: bw, h: bh, tone: rng() < 0.5 ? 0 : 1 });

      const sub = bw / 2;
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          if (rng() < 0.1) {
            trees.push({ x: bx + sx * sub + sub * 0.5, y: by + sy * sub + sub * 0.5, r: rnd(rng, 9, 14) });
            continue;
          }
          const pad = rnd(rng, 6, 12);
          const wx = bx + sx * sub + pad;
          const wy = by + sy * sub + pad;
          const ww = sub - pad * 2;
          const wh = sub - pad * 2;
          buildings.push({
            x: wx, y: wy, w: ww, h: wh,
            fill: pick(rng, BUILDING_FILLS),
            neon: pick(rng, NEONS),
            windows: makeWindows(rng, ww, wh),
            sign: rng() < 0.32 ? pick(rng, SIGN_WORDS) : null,
            antenna: rng() < 0.22,
          });
        }
      }

      lamps.push(
        { x: bx - 8, y: by - 8 },
        { x: bx + bw + 8, y: by - 8 },
        { x: bx - 8, y: by + bh + 8 },
        { x: bx + bw + 8, y: by + bh + 8 },
      );

      if (rng() < 0.7) {
        const side = Math.floor(rng() * 4);
        let px, py, ang;
        if (side === 0) { px = bx + bw * rng(); py = gy * CELL + ROAD / 2 - 13; ang = 0; }
        else if (side === 1) { px = bx + bw * rng(); py = (gy + 1) * CELL - ROAD / 2 + 13; ang = 0; }
        else if (side === 2) { px = gx * CELL + ROAD / 2 - 13; py = by + bh * rng(); ang = Math.PI / 2; }
        else { px = (gx + 1) * CELL - ROAD / 2 + 13; py = by + bh * rng(); ang = Math.PI / 2; }
        parked.push(createCar(rng, px, py, ang, true));
      }

      if (rng() < 0.55) {
        money.push({
          x: bx + bw * rng(),
          y: by + bh * rng(),
          value: rng() < 0.2 ? 100 : 25,
          taken: false,
          phase: rng() * 6.283,
        });
      }

      peds.push(createPed(rng, bx, by, bw, bh));
      if (rng() < 0.35) peds.push(createPed(rng, bx, by, bw, bh));
    }
  }

  const missionPoints = [
    { x: CELL * 3 + ROAD / 2, y: CELL * 3 + ROAD / 2 },
    { x: CELL * 6 + ROAD / 2, y: CELL * 4 + ROAD / 2 },
    { x: CELL * 5 + ROAD / 2, y: CELL * 6 + ROAD / 2 },
  ];

  const spawn = { x: CELL * 4 + ROAD / 2 - 6, y: CELL * 4 + 8, angle: -0.08 };

  return {
    seed, shot, blocks, buildings, lamps, parked, peds, money, trees, missionPoints, spawn,
    dims: { WORLD, CELL, ROAD, GRID },
  };
}
