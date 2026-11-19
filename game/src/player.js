import { BLOCK, ROAD, clamp, resolveBuildings, clampEntity } from './world.js';
import { fireShot, burst } from './shots.js';

const TOP_SPEED = 235;

export function createPlayer(world) {
  return {
    x: 2 * BLOCK + ROAD * 0.24,
    y: 4 * BLOCK - ROAD * 0.24,
    angle: 0,
    health: 100,
    cash: 0,
    wanted: 0,
    ammo: 14,
    reserve: 84,
    magSize: 14,
    inCar: false,
    car: null,
    shootCooldown: 0,
    reloadTime: 0,
    hurt: 0,
    muzzle: 0,
    driveDistance: 0,
    evadedCount: 0,
    alive: true,
  };
}

function fire(player, game, angle) {
  player.shootCooldown = 0.14;
  player.ammo -= 1;
  player.muzzle = 0.07;
  const aim = angle + (game.rng() - 0.5) * 0.045;
  const originX = player.x + Math.cos(aim) * 18;
  const originY = player.y + Math.sin(aim) * 18;
  fireShot(game.shots, originX, originY, aim, 'player', 760, 26, '#ffe45c', game.rng);
  burst(game.shots, originX, originY, '#ff9f43', 3, game.rng);
  game.shake = Math.min(12, game.shake + 1.8);
}

export function beginReload(player, game) {
  if (player.ammo >= player.magSize || player.reserve <= 0 || player.reloadTime > 0) return;
  const needed = player.magSize - player.ammo;
  const loaded = Math.min(needed, player.reserve);
  player.reserve -= loaded;
  player.ammo += loaded;
  player.reloadTime = 0.85;
  game.toast('RELOADING');
}

export function toggleVehicle(player, world, game) {
  if (player.inCar && player.car) {
    const car = player.car;
    const exitSide = car.heading + Math.PI / 2;
    player.x = car.x + Math.cos(exitSide) * 30;
    player.y = car.y + Math.sin(exitSide) * 30;
    resolveBuildings(player, world, 11);
    clampEntity(player, 11);
    car.controlled = false;
    player.inCar = false;
    player.car = null;
    game.toast('LEFT THE VEHICLE');
    return;
  }

  let closest = null;
  let closestDistance = 58;
  for (let index = 0; index < world.traffic.length; index += 1) {
    const car = world.traffic[index];
    if (car.controlled || car.police) continue;
    const distance = Math.hypot(car.x - player.x, car.y - player.y);
    if (distance < closestDistance) {
      closest = car;
      closestDistance = distance;
    }
  }

  if (!closest) {
    game.toast('NO CAR IN RANGE');
    return;
  }

  closest.controlled = true;
  player.inCar = true;
  player.car = closest;
  player.x = closest.x;
  player.y = closest.y;
  player.angle = closest.heading;

  if (!closest.stolen) {
    closest.stolen = true;
    player.wanted = Math.min(5, player.wanted + 1);
    game.toast('CARJACK · WANTED +1');
    burst(game.shots, closest.x, closest.y, '#ffe45c', 10, game.rng);
  }
}

export function damagePlayer(player, amount, game) {
  if (!player.alive) return;
  player.health -= amount;
  player.hurt = 0.25;
  game.shake = Math.min(14, game.shake + amount * 0.18);
  if (player.health <= 0) {
    player.health = 0;
    player.alive = false;
  }
}

export function collectCash(player, world, game) {
  for (let index = 0; index < world.cash.length; index += 1) {
    const pickup = world.cash[index];
    if (pickup.taken) continue;
    if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 27) {
      pickup.taken = true;
      player.cash += pickup.value;
      game.cashCollected += 1;
      game.toast('CASH +' + pickup.value);
      burst(game.shots, pickup.x, pickup.y, '#35ffae', 9, game.rng);
    }
  }
}

export function updatePlayer(player, input, world, dt, game) {
  if (!player.alive) return;

  player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  player.reloadTime = Math.max(0, player.reloadTime - dt);
  player.hurt = Math.max(0, player.hurt - dt);
  player.muzzle = Math.max(0, player.muzzle - dt);

  const up = input.keys.has('KeyW') || input.keys.has('ArrowUp');
  const down = input.keys.has('KeyS') || input.keys.has('ArrowDown');
  const left = input.keys.has('KeyA') || input.keys.has('ArrowLeft');
  const right = input.keys.has('KeyD') || input.keys.has('ArrowRight');
  const sprint = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');

  if (player.inCar && player.car) {
    const car = player.car;
    if (up) car.speed += 145 * dt;
    if (down) car.speed -= 185 * dt;
    car.speed *= Math.pow(0.42, dt);
    car.speed = clamp(car.speed, -70, TOP_SPEED);
    const steer = (right ? 1 : 0) - (left ? 1 : 0);
    car.heading += steer * 2.35 * dt * (car.speed >= 0 ? 1 : -1);
    car.x += Math.cos(car.heading) * car.speed * dt;
    car.y += Math.sin(car.heading) * car.speed * dt;
    if (resolveBuildings(car, world, 17)) {
      car.speed *= -0.22;
      damagePlayer(player, 2, game);
    }
    clampEntity(car, 17);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.heading;
    player.driveDistance += Math.abs(car.speed) * dt;

    if (Math.abs(car.speed) > 70) {
      for (let index = 0; index < world.pedestrians.length; index += 1) {
        const person = world.pedestrians[index];
        if (person.hit) continue;
        if (Math.hypot(person.x - car.x, person.y - car.y) < 20) {
          person.hit = true;
          player.wanted = Math.min(5, player.wanted + 1);
          game.toast('HIT AND RUN · WANTED +1');
          burst(game.shots, person.x, person.y, '#ff4d6d', 8, game.rng);
        }
      }
    }
  } else {
    const dx = (right ? 1 : 0) - (left ? 1 : 0);
    const dy = (down ? 1 : 0) - (up ? 1 : 0);
    const length = Math.hypot(dx, dy) || 1;
    const speed = sprint ? 252 : 172;
    player.x += (dx / length) * speed * dt;
    player.y += (dy / length) * speed * dt;
    resolveBuildings(player, world, 11);
    clampEntity(player, 11);
    const aimX = input.aimX - player.x;
    const aimY = input.aimY - player.y;
    if (Math.hypot(aimX, aimY) > 2) player.angle = Math.atan2(aimY, aimX);
  }

  if (input.mouseDown && player.shootCooldown <= 0 && player.ammo > 0) {
    fire(player, game, Math.atan2(input.aimY - player.y, input.aimX - player.x));
  }
  if (input.action) toggleVehicle(player, world, game);
  if (input.reload) beginReload(player, game);
  if (player.reloadTime <= 0 && player.ammo === 0 && player.reserve > 0) beginReload(player, game);
}
