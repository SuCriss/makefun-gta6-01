import { CITY, clamp } from "./world.js";

const FOOT_SPEED = 168;
const CAR_ACCEL = 210;
const CAR_MAX = 330;
const CAR_REVERSE = 120;

export function createPlayer(world) {
  return {
    x: world.spawn.x,
    y: world.spawn.y,
    angle: -Math.PI * 0.5,
    aim: -Math.PI * 0.5,
    hp: 100,
    maxHp: 100,
    cash: 0,
    wanted: 0,
    wantedClock: 14,
    vehicle: null,
    speed: 0,
    fireClock: 0,
    dashClock: 0,
    reloadClock: 0,
    ammo: 24,
    reserve: 120,
    distance: 0,
    dashFx: 0
  };
}

export function playerPosition(player) {
  return player.vehicle || player;
}

export function nearestVehicle(world, player) {
  const source = playerPosition(player);
  let best = null;
  let bestDistance = 78;
  for (const car of world.traffic) {
    if (car === player.vehicle) continue;
    const distance = Math.hypot(car.x - source.x, car.y - source.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = car;
    }
  }
  return best;
}

export function toggleVehicle(player, world, notify) {
  if (player.vehicle) {
    const car = player.vehicle;
    player.x = car.x + Math.cos(car.angle + Math.PI * 0.5) * 42;
    player.y = car.y + Math.sin(car.angle + Math.PI * 0.5) * 42;
    player.angle = car.angle;
    player.vehicle = null;
    player.speed = 0;
    notify("ON FOOT");
    return;
  }
  const car = nearestVehicle(world, player);
  if (!car) {
    notify("NO VEHICLE NEARBY");
    return;
  }
  if (!car.stolen) {
    car.stolen = true;
    player.wanted = Math.max(player.wanted, 1);
    player.wantedClock = 14;
    if (car.kind === "sport") notify("SPORTS CAR STOLEN");
    else notify("GRAND THEFT");
  } else {
    notify("BACK IN THE RIDE");
  }
  player.vehicle = car;
  player.speed = 0;
}

export function addWanted(player, level) {
  player.wanted = clamp(player.wanted + level, 0, 5);
  player.wantedClock = 14;
}

export function hurtPlayer(player, amount, notify) {
  if (player.hp <= 0) return;
  player.hp = Math.max(0, player.hp - amount);
  if (player.hp <= 0) notify("WASTED");
}

export function firePlayerShot(player, game) {
  if (player.ammo <= 0 || player.reloadClock > 0 || player.fireClock > 0) return;
  player.ammo -= 1;
  player.fireClock = player.vehicle ? 0.22 : 0.15;
  const origin = playerPosition(player);
  const spread = player.vehicle ? 0.16 : 0.05;
  const angle = player.aim + (game.rng() - 0.5) * spread;
  const speed = 760;
  game.projectiles.push({
    x: origin.x + Math.cos(angle) * 26,
    y: origin.y + Math.sin(angle) * 26,
    px: origin.x,
    py: origin.y,
    vx: Math.cos(angle) * speed + (player.vehicle ? player.speed * Math.cos(player.vehicle.angle) * 0.4 : 0),
    vy: Math.sin(angle) * speed + (player.vehicle ? player.speed * Math.sin(player.vehicle.angle) * 0.4 : 0),
    life: 0.9,
    team: "player",
    damage: 26,
    hue: 186
  });
  for (let i = 0; i < 3; i += 1) {
    game.particles.push({
      x: origin.x + Math.cos(angle) * 28,
      y: origin.y + Math.sin(angle) * 28,
      vx: Math.cos(angle) * (60 + game.rng() * 90) + (game.rng() - 0.5) * 60,
      vy: Math.sin(angle) * (60 + game.rng() * 90) + (game.rng() - 0.5) * 60,
      life: 0.18 + game.rng() * 0.12,
      max: 0.3,
      hue: 42,
      size: 2 + game.rng() * 2
    });
  }
}

function reload(player, notify) {
  if (player.reserve <= 0 || player.ammo >= 24 || player.reloadClock > 0) return;
  player.reloadClock = 1.1;
  notify("RELOADING");
}

export function updatePlayer(player, game, dt) {
  const keys = game.keys;
  const origin = playerPosition(player);
  const previousX = origin.x;
  const previousY = origin.y;

  player.fireClock = Math.max(0, player.fireClock - dt);
  player.dashClock = Math.max(0, player.dashClock - dt);
  player.dashFx = Math.max(0, player.dashFx - dt);
  if (player.reloadClock > 0) {
    player.reloadClock -= dt;
    if (player.reloadClock <= 0) {
      const needed = 24 - player.ammo;
      const loaded = Math.min(needed, player.reserve);
      player.ammo += loaded;
      player.reserve -= loaded;
    }
  }

  const mouseWorldX = game.mouse.x + game.camera.x;
  const mouseWorldY = game.mouse.y + game.camera.y;
  player.aim = Math.atan2(mouseWorldY - origin.y, mouseWorldX - origin.x);

  if (player.vehicle) {
    const car = player.vehicle;
    const throttle = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const steering = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const handbrake = keys.Space ? 1 : 0;
    player.speed += throttle * CAR_ACCEL * dt;
    player.speed *= 1 - (0.5 + handbrake * 3.4) * dt;
    if (throttle < 0 && player.speed > 0) player.speed -= CAR_ACCEL * 1.6 * dt;
    player.speed = clamp(player.speed, -CAR_REVERSE, CAR_MAX);
    const grip = Math.min(1, Math.abs(player.speed) / 60);
    car.angle += steering * grip * (handbrake ? 2.4 : 1.5) * dt * (player.speed >= 0 ? 1 : -1);
    const nx = car.x + Math.cos(car.angle) * player.speed * dt;
    const ny = car.y + Math.sin(car.angle) * player.speed * dt;
    if (!game.world.solidAt(nx, car.y, 22)) car.x = nx;
    else player.speed *= -0.24;
    if (!game.world.solidAt(car.x, ny, 22)) car.y = ny;
    else player.speed *= -0.24;
    player.angle = car.angle;
  } else {
    let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    let my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    const length = Math.hypot(mx, my) || 1;
    mx /= length;
    my /= length;
    let velocity = FOOT_SPEED;
    if (keys.Space && player.dashClock <= 0 && (mx || my)) {
      player.dashClock = 0.85;
      player.dashFx = 0.22;
      velocity = 560;
    }
    const nx = player.x + mx * velocity * dt;
    const ny = player.y + my * velocity * dt;
    if (!game.world.solidAt(nx, player.y, 11)) player.x = nx;
    if (!game.world.solidAt(player.x, ny, 11)) player.y = ny;
    if (mx || my) player.angle = Math.atan2(my, mx);
  }

  const moved = playerPosition(player);
  player.distance += Math.hypot(moved.x - previousX, moved.y - previousY);

  if (game.mouse.down) firePlayerShot(player, game);
  if (keys.KeyR) {
    reload(player, game.notify);
    keys.KeyR = false;
  }

  for (const drop of game.world.pickups) {
    if (drop.taken) continue;
    if (Math.hypot(drop.x - moved.x, drop.y - moved.y) < 34) {
      drop.taken = true;
      player.cash += drop.value;
      game.stats.collected += 1;
      game.notify("CASH +$" + drop.value);
    }
  }

  if (player.wanted > 0) {
    player.wantedClock -= dt;
    if (player.wantedClock <= 0) {
      player.wanted -= 1;
      player.wantedClock = 13;
    }
  }
}

export function vehicleSpeedValue(player) {
  return player.vehicle ? Math.abs(player.speed) : 0;
}

export function isInsideBounds(player) {
  return player.x >= 0 && player.y >= 0 && player.x <= CITY.width && player.y <= CITY.height;
}
