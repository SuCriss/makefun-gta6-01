export const CITY = Object.freeze({
  width: 4320,
  height: 3240,
  block: 240,
  road: 76,
  defaultSeed: 20261119
});

const NEON_HUES = [186, 320, 42, 268, 12, 152];

export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

function gridDistance(value, spacing) {
  const remainder = ((value % spacing) + spacing) % spacing;
  return Math.min(remainder, spacing - remainder);
}

export function isRoad(x, y) {
  const half = CITY.road * 0.5;
  return gridDistance(x, CITY.block) <= half || gridDistance(y, CITY.block) <= half;
}

export function pointOnRoad(x, y) {
  const gx = Math.round(x / CITY.block) * CITY.block;
  const gy = Math.round(y / CITY.block) * CITY.block;
  return Math.abs(x - gx) < Math.abs(y - gy) ? { x: gx, y: clamp(y, 0, CITY.height) } : { x: clamp(x, 0, CITY.width), y: gy };
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

function buildBlocks(rng) {
  const buildings = [];
  const plazas = [];
  const lights = [];
  const cols = Math.floor(CITY.width / CITY.block);
  const rows = Math.floor(CITY.height / CITY.block);
  const inset = CITY.road * 0.5 + 10;
  const cell = CITY.block - inset * 2;

  for (let gx = 0; gx < cols; gx += 1) {
    for (let gy = 0; gy < rows; gy += 1) {
      const ox = gx * CITY.block + inset;
      const oy = gy * CITY.block + inset;
      lights.push({ x: gx * CITY.block, y: gy * CITY.block, hue: (gx + gy) % 2 ? 186 : 320 });

      if (rng() < 0.07) {
        plazas.push({ x: ox, y: oy, w: cell, h: cell, hue: pick(rng, [152, 186]) });
        continue;
      }

      const splitVertical = rng() < 0.5;
      const pieces = rng() < 0.34 ? 2 : 1;
      for (let part = 0; part < pieces; part += 1) {
        const gap = 8;
        const portion = (cell - gap * (pieces - 1)) / pieces;
        const bx = splitVertical ? ox + part * (portion + gap) : ox;
        const by = splitVertical ? oy : oy + part * (portion + gap);
        const bw = splitVertical ? portion : cell;
        const bh = splitVertical ? cell : portion;
        const shrink = 2 + rng() * 10;
        buildings.push({
          x: bx + shrink * 0.5,
          y: by + shrink * 0.5,
          w: Math.max(28, bw - shrink),
          h: Math.max(28, bh - shrink),
          hue: pick(rng, NEON_HUES),
          seed: Math.floor(rng() * 100000),
          rows: 2 + Math.floor(rng() * 4),
          cols: 2 + Math.floor(rng() * 4),
          level: 1 + Math.floor(rng() * 4),
          sign: rng() < 0.24 ? pick(rng, ["NOODLES", "MOTEL", "ARCADE", "PAWN", "NEON", "CLUB", "DATA", "ARMS"]) : ""
        });
      }
    }
  }
  return { buildings, plazas, lights };
}

function buildTraffic(rng) {
  const cars = [];
  const verticalCount = Math.floor(CITY.width / CITY.block);
  const horizontalCount = Math.floor(CITY.height / CITY.block);
  for (let i = 0; i < 26; i += 1) {
    const vertical = rng() < 0.5;
    const line = 1 + Math.floor(rng() * ((vertical ? verticalCount : horizontalCount) - 1));
    const laneSign = rng() < 0.5 ? -1 : 1;
    const lane = laneSign * CITY.road * 0.23;
    const dir = laneSign > 0 ? -1 : 1;
    const fixed = line * CITY.block + lane;
    const along = rng() * (vertical ? CITY.height : CITY.width);
    cars.push({
      x: vertical ? fixed : along,
      y: vertical ? along : fixed,
      vertical,
      dir,
      speed: 44 + rng() * 52,
      hue: pick(rng, NEON_HUES),
      kind: rng() < 0.26 ? "sport" : "sedan",
      stolen: false
    });
  }
  return cars;
}

function buildPedestrians(rng) {
  const people = [];
  for (let i = 0; i < 46; i += 1) {
    const onVertical = rng() < 0.5;
    const line = Math.floor(rng() * (onVertical ? CITY.width : CITY.height) / CITY.block);
    const edge = (rng() < 0.5 ? -1 : 1) * (CITY.road * 0.5 + 12);
    const axisPos = rng() * (onVertical ? CITY.height : CITY.width);
    const x = onVertical ? line * CITY.block + edge : axisPos;
    const y = onVertical ? axisPos : line * CITY.block + edge;
    people.push({
      x: clamp(x, 10, CITY.width - 10),
      y: clamp(y, 10, CITY.height - 10),
      angle: rng() * Math.PI * 2,
      turn: 0,
      speed: 24 + rng() * 22,
      hue: pick(rng, NEON_HUES),
      height: 3 + rng() * 2
    });
  }
  return people;
}

function buildPickups(rng) {
  const drops = [];
  const positions = [
    { x: 480, y: 480 }, { x: 1200, y: 480 }, { x: 1920, y: 720 },
    { x: 960, y: 1440 }, { x: 2400, y: 1200 }, { x: 2880, y: 2160 },
    { x: 1680, y: 2640 }, { x: 3600, y: 1440 }, { x: 3360, y: 2640 },
    { x: 720, y: 2400 }, { x: 2640, y: 960 }, { x: 4080, y: 2880 }
  ];
  for (const position of positions) {
    drops.push({
      x: position.x + (rng() - 0.5) * 22,
      y: position.y + (rng() - 0.5) * 22,
      value: 140 + Math.floor(rng() * 5) * 60,
      taken: false,
      phase: rng() * 6.28
    });
  }
  return drops;
}

export function createWorld(seed) {
  const rng = makeRng(seed);
  const blocks = buildBlocks(rng);
  const spawn = { x: 1200, y: 1560 };
  const missions = [
    { id: 0, title: "FIRST SCORE", brief: "Grab three cash drops", goal: 3, reward: 800, x: 480, y: 480 },
    { id: 1, title: "HOT RIDE", brief: "Steal a sports car", goal: 1, reward: 1600, x: 1920, y: 720 },
    { id: 2, title: "BREAK THE LINE", brief: "Reach 3 wanted stars and survive", goal: 20, reward: 3200, x: 2880, y: 2160 }
  ];
  return {
    seed,
    width: CITY.width,
    height: CITY.height,
    spawn,
    buildings: blocks.buildings,
    plazas: blocks.plazas,
    lights: blocks.lights,
    traffic: buildTraffic(rng),
    pedestrians: buildPedestrians(rng),
    pickups: buildPickups(rng),
    missions,
    solidAt(x, y, radius) {
      if (x < radius || y < radius || x > CITY.width - radius || y > CITY.height - radius) return true;
      for (const building of this.buildings) {
        if (x + radius > building.x && x - radius < building.x + building.w && y + radius > building.y && y - radius < building.y + building.h) return true;
      }
      return false;
    }
  };
}

export function updateTraffic(cars, dt) {
  for (const car of cars) {
    if (car.vertical) {
      car.y += car.dir * car.speed * dt;
      if (car.y > CITY.height + 100) car.y = -100;
      if (car.y < -100) car.y = CITY.height + 100;
    } else {
      car.x += car.dir * car.speed * dt;
      if (car.x > CITY.width + 100) car.x = -100;
      if (car.x < -100) car.x = CITY.width + 100;
    }
  }
}

export function updatePedestrians(people, dt, rng) {
  for (const person of people) {
    if (rng() < dt * 0.3) person.turn = (rng() - 0.5) * 1.8;
    person.angle += clamp(person.turn - person.angle, -dt * 1.6, dt * 1.6);
    const nx = person.x + Math.cos(person.angle) * person.speed * dt;
    const ny = person.y + Math.sin(person.angle) * person.speed * dt;
    if (nx < 8 || nx > CITY.width - 8) person.angle = Math.PI - person.angle;
    if (ny < 8 || ny > CITY.height - 8) person.angle = -person.angle;
    person.x = clamp(nx, 8, CITY.width - 8);
    person.y = clamp(ny, 8, CITY.height - 8);
  }
}

export function carAngle(car) {
  if (!car.vertical) return car.dir > 0 ? 0 : Math.PI;
  return car.dir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
}
