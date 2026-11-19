import { pointInBuilding, WORLD_W, WORLD_H } from './world.js';

export function createShots() {
  return { bullets: [], particles: [] };
}

export function fireShot(system, x, y, angle, owner, speed, damage, color, rng) {
  const aim = angle + (rng() - 0.5) * 0.02;
  system.bullets.push({
    x: x,
    y: y,
    vx: Math.cos(aim) * speed,
    vy: Math.sin(aim) * speed,
    life: 1.7,
    owner: owner,
    damage: damage,
    color: color,
  });
}

export function burst(system, x, y, color, count, rng) {
  for (let index = 0; index < count; index += 1) {
    const angle = rng() * Math.PI * 2;
    const speed = 35 + rng() * 140;
    system.particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.3 + rng() * 0.45,
      color: color,
    });
  }
}

export function updateShots(system, world, dt, hooks) {
  const bullets = system.bullets;

  for (let index = 0; index < bullets.length; index += 1) {
    const bullet = bullets[index];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (bullet.x < 0 || bullet.y < 0 || bullet.x > WORLD_W || bullet.y > WORLD_H || pointInBuilding(world, bullet.x, bullet.y)) {
      bullet.life = 0;
      burst(system, bullet.x, bullet.y, bullet.color, 4, hooks.rng);
      continue;
    }

    if (bullet.owner === 'player') {
      for (let carIndex = 0; carIndex < world.traffic.length; carIndex += 1) {
        const car = world.traffic[carIndex];
        if (Math.hypot(car.x - bullet.x, car.y - bullet.y) < 17) {
          bullet.life = 0;
          car.speed *= 0.6;
          burst(system, bullet.x, bullet.y, '#ffe45c', 8, hooks.rng);
          break;
        }
      }
      if (bullet.life > 0) {
        for (let carIndex = 0; carIndex < hooks.police.cars.length; carIndex += 1) {
          const car = hooks.police.cars[carIndex];
          if (Math.hypot(car.x - bullet.x, car.y - bullet.y) < 18) {
            bullet.life = 0;
            car.speed *= 0.7;
            burst(system, bullet.x, bullet.y, '#9fd8ff', 9, hooks.rng);
            break;
          }
        }
      }
      if (bullet.life > 0) {
        for (let officerIndex = 0; officerIndex < hooks.police.officers.length; officerIndex += 1) {
          const officer = hooks.police.officers[officerIndex];
          if (Math.hypot(officer.x - bullet.x, officer.y - bullet.y) < 12) {
            bullet.life = 0;
            officer.dead = true;
            burst(system, bullet.x, bullet.y, '#ff5b6e', 10, hooks.rng);
            break;
          }
        }
      }
    } else if (Math.hypot(hooks.player.x - bullet.x, hooks.player.y - bullet.y) < 14) {
      hooks.damagePlayer(bullet.damage);
      bullet.life = 0;
      burst(system, bullet.x, bullet.y, '#ff5b6e', 6, hooks.rng);
    }
  }

  system.bullets = bullets.filter(function (bullet) { return bullet.life > 0; });
  if (hooks.police) {
    hooks.police.officers = hooks.police.officers.filter(function (officer) { return !officer.dead; });
  }

  for (let index = 0; index < system.particles.length; index += 1) {
    const particle = system.particles[index];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= Math.pow(0.06, dt);
    particle.vy *= Math.pow(0.06, dt);
    particle.life -= dt;
  }
  system.particles = system.particles.filter(function (particle) { return particle.life > 0; });
}
