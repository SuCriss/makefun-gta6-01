export const TILE = 80;
export const COLS = 40;
export const ROWS = 40;
export const WORLD_W = TILE * COLS;
export const WORLD_H = TILE * ROWS;

const FACADES = ["#111a2c", "#162036", "#1b1733", "#101f2b", "#201a30"];
const NEONS = ["#ff3d9a", "#28e7ff", "#b478ff", "#ffd45e", "#45ffb0"];
const PAINT = ["#e84b6f", "#3fa9f5", "#f7c948", "#7b61ff", "#36d7a1", "#f2f2f2"];

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isRoadTile(tx, ty) {
  return tx % 4 === 0 || ty % 4 === 0;
}

export function roadPoint(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

export function clampWorld(point) {
  return {
    x: Math.max(24, Math.min(WORLD_W - 24, point.x)),
    y: Math.max(24, Math.min(WORLD_H - 24, point.y))
  };
}

export function generateWorld(seed = 1) {
  const rng = makeRng(seed);
  const buildings = [];
  const props = [];
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (isRoadTile(tx, ty)) continue;
      const px = tx * TILE;
      const py = ty * TILE;
      const facade = FACADES[Math.floor(rng() * FACADES.length)];
      const neon = NEONS[Math.floor(rng() * NEONS.length)];
      const variant = Math.floor(rng() * 3);
      buildings.push({ x: px + 5, y: py + 5, w: TILE - 10, h: TILE - 10, facade, neon, variant });
      if (rng() > 0.62) {
        props.push({ x: px + TILE / 2, y: py + TILE / 2, kind: rng() > 0.5 ? "billboard" : "lamp", neon });
      }
    }
  }
  const cash = [];
  for (let i = 0; i < 28; i++) {
    const horizontal = rng() > 0.5;
    const tx = horizontal ? Math.floor(rng() * COLS) : 4 * Math.floor(rng() * 10);
    const ty = horizontal ? 4 * Math.floor(rng() * 10) : Math.floor(rng() * ROWS);
    const p = roadPoint(tx, ty);
    cash.push({ id: i, x: p.x, y: p.y, amount: 50 + Math.floor(rng() * 5) * 25, taken: false });
  }
  const missions = [
    { id: 1, title: "FIRST SCORE", desc: "Collect 3 cash drops", reward: 750 },
    { id: 2, title: "HOT PURSUIT", desc: "Shake a 3-star chase", reward: 1200 },
    { id: 3, title: "NIGHT SHIFT", desc: "Deliver 5 stolen cars", reward: 2000 }
  ];
  return {
    seed, tile: TILE, cols: COLS, rows: ROWS, width: WORLD_W, height: WORLD_H,
    buildings, props, cash, missions
  };
}

export function generateTraffic(world, count = 20) {
  const rng = makeRng(world.seed + 101);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const horizontal = rng() > 0.5;
    const tx = horizontal ? Math.floor(rng() * COLS) : 4 * Math.floor(rng() * 10);
    const ty = horizontal ? 4 * Math.floor(rng() * 10) : Math.floor(rng() * ROWS);
    const p = roadPoint(tx, ty);
    const facing = rng() > 0.5 ? 0 : 1;
    cars.push({
      id: i, kind: "traffic", x: p.x, y: p.y,
      angle: horizontal ? (facing ? 0 : Math.PI) : (facing ? Math.PI / 2 : -Math.PI / 2),
      speed: 0.8 + rng() * 1.4,
      color: PAINT[Math.floor(rng() * PAINT.length)],
      occupied: false, stolen: false, health: 40
    });
  }
  return cars;
}

export function generatePedestrians(world, count = 30) {
  const rng = makeRng(world.seed + 211);
  const skins = ["#ffcf9e", "#c98c5a", "#8d5a3c", "#f0b989"];
  const people = [];
  for (let i = 0; i < count; i++) {
    const tx = 1 + Math.floor(rng() * (COLS - 2));
    const ty = 1 + Math.floor(rng() * (ROWS - 2));
    const p = roadPoint(tx, ty);
    people.push({
      id: i,
      x: p.x + (rng() > 0.5 ? 18 : -18),
      y: p.y + (rng() > 0.5 ? 18 : -18),
      angle: rng() * Math.PI * 2,
      skin: skins[Math.floor(rng() * skins.length)],
      color: NEONS[Math.floor(rng() * NEONS.length)]
    });
  }
  return people;
}
