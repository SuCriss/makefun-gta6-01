import { WORLD_W, WORLD_H, BLOCK, clamp, resolveBuildings, clampEntity } from './world.js';
import { fireShot } from './shots.js';
import { damagePlayer } from './player.js';

function roadSnap(value) {
  const modulo = ((value % BLOCK) + BLOCK) % BLOCK;
  return value + (modulo < BLOCK / 2 ? -modulo : BLOCK - modulo);
}

export function createPolice() {
  return { cars: [], officers: [], spawnClock: 0, evadeClock: 0 };
}

export function spawnCruiser(police, player, world, game) {
  const rng = game.rng;
  const side = Math.floor(rng() * 4);
  const margin = 70;
  let x;
  let y;
  if (side === 0) {
    x = roadSnap(clamp(player.x + (rng() - 0.5) * 560, margin, WORLD_W - margin));
    y = margin;
  } else if (side === 1) {
    x = WORLD_W - margin;
    y = roadSnap(clamp(player.y + (rng() - 0.5) * 560, margin, WORLD_H - margin));
  } else if (side === 2) {
    x = roadSnap(clamp(player.x + (rng() - 0.5) * 560, margin, WORLD_W - margin));
    y = WORLD_H - margin;
  } else {
    x = margin;
    y = roadSnap(clamp(player.y + (rng() - 0.5) * 560, margin, WORLD_H - margin));
  }
  const car = {
    x: x,
    y: y,
    heading: Math.atan2(player.y - y, player.x - x),
    speed: 0,
    color: '#e8f0ff',
    police: true,
    controlled: false,
    stolen: false,
    shotClock: 1.1,
    w: 34,
    h: 18,
  };
  police.cars.push(car);
  return car;
}

export function spawnOfficer(police, player, game) {
  const rng = game.rng;
  const angle = rng() * Math.PI * 2;
  const distance = 190 + rng() * 130;
  const officer = {
    x: clamp(player.x + Math.cos(angle) * distance, 20, WORLD_W - 20),
    y: clamp(player.y + Math.sin(angle) * distance, 20, WORLD_H - 20),
    heading: angle + Math.PI,
    speed: 78 + rng() * 32,
    shotClock: 0.8 + rng(),
  };
  police.officers.push(officer);
  return officer;
}

export function updatePolice(police, player, world, dt, game) {
  const wanted = player.wanted;
  police.spawnClock -= dt;

  const wantedCars = wanted <= 0 ? 0 : Math.min(6, wanted + 1);
  const wantedOfficers = wanted <= 0 ? 0 : Math.min(5, wanted + 1);
  if (wanted > 0 && police.spawnClock <= 0 && police.cars.length < wantedCars) {
    spawnCruiser(police, player, world, game);
    police.spawnClock = 2.2;
  }
  if (wanted > 0 && police.officers.length < wantedOfficers && game.rng() < dt * 0.7) {
    spawnOfficer(police, player, game);
  }

  let someoneNear = false;

  for (let index = 0; index < police.cars.length; index += 1) {
    const car = police.cars[index];
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < 520) someoneNear = true;

    const target = Math.atan2(dy, dx);
    let difference = target - car.heading;
    while (difference > Math.PI) difference -= Math.PI * 2;
    while (difference < -Math.PI) difference += Math.PI * 2;
    car.heading += clamp(difference, -2.6 * dt, 2.6 * dt);
    car.speed = clamp(car.speed + 95 * dt, 0, 185);
    car.x += Math.cos(car.heading) * car.speed * dt;
    car.y += Math.sin(car.heading) * car.speed * dt;
    resolveBuildings(car, world, 17);
    clampEntity(car, 17);

    car.shotClock -= dt;
    if (wanted >= 2 && distance < 300 && car.shotClock <= 0) {
      const aim = Math.atan2(player.y - car.y, player.x - car.x) + (game.rng() - 0.5) * 0.14;
      fireShot(game.shots, car.x + Math.cos(aim) * 20, car.y + Math.sin(aim) * 20, aim, 'police', 560, 9, '#ff5b6e', game.rng);
      car.shotClock = 0.85 + game.rng() * 0.5;
    }
    if (distance < 28 && player.inCar) {
      damagePlayer(player, 7 * dt, game);
      car.speed *= 0.9;
    }
  }

  for (let index = 0; index < police.officers.length; index += 1) {
    const officer = police.officers[index];
    const dx = player.x - officer.x;
    const dy = player.y - officer.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < 520) someoneNear = true;
    officer.heading = Math.atan2(dy, dx);
    if (distance > 26) {
      officer.x += Math.cos(officer.heading) * officer.speed * dt;
      officer.y += Math.sin(officer.heading) * officer.speed * dt;
      resolveBuildings(officer, world, 9);
      clampEntity(officer, 9);
    }
    officer.shotClock -= dt;
    if (distance < 260 && officer.shotClock <= 0) {
      const aim = Math.atan2(dy, dx) + (game.rng() - 0.5) * 0.12;
      fireShot(game.shots, officer.x, officer.y, aim, 'police', 520, 7, '#ff5b6e', game.rng);
      officer.shotClock = 1.1 + game.rng() * 0.6;
    }
    if (distance < 18) damagePlayer(player, 11 * dt, game);
  }

  if (someoneNear) police.evadeClock = 0;
  else police.evadeClock += dt;

  if (wanted > 0 && police.evadeClock > 9) {
    player.wanted -= 1;
    player.evadedCount += 1;
    police.evadeClock = 0;
    game.toast('LOST THE HEAT · WANTED -1');
  }

  if (wanted === 0) {
    police.cars.length = 0;
    police.officers.length = 0;
  }
}
