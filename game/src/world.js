export const BLOCK = 260;
export const ROAD = 72;
export const GRID = 8;
export const WORLD_W = BLOCK * GRID;
export const WORLD_H = BLOCK * GRID;

export const CAR_COLORS = ['#e84393', '#0984e3', '#00b894', '#fdcb6e', '#6c5ce7', '#d63031', '#00cec9'];

const NEON_COLORS = ['#20e6ff', '#ff3ec8', '#ffd34d', '#9a6bff', '#35ffae', '#ff7a4d'];
const SIGN_WORDS = ['NOODLES', 'MOTEL', 'ARCADE', 'PAWN', 'CYBER', 'GARAGE', 'MART', 'BAR', 'CLUB', 'DATA', 'RAMEN', 'TAXI'];

export const MISSIONS = [
  { title: 'CASH RUN', desc: 'Collect 3 cash bundles', kind: 'cash', goal: 3, reward: 250 },
  { title: 'JOYRIDE', desc: 'Steal a car and drive 700 m', kind: 'drive', goal: 700, reward: 400 },
  { title: 'THREE STARS', desc: 'Reach wanted level 3', kind: 'wanted', goal: 3, reward: 700 },
  { title: 'GHOST', desc: 'Shake off the police once', kind: 'evade', goal: 1, reward: 900 },
  { title: 'NEON LEGEND', desc: 'Bank 3000 cash in total', kind: 'bank', goal: 3000, reward: 2000 },
];

export function makeRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function buildingRect(x, y, w, h, rng, gx, gy) {
  return {
    x: x,
    y: y,
    w: w,
    h: h,
    color: NEON_COLORS[Math.floor(rng() * NEON_COLORS.length)],
    glow: 0.3 + rng() * 0.45,
    rows: 3 + Math.floor(rng() * 6),
    cols: 2 + Math.floor(rng() * 3),
    sign: SIGN_WORDS[(gx * 5 + gy * 7 + Math.floor(rng() * SIGN_WORDS.length)) % SIGN_WORDS.length],
    signVertical: rng() > 0.62,
  };
}

export function createWorld(seed) {
  const rng = makeRng(seed ^ 0x51ed270b);
  const buildings = [];

  for (let gy = 0; gy < GRID; gy += 1) {
    for (let gx = 0; gx < GRID; gx += 1) {
      const x0 = gx * BLOCK + ROAD / 2 + 14;
      const y0 = gy * BLOCK + ROAD / 2 + 14;
      const span = BLOCK - ROAD - 28;
      const split = rng() > 0.5;

      if (split) {
        const horizontal = rng() > 0.5;
        const ratio = 0.34 + rng() * 0.3;
        if (horizontal) {
          const band = span * ratio;
          buildings.push(buildingRect(x0, y0, span, band, rng, gx, gy));
          buildings.push(buildingRect(x0, y0 + band + 12, span, span - band - 12, rng, gx + 1, gy));
        } else {
          const band = span * ratio;
          buildings.push(buildingRect(x0, y0, band, span, rng, gx, gy));
          buildings.push(buildingRect(x0 + band + 12, y0, span - band - 12, span, rng, gx, gy + 1));
        }
      } else {
        const inset = 4 + rng() * 14;
        buildings.push(buildingRect(x0 + inset, y0 + inset, span - inset * 2, span - inset * 2, rng, gx, gy));
      }
    }
  }

  return { seed: seed, buildings: buildings, traffic: [], pedestrians: [], cash: [] };
}

export function isRoad(x, y) {
  const modX = ((x % BLOCK) + BLOCK) % BLOCK;
  const modY = ((y % BLOCK) + BLOCK) % BLOCK;
  const distX = Math.min(modX, BLOCK - modX);
  const distY = Math.min(modY, BLOCK - modY);
  return distX <= ROAD / 2 || distY <= ROAD / 2;
}

export function pointInBuilding(world, x, y) {
  for (let index = 0; index < world.buildings.length; index += 1) {
    const rect = world.buildings[index];
    if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
      return true;
    }
  }
  return false;
}

export function resolveBuildings(entity, world, radius) {
  let collided = false;
  for (let index = 0; index < world.buildings.length; index += 1) {
    const rect = world.buildings[index];
    const left = rect.x - radius;
    const right = rect.x + rect.w + radius;
    const top = rect.y - radius;
    const bottom = rect.y + rect.h + radius;
    if (entity.x > left && entity.x < right && entity.y > top && entity.y < bottom) {
      const pushLeft = entity.x - left;
      const pushRight = right - entity.x;
      const pushTop = entity.y - top;
      const pushBottom = bottom - entity.y;
      const smallest = Math.min(pushLeft, pushRight, pushTop, pushBottom);
      if (smallest === pushLeft) entity.x = left;
      else if (smallest === pushRight) entity.x = right;
      else if (smallest === pushTop) entity.y = top;
      else entity.y = bottom;
      collided = true;
    }
  }
  return collided;
}

export function clampEntity(entity, radius) {
  entity.x = clamp(entity.x, radius, WORLD_W - radius);
  entity.y = clamp(entity.y, radius, WORLD_H - radius);
}

export function spawnTraffic(world, rng, count) {
  const cars = [];
  const headings = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  for (let index = 0; index < count; index += 1) {
    const horizontal = rng() > 0.5;
    const lane = (rng() > 0.5 ? 1 : -1) * ROAD * 0.24;
    let x;
    let y;
    let dir;
    if (horizontal) {
      const row = 1 + Math.floor(rng() * (GRID - 1));
      y = row * BLOCK + lane;
      dir = rng() > 0.5 ? 0 : 2;
      x = rng() * WORLD_W;
    } else {
      const col = 1 + Math.floor(rng() * (GRID - 1));
      x = col * BLOCK + lane;
      dir = rng() > 0.5 ? 1 : 3;
      y = rng() * WORLD_H;
    }
    cars.push({
      x: x,
      y: y,
      dir: dir,
      heading: headings[dir],
      speed: 44 + rng() * 46,
      color: CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)],
      stolen: false,
      controlled: false,
      police: false,
      w: 30,
      h: 16,
    });
  }
  world.traffic = cars;
  return cars;
}

export function updateTraffic(cars, dt) {
  for (let index = 0; index < cars.length; index += 1) {
    const car = cars[index];
    if (car.controlled) continue;
    const distance = car.speed * dt;
    if (car.dir === 0) {
      car.x += distance;
      if (car.x > WORLD_W + 50) car.x = -50;
    } else if (car.dir === 2) {
      car.x -= distance;
      if (car.x < -50) car.x = WORLD_W + 50;
    } else if (car.dir === 1) {
      car.y += distance;
      if (car.y > WORLD_H + 50) car.y = -50;
    } else {
      car.y -= distance;
      if (car.y < -50) car.y = WORLD_H + 50;
    }
  }
}

export function spawnPedestrians(world, rng, count) {
  const list = [];
  const skins = ['#ffd8a8', '#e0ac69', '#8d5524', '#f1c27d'];
  const shirts = ['#20e6ff', '#ff3ec8', '#ffd34d', '#9a6bff', '#35ffae'];
  for (let index = 0; index < count; index += 1) {
    const gx = Math.floor(rng() * GRID);
    const gy = Math.floor(rng() * GRID);
    const side = Math.floor(rng() * 4);
    const inset = ROAD / 2 + 8;
    let homeX;
    let homeY;
    let axis;
    if (side === 0) {
      homeX = gx * BLOCK + inset;
      homeY = gy * BLOCK + BLOCK / 2;
      axis = 'y';
    } else if (side === 1) {
      homeX = (gx + 1) * BLOCK - inset;
      homeY = gy * BLOCK + BLOCK / 2;
      axis = 'y';
    } else if (side === 2) {
      homeX = gx * BLOCK + BLOCK / 2;
      homeY = gy * BLOCK + inset;
      axis = 'x';
    } else {
      homeX = gx * BLOCK + BLOCK / 2;
      homeY = (gy + 1) * BLOCK - inset;
      axis = 'x';
    }
    list.push({
      x: homeX,
      y: homeY,
      homeX: homeX,
      homeY: homeY,
      axis: axis,
      range: 26 + rng() * 52,
      phase: rng() * 6.283,
      speed: 16 + rng() * 22,
      dir: rng() > 0.5 ? 1 : -1,
      skin: skins[Math.floor(rng() * skins.length)],
      shirt: shirts[Math.floor(rng() * shirts.length)],
      hit: false,
    });
  }
  world.pedestrians = list;
  return list;
}

export function updatePedestrians(list, dt) {
  for (let index = 0; index < list.length; index += 1) {
    const person = list[index];
    const offset = person.axis === 'x' ? person.x - person.homeX : person.y - person.homeY;
    if (offset > person.range) person.dir = -1;
    if (offset < -person.range) person.dir = 1;
    const movement = person.speed * person.dir * dt;
    if (person.axis === 'x') person.x += movement;
    else person.y += movement;
  }
}

export function spawnCash(world, rng, count) {
  const list = [];
  for (let index = 0; index < count; index += 1) {
    const col = 1 + Math.floor(rng() * (GRID - 1));
    const row = 1 + Math.floor(rng() * (GRID - 1));
    list.push({
      x: col * BLOCK + (rng() - 0.5) * ROAD * 0.75,
      y: row * BLOCK + (rng() - 0.5) * ROAD * 0.75,
      value: 50 + Math.floor(rng() * 5) * 25,
      taken: false,
      phase: rng() * 6.283,
    });
  }
  world.cash = list;
  return list;
}
