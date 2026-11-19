import { WORLD, clamp, wrapAngle, pointInBuilding, createCar } from './world.js';

export function createPlayer(world, rng) {
  const car = createCar(rng, world.spawn.x, world.spawn.y, world.spawn.angle, false);
  car.color = '#ff2f6d';
  car.maxSpeed = 2.1;
  car.stolen = false;
  return {
    x: world.spawn.x,
    y: world.spawn.y,
    angle: world.spawn.angle,
    speed: 0,
    car,
    inCar: true,
    health: 100,
    maxHealth: 100,
    money: 0,
    wanted: 0,
    cooldown: 0,
    ammo: 14,
    shotsFired: 0,
    hitFlash: 0,
    walkPhase: 0,
    color: '#22e0ff',
  };
}

export function damagePlayer(player, amount, game) {
  if (player.health <= 0) return;
  player.health = Math.max(0, player.health - amount);
  player.hitFlash = 10;
  if (player.health <= 0) {
    game.endReason = 'busted';
    game.mode = 'end';
    game.toast('BUSTED');
  }
}

export function tryEnterVehicle(player, game) {
  if (player.inCar) {
    const car = player.car;
    car.speed = 0;
    car.parked = true;
    game.world.parked.push(car);
    player.x = clamp(car.x + Math.cos(car.angle + Math.PI / 2) * 34, 10, WORLD - 10);
    player.y = clamp(car.y + Math.sin(car.angle + Math.PI / 2) * 34, 10, WORLD - 10);
    player.angle = car.angle;
    player.inCar = false;
    player.car = null;
    game.toast('ON FOOT');
    return;
  }
  let best = null;
  let bestD = 58;
  const list = game.world.parked;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best) {
    game.toast('NO VEHICLE NEARBY');
    return;
  }
  const idx = list.indexOf(best);
  if (idx >= 0) list.splice(idx, 1);
  best.parked = false;
  best.stolen = true;
  best.speed = 0;
  player.inCar = true;
  player.car = best;
  player.x = best.x;
  player.y = best.y;
  player.angle = best.angle;
  player.speed = 0;
  game.addWanted(1);
  game.toast('CAR JACKED');
}

function collide(player, nx, ny, game) {
  if (nx < 10 || ny < 10 || nx > WORLD - 10 || ny > WORLD - 10) return true;
  const b = pointInBuilding(game.world, nx, ny);
  if (b) return true;
  const parked = game.world.parked;
  for (let i = 0; i < parked.length; i++) {
    const c = parked[i];
    if (Math.hypot(c.x - nx, c.y - ny) < 22) {
      c.hp -= 1;
      damagePlayer(player, 3, game);
      game.addWanted(1);
      game.combat.burst(c.x, c.y, '#ffd23f', 7);
      return true;
    }
  }
  return false;
}

export function updatePlayer(player, game, dt) {
  const keys = game.input.keys;
  const has = (k) => keys.has(k);
  if (player.cooldown > 0) player.cooldown -= dt;
  if (player.hitFlash > 0) player.hitFlash -= dt;

  if (player.inCar && player.car) {
    const car = player.car;
    const throttle = (has('w') || has('arrowup') ? 1 : 0) - (has('s') || has('arrowdown') ? 1 : 0);
    const steer = (has('d') || has('arrowright') ? 1 : 0) - (has('a') || has('arrowleft') ? 1 : 0);
    const handbrake = has(' ');
    if (throttle > 0) car.speed += 0.085 * dt;
    else if (throttle < 0) car.speed -= 0.105 * dt;
    car.speed *= Math.pow(0.982, dt);
    if (handbrake) car.speed *= Math.pow(0.93, dt);
    car.speed = clamp(car.speed, -0.75, car.maxSpeed);
    const grip = clamp(Math.abs(car.speed) / 0.42, 0, 1);
    car.angle = wrapAngle(car.angle + steer * (handbrake ? 0.07 : 0.05) * grip * (car.speed >= 0 ? 1 : -1) * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (collide(player, nx, ny, game)) {
      if (Math.abs(car.speed) > 1.1) {
        damagePlayer(player, 2, game);
        game.combat.burst(car.x, car.y, '#ff8a3d', 5);
      }
      car.speed *= -0.28;
    } else {
      car.x = nx;
      car.y = ny;
    }
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.walkPhase += Math.abs(car.speed) * dt * 0.3;
  } else {
    let mx = (has('d') || has('arrowright') ? 1 : 0) - (has('a') || has('arrowleft') ? 1 : 0);
    let my = (has('s') || has('arrowdown') ? 1 : 0) - (has('w') || has('arrowup') ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      const nx = clamp(player.x + mx * 0.16 * dt, 10, WORLD - 10);
      const ny = clamp(player.y + my * 0.16 * dt, 10, WORLD - 10);
      if (!pointInBuilding(game.world, nx, ny)) { player.x = nx; player.y = ny; }
      player.walkPhase += dt * 0.35;
    }
    const wm = game.worldMouse;
    if (wm) player.angle = Math.atan2(wm.y - player.y, wm.x - player.x);
  }

  if (game.input.down && player.cooldown <= 0) {
    const aim = player.inCar ? Math.atan2(game.worldMouse.y - player.y, game.worldMouse.x - player.x) : player.angle;
    const ox = Math.cos(aim) * 17;
    const oy = Math.sin(aim) * 17;
    game.combat.spawn(player.x + ox, player.y + oy, aim, 'player', 5.4, '#ffe66b');
    player.shotsFired++;
    player.cooldown = player.inCar ? 13 : 9;
    player.ammo--;
    game.combat.burst(player.x + ox, player.y + oy, '#fff3b0', 3);
    if (player.ammo <= 0) { player.ammo = 14; player.cooldown = 38; game.toast('RELOADING'); }
    if (player.shotsFired % 4 === 1) game.addWanted(1);
  }
}
