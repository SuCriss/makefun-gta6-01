import { WORLD, clamp, wrapAngle, createCar, rnd, roadPoint, pointInBuilding } from './world.js';
import { damagePlayer } from './player.js';

export function createPolice(rng, n) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const p = roadPoint(rng);
    const c = createCar(rng, p.x, p.y, p.angle, false);
    c.color = '#eef3fa';
    c.hp = 6;
    c.speed = 0;
    c.maxSpeed = 1.85;
    c.cooldown = rnd(rng, 20, 110);
    c.siren = i % 2;
    c.flash = 0;
    list.push(c);
  }
  return list;
}

export function spawnPolice(game, n) {
  const rng = game.rng;
  for (let i = 0; i < n; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 620 + rng() * 180;
    const x = clamp(game.player.x + Math.cos(angle) * radius, 30, WORLD - 30);
    const y = clamp(game.player.y + Math.sin(angle) * radius, 30, WORLD - 30);
    const c = createCar(rng, x, y, angle + Math.PI, false);
    c.color = '#eef3fa';
    c.hp = 6;
    c.speed = 0.4;
    c.cooldown = 70 + rng() * 60;
    c.siren = (game.frame + i) % 2;
    c.flash = 0;
    game.police.push(c);
  }
}

export function updatePolice(list, game, dt) {
  const p = game.player;
  const active = p.wanted > 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    c.flash = (game.frame + c.siren * 11) % 22;
    if (c.cooldown > 0) c.cooldown -= dt;

    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const dist = Math.hypot(dx, dy);
    let desired = active ? Math.atan2(dy, dx) : c.angle + c.turn * 0.002;
    if (!active && pointInBuilding(game.world, c.x + Math.cos(c.angle) * 50, c.y + Math.sin(c.angle) * 50)) {
      desired = c.angle + 0.09 * c.turn;
    }
    const diff = wrapAngle(desired - c.angle);
    c.angle = wrapAngle(c.angle + clamp(diff, -0.085, 0.085) * dt);

    const aheadX = c.x + Math.cos(c.angle) * 46;
    const aheadY = c.y + Math.sin(c.angle) * 46;
    if (pointInBuilding(game.world, aheadX, aheadY)) {
      c.angle = wrapAngle(c.angle + 0.11 * dt * (c.turn || 1));
      c.speed *= Math.pow(0.94, dt);
    }

    const targetSpeed = active ? Math.min(1.9, 1.15 + p.wanted * 0.13) : 0.55;
    c.speed += clamp(targetSpeed - c.speed, -0.06 * dt, 0.055 * dt);
    c.x = clamp(c.x + Math.cos(c.angle) * c.speed * dt, 16, WORLD - 16);
    c.y = clamp(c.y + Math.sin(c.angle) * c.speed * dt, 16, WORLD - 16);

    if (active && dist < 28 && p.inCar) {
      damagePlayer(p, 2, game);
      game.combat.burst(p.x, p.y, '#ff4d5e', 4);
    }

    if (active && p.wanted >= 2 && dist < 560 && c.cooldown <= 0) {
      const jitter = Math.sin((game.frame + i * 37) * 0.21) * 0.045;
      const aim = Math.atan2(dy, dx) + jitter;
      game.combat.spawn(c.x + Math.cos(aim) * 18, c.y + Math.sin(aim) * 18, aim, 'police', 3.9, '#ff5b6e');
      c.cooldown = Math.max(52, 108 - p.wanted * 9);
    }
  }
}
