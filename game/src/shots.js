import { WORLD, clamp, pointInBuilding, rnd } from './world.js';
import { damagePlayer } from './player.js';

export function createCombat(rng) {
  return { shots: [], particles: [], rng };
}

export function spawn(combat, x, y, angle, owner, speed, color) {
  combat.shots.push({
    x, y, angle, owner, color,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 150,
    trail: [],
  });
}

export function burst(combat, x, y, color, count) {
  const rng = combat.rng;
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const s = rnd(rng, 0.3, 1.5);
    combat.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rnd(rng, 14, 30), max: 30, color, size: rnd(rng, 1.5, 3.6),
    });
  }
}

export function explosion(combat, x, y) {
  burst(combat, x, y, '#ffd23f', 18);
  burst(combat, x, y, '#ff5b2e', 14);
  burst(combat, x, y, '#5a5f70', 10);
}

export function updateCombat(combat, game, dt) {
  const world = game.world;
  const shots = combat.shots;

  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.trail.push({ x: s.x, y: s.y });
    if (s.trail.length > 5) s.trail.shift();
    const nx = s.x + s.vx * dt;
    const ny = s.y + s.vy * dt;
    s.life -= dt;
    let dead = s.life <= 0 || nx < 6 || ny < 6 || nx > WORLD - 6 || ny > WORLD - 6;

    if (!dead && pointInBuilding(world, nx, ny)) {
      burst(combat, nx, ny, s.color, 4);
      dead = true;
    }

    if (!dead && s.owner === 'player') {
      for (let k = game.police.length - 1; k >= 0; k--) {
        const c = game.police[k];
        if (Math.hypot(c.x - nx, c.y - ny) < 21) {
          c.hp -= 1;
          burst(combat, nx, ny, '#9be7ff', 6);
          dead = true;
          if (c.hp <= 0) {
            explosion(combat, c.x, c.y);
            game.police.splice(k, 1);
            game.onKill('police');
          }
          break;
        }
      }
    }

    if (!dead && s.owner === 'player') {
      for (let k = 0; k < world.peds.length; k++) {
        const ped = world.peds[k];
        if (ped.alive && Math.hypot(ped.x - nx, ped.y - ny) < 11) {
          ped.alive = false;
          burst(combat, ped.x, ped.y, '#ff6b9d', 5);
          dead = true;
          game.onKill('ped');
          break;
        }
      }
    }

    if (!dead && s.owner === 'police') {
      const p = game.player;
      if (Math.hypot(p.x - nx, p.y - ny) < 17) {
        damagePlayer(p, p.inCar ? 5 : 8, game);
        burst(combat, nx, ny, '#ff4d5e', 6);
        dead = true;
      }
    }

    if (dead) shots.splice(i, 1);
    else { s.x = nx; s.y = ny; }
  }

  const parts = combat.particles;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.94, dt);
    p.vy *= Math.pow(0.94, dt);
    if (p.life <= 0) parts.splice(i, 1);
  }
}
