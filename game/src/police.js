import { roadPoint, clampWorld, makeRng } from "./world.js";

export function createPolice(world, count = 6) {
  const rng = makeRng(world.seed + 907);
  const units = [];
  for (let i = 0; i < count; i++) {
    const tx = 4 * Math.floor(rng() * 10);
    const ty = 4 * Math.floor(rng() * 10);
    const p = roadPoint(tx, ty);
    units.push({
      id: i, kind: "police", x: p.x, y: p.y,
      angle: rng() * Math.PI * 2, speed: 0,
      health: 90, siren: i % 2 === 0, cooldown: 0
    });
  }
  return units;
}

export function updatePolice(units, player, dt, rng) {
  let outgoing = null;
  for (const unit of units) {
    if (!player.alive) {
      unit.speed *= Math.pow(0.1, dt);
      continue;
    }
    const active = player.wanted > 0;
    const dx = player.x - unit.x;
    const dy = player.y - unit.y;
    const dist = Math.hypot(dx, dy) || 1;
    const desired = active ? Math.atan2(dy, dx) : unit.angle;
    const delta = Math.atan2(Math.sin(desired - unit.angle), Math.cos(desired - unit.angle));
    unit.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, delta));
    unit.speed = active
      ? Math.min(5.4, unit.speed + 5 * dt)
      : Math.max(0, unit.speed - 4 * dt);
    if (dist > 46 || !active) {
      const stride = unit.speed * 66 * dt;
      const next = clampWorld({
        x: unit.x + Math.cos(unit.angle) * stride,
        y: unit.y + Math.sin(unit.angle) * stride
      });
      unit.x = next.x;
      unit.y = next.y;
    }
    unit.cooldown = Math.max(0, unit.cooldown - dt);
    if (!outgoing && active && dist < 320 && unit.cooldown <= 0 && player.wanted >= 2) {
      unit.cooldown = 1.1;
      const aim = Math.atan2(dy, dx) + (rng() - 0.5) * 0.1;
      outgoing = {
        x: unit.x + Math.cos(aim) * 24,
        y: unit.y + Math.sin(aim) * 24,
        vx: Math.cos(aim) * 430,
        vy: Math.sin(aim) * 430,
        life: 1.2, friendly: false, damage: 12
      };
    }
  }
  return outgoing;
}
