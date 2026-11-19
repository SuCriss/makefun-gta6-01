import { roadPoint, clampWorld } from "./world.js";

export function createPlayer(seed = 1) {
  const start = roadPoint(8, 2);
  return {
    x: start.x, y: start.y, angle: -Math.PI / 2,
    health: 100, armor: 20, cash: 320, wanted: 0,
    inCar: false, carId: null, speed: 0,
    ammo: 48, kills: 0, collected: 0, delivered: 0, distance: 0,
    alive: true, name: "ROOK", seed
  };
}

export function accelerate(player, input, dt) {
  const turn = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const thrust = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const top = player.inCar ? 6.2 : 3.1;
  const push = player.inCar ? 6.5 : 9.0;
  if (thrust !== 0) player.speed += thrust * push * dt;
  else player.speed *= Math.pow(0.02, dt);
  if (input.boost && player.inCar) player.speed *= Math.pow(2.2, dt);
  player.speed = Math.max(-top * 0.6, Math.min(top, player.speed));
  player.angle += turn * (player.inCar ? 2.4 : 3.4) * dt * (player.speed < 0 ? -1 : 1);
  const next = clampWorld({
    x: player.x + Math.cos(player.angle) * player.speed * 60 * dt,
    y: player.y + Math.sin(player.angle) * player.speed * 60 * dt
  });
  player.distance += Math.hypot(next.x - player.x, next.y - player.y);
  player.x = next.x;
  player.y = next.y;
}

export function nearestStealable(player, cars, radius = 52) {
  let best = null;
  let closest = radius;
  for (const car of cars) {
    if (car.kind === "police" || car.occupied) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < closest) { best = car; closest = d; }
  }
  return best;
}

export function enterCar(player, car) {
  if (!car || player.inCar) return false;
  player.inCar = true;
  player.carId = car.id;
  car.occupied = true;
  car.stolen = true;
  player.speed = Math.max(player.speed, 1.2);
  player.angle = car.angle;
  return true;
}

export function exitCar(player, cars) {
  if (!player.inCar) return null;
  const car = cars.find(item => item.id === player.carId) || null;
  if (car) {
    car.occupied = false;
    player.x = car.x + Math.cos(car.angle - Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle - Math.PI / 2) * 34;
  }
  player.inCar = false;
  player.carId = null;
  player.speed = 0;
  return car;
}

export function fire(player, aim, rng) {
  if (player.ammo <= 0) return null;
  player.ammo -= 1;
  const spread = (rng() - 0.5) * 0.14;
  const angle = Math.atan2(aim.y - player.y, aim.x - player.x) + spread;
  const muzzle = 22;
  return {
    x: player.x + Math.cos(angle) * muzzle,
    y: player.y + Math.sin(angle) * muzzle,
    vx: Math.cos(angle) * 520,
    vy: Math.sin(angle) * 520,
    life: 1.1, friendly: true, damage: 24
  };
}

export function hurt(player, amount) {
  if (!player.alive) return;
  const absorbed = Math.min(player.armor, amount * 0.6);
  player.armor -= absorbed;
  player.health -= amount - absorbed;
  if (player.health <= 0) { player.health = 0; player.alive = false; }
}

export function earn(player, amount) {
  player.cash += amount;
  player.collected += 1;
}

export function bumpWanted(player, amount = 1) {
  player.wanted = Math.min(5, Math.max(0, player.wanted + amount));
}
