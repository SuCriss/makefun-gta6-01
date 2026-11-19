import { CITY, clamp, pointOnRoad } from "./world.js";
import { hurtPlayer } from "./player.js";

export function createPolice() {
  return [];
}

function spawnOfficer(player, world, rng, index) {
  const angle = (index / 5) * Math.PI * 2 + rng() * 0.7;
  const radius = 520 + rng() * 190;
  const rawX = clamp(player.x + Math.cos(angle) * radius, 60, CITY.width - 60);
  const rawY = clamp(player.y + Math.sin(angle) * radius, 60, CITY.height - 60);
  const spot = pointOnRoad(rawX, rawY);
  return {
    x: spot.x,
    y: spot.y,
    angle: Math.atan2(player.y - spot.y, player.x - spot.x),
    speed: 148 + player.wanted * 26 + rng() * 28,
    turn: 2.2 + rng() * 0.6,
    fireClock: 0.6 + rng() * 0.8,
    hp: 70 + player.wanted * 10,
    hue: index % 2 ? 200 : 350
  };
}

export function updatePolice(police, player, game, dt) {
  const target = player.wanted > 0 ? Math.min(10, player.wanted * 2) : 0;
  if (police.length < target) {
    police.push(spawnOfficer(player, game.world, game.rng, police.length));
  } else if (police.length > target + 1) {
    police.pop();
  }

  for (const officer of police) {
    const dx = player.x - officer.x;
    const dy = player.y - officer.y;
    const distance = Math.hypot(dx, dy) || 1;
    const desired = Math.atan2(dy, dx);
    let difference = desired - officer.angle;
    while (difference > Math.PI) difference -= Math.PI * 2;
    while (difference < -Math.PI) difference += Math.PI * 2;
    officer.angle += clamp(difference, -officer.turn * dt, officer.turn * dt);
    const cruise = distance > 170 ? officer.speed : officer.speed * 0.28;
    const nx = officer.x + Math.cos(officer.angle) * cruise * dt;
    const ny = officer.y + Math.sin(officer.angle) * cruise * dt;
    if (!game.world.solidAt(nx, officer.y, 17)) officer.x = nx;
    else officer.angle += 1.4 * dt;
    if (!game.world.solidAt(officer.x, ny, 17)) officer.y = ny;
    else officer.angle += 1.4 * dt;

    officer.fireClock -= dt;
    if (officer.fireClock <= 0 && distance < 560) {
      officer.fireClock = Math.max(0.45, 1.5 - player.wanted * 0.16 + game.rng() * 0.5);
      const aim = Math.atan2(dy, dx) + (game.rng() - 0.5) * 0.14;
      const speed = 430;
      game.projectiles.push({
        x: officer.x + Math.cos(aim) * 22,
        y: officer.y + Math.sin(aim) * 22,
        px: officer.x,
        py: officer.y,
        vx: Math.cos(aim) * speed,
        vy: Math.sin(aim) * speed,
        life: 1.3,
        team: "police",
        damage: 7 + player.wanted,
        hue: officer.hue
      });
    }
  }
}

export function updateProjectiles(game, dt) {
  const world = game.world;
  const player = game.player;
  for (let i = game.projectiles.length - 1; i >= 0; i -= 1) {
    const shot = game.projectiles[i];
    shot.px = shot.x;
    shot.py = shot.y;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    let consumed = shot.life <= 0 || world.solidAt(shot.x, shot.y, 2);

    if (!consumed && shot.team === "police") {
      if (Math.hypot(shot.x - player.x, shot.y - player.y) < (player.vehicle ? 26 : 16)) {
        hurtPlayer(player, shot.damage, game.notify);
        consumed = true;
      }
    }

    if (!consumed && shot.team === "player") {
      for (let k = game.police.length - 1; k >= 0; k -= 1) {
        const officer = game.police[k];
        if (Math.hypot(shot.x - officer.x, shot.y - officer.y) < 20) {
          officer.hp -= shot.damage;
          consumed = true;
          if (officer.hp <= 0) {
            game.police.splice(k, 1);
            game.stats.takedowns += 1;
            player.cash += 90;
            game.notify("OFFICER DOWN +$90");
          }
          break;
        }
      }
    }

    if (consumed) {
      game.particles.push({
        x: shot.x,
        y: shot.y,
        vx: 0,
        vy: 0,
        life: 0.16,
        max: 0.16,
        hue: shot.hue,
        size: 6
      });
      game.projectiles.splice(i, 1);
    }
  }
}

export function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 1 - 2.2 * dt;
    particle.vy *= 1 - 2.2 * dt;
    particle.life -= dt;
    if (particle.life <= 0) particles.splice(i, 1);
  }
}
