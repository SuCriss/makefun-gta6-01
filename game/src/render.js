import { VIEW_W, VIEW_H, CELL, ROAD, GRID, WORLD, clamp } from './world.js';

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawCar(ctx, car, kind, frame) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, -19, -7, 40, 20, 5);
  ctx.fill();

  const body = kind === 'police' ? '#e9eef6' : car.color;
  ctx.shadowColor = kind === 'police' ? '#4da6ff' : body;
  ctx.shadowBlur = 10;
  ctx.fillStyle = body;
  roundRect(ctx, -17, -9, 34, 18, 5);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = kind === 'police' ? '#16233f' : 'rgba(10,18,34,0.92)';
  roundRect(ctx, -6, -7, 13, 14, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,200,255,0.18)';
  ctx.fillRect(-4, -6, 5, 12);

  ctx.fillStyle = '#fff6c8';
  ctx.fillRect(16, -7, 3, 4);
  ctx.fillRect(16, 3, 3, 4);
  ctx.fillStyle = '#ff2f45';
  ctx.fillRect(-18, -7, 3, 4);
  ctx.fillRect(-18, 3, 3, 4);

  ctx.fillStyle = '#0a0d17';
  ctx.fillRect(-11, -11, 8, 3);
  ctx.fillRect(3, -11, 8, 3);
  ctx.fillRect(-11, 8, 8, 3);
  ctx.fillRect(3, 8, 8, 3);

  if (kind === 'police') {
    const red = frame % 22 < 11;
    ctx.fillStyle = red ? '#ff2740' : '#1a2540';
    ctx.shadowColor = '#ff2740';
    ctx.shadowBlur = red ? 16 : 0;
    ctx.fillRect(-2, -8, 6, 4);
    ctx.fillStyle = red ? '#1a2540' : '#2f7bff';
    ctx.shadowColor = '#2f7bff';
    ctx.shadowBlur = red ? 0 : 16;
    ctx.fillRect(-2, 4, 6, 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#10182c';
    ctx.fillRect(-12, -6, 3, 12);
  }

  if (kind === 'player' && car.speed > 0.2) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.moveTo(18, -5); ctx.lineTo(86, -26); ctx.lineTo(86, 26); ctx.lineTo(18, 5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawPed(ctx, ped, frame) {
  if (!ped.alive) return;
  const bob = Math.sin(frame * 0.18 + ped.phase) * 1.2;
  ctx.save();
  ctx.translate(ped.x, ped.y + bob);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, -3, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-2.6, -0.5, 5.2, 6);
  ctx.restore();
}

function drawMoney(ctx, m, frame) {
  if (m.taken) return;
  const pulse = 0.8 + Math.sin(frame * 0.08 + m.phase) * 0.2;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(Math.sin(frame * 0.035 + m.phase) * 0.35);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = '#3dffa8';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#d6ffe8';
  ctx.beginPath();
  ctx.moveTo(0, -10); ctx.lineTo(9, 0); ctx.lineTo(0, 10); ctx.lineTo(-9, 0);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0c7a4c';
  ctx.font = 'bold 10px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', 0, 1);
  ctx.restore();
}

function drawMarker(ctx, x, y, frame, label) {
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.07);
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#ffd23f';
  ctx.shadowBlur = 14;
  ctx.globalAlpha = 0.55 + pulse * 0.45;
  ctx.beginPath();
  ctx.arc(0, 0, 18 + pulse * 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd23f';
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.font = 'bold 11px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(label, 0, -32);
  ctx.restore();
}

export function updateCamera(game, instant) {
  const p = game.player;
  const tx = clamp(p.x, VIEW_W / 2, WORLD - VIEW_W / 2);
  const ty = clamp(p.y, VIEW_H / 2, WORLD - VIEW_H / 2);
  if (instant) { game.camera.x = tx; game.camera.y = ty; }
  else {
    game.camera.x += (tx - game.camera.x) * 0.12;
    game.camera.y += (ty - game.camera.y) * 0.12;
  }
}

export function renderGame(ctx, game) {
  const cam = game.camera;
  const world = game.world;
  const frame = game.frame;
  const left = cam.x - VIEW_W / 2 - 90;
  const right = cam.x + VIEW_W / 2 + 90;
  const top = cam.y - VIEW_H / 2 - 90;
  const bottom = cam.y + VIEW_H / 2 + 90;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#070a14';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(VIEW_W / 2 - cam.x, VIEW_H / 2 - cam.y);

  ctx.fillStyle = '#0a0f1d';
  ctx.fillRect(left, top, right - left, bottom - top);

  ctx.fillStyle = '#101728';
  for (let i = 0; i <= GRID; i++) {
    const x = i * CELL - ROAD / 2;
    if (x + ROAD > left && x < right) ctx.fillRect(x, top, ROAD, bottom - top);
    const y = i * CELL - ROAD / 2;
    if (y + ROAD > top && y < bottom) ctx.fillRect(left, y, right - left, ROAD);
  }

  ctx.strokeStyle = 'rgba(90,140,190,0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID; i++) {
    const x = i * CELL;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    const y = i * CELL;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
  }

  ctx.fillStyle = 'rgba(210,230,255,0.32)';
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const ix = i * CELL;
      const iy = j * CELL;
      if (ix < left - 40 || ix > right + 40 || iy < top - 40 || iy > bottom + 40) continue;
      for (let k = -2; k <= 2; k++) {
        ctx.fillRect(ix - ROAD / 2 + 6 + k * 13, iy - ROAD / 2 + 4, 7, 3);
        ctx.fillRect(ix - ROAD / 2 + 6 + k * 13, iy + ROAD / 2 - 7, 7, 3);
        ctx.fillRect(ix - ROAD / 2 + 4, iy - ROAD / 2 + 6 + k * 13, 3, 7);
        ctx.fillRect(ix + ROAD / 2 - 7, iy - ROAD / 2 + 6 + k * 13, 3, 7);
      }
    }
  }

  for (let i = 0; i < world.blocks.length; i++) {
    const b = world.blocks[i];
    if (b.x > right || b.x + b.w < left || b.y > bottom || b.y + b.h < top) continue;
    ctx.fillStyle = b.tone ? '#151d31' : '#121a2c';
    ctx.fillRect(b.x - 7, b.y - 7, b.w + 14, b.h + 14);
    ctx.strokeStyle = 'rgba(34,224,255,0.10)';
    ctx.strokeRect(b.x - 7, b.y - 7, b.w + 14, b.h + 14);
  }

  for (let i = 0; i < world.buildings.length; i++) {
    const b = world.buildings[i];
    if (b.x > right || b.x + b.w < left || b.y > bottom || b.y + b.h < top) continue;
    ctx.fillStyle = b.fill;
    roundRect(ctx, b.x, b.y, b.w, b.h, 4);
    ctx.fill();
    ctx.save();
    ctx.shadowColor = b.neon;
    ctx.shadowBlur = 9;
    ctx.strokeStyle = b.neon;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();

    for (let k = 0; k < b.windows.length; k++) {
      const w = b.windows[k];
      ctx.fillStyle = w.hot
        ? `rgba(255,210,63,${0.45 + 0.4 * Math.sin(frame * 0.05 + k)})`
        : w.lit ? 'rgba(130,220,255,0.35)' : 'rgba(8,12,22,0.55)';
      ctx.fillRect(b.x + w.x, b.y + w.y, 5, 5);
    }

    if (b.sign) {
      ctx.save();
      ctx.fillStyle = b.neon;
      ctx.globalAlpha = 0.85;
      ctx.font = 'bold 10px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(b.sign, b.x + b.w / 2, b.y + 14);
      ctx.restore();
    }
    if (b.antenna) {
      ctx.strokeStyle = 'rgba(180,200,220,0.5)';
      ctx.beginPath();
      ctx.moveTo(b.x + b.w / 2, b.y);
      ctx.lineTo(b.x + b.w / 2, b.y - 14);
      ctx.stroke();
      if (frame % 60 < 30) {
        ctx.fillStyle = '#ff3b5c';
        ctx.fillRect(b.x + b.w / 2 - 1.5, b.y - 17, 3, 3);
      }
    }
  }

  for (let i = 0; i < world.trees.length; i++) {
    const t = world.trees[i];
    if (t.x < left || t.x > right || t.y < top || t.y > bottom) continue;
    ctx.fillStyle = '#123c2c';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2cba7a';
    ctx.beginPath(); ctx.arc(t.x - 2, t.y - 2, t.r * 0.62, 0, Math.PI * 2); ctx.fill();
  }

  for (let i = 0; i < world.lamps.length; i++) {
    const l = world.lamps[i];
    if (l.x < left || l.x > right || l.y < top || l.y > bottom) continue;
    ctx.fillStyle = '#33415e';
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    const g = ctx.createRadialGradient(l.x, l.y, 1, l.x, l.y, 26);
    g.addColorStop(0, 'rgba(255,226,150,0.35)');
    g.addColorStop(1, 'rgba(255,226,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(l.x - 26, l.y - 26, 52, 52);
  }

  const marker = world.missionPoints[game.missionIndex];
  if (marker && game.missionIndex < 3) drawMarker(ctx, marker.x, marker.y, frame, 'CONTRACT');

  for (let i = 0; i < world.money.length; i++) {
    const m = world.money[i];
    if (m.x < left || m.x > right || m.y < top || m.y > bottom) continue;
    drawMoney(ctx, m, frame);
  }

  for (let i = 0; i < world.peds.length; i++) {
    const ped = world.peds[i];
    if (ped.x < left || ped.x > right || ped.y < top || ped.y > bottom) continue;
    drawPed(ctx, ped, frame);
  }

  for (let i = 0; i < world.parked.length; i++) {
    const c = world.parked[i];
    if (c.x < left || c.x > right || c.y < top || c.y > bottom) continue;
    drawCar(ctx, c, 'civilian', frame);
  }

  for (let i = 0; i < game.traffic.length; i++) {
    const c = game.traffic[i];
    if (c.x < left || c.x > right || c.y < top || c.y > bottom) continue;
    drawCar(ctx, c, 'civilian', frame);
  }

  for (let i = 0; i < game.police.length; i++) {
    const c = game.police[i];
    if (c.x < left || c.x > right || c.y < top || c.y > bottom) continue;
    drawCar(ctx, c, 'police', frame);
  }

  const p = game.player;
  if (p.inCar && p.car) drawCar(ctx, p.car, 'player', frame);
  else {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(0, 6, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.fillRect(-5, -5, 10, 11);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffe1c4';
    ctx.beginPath(); ctx.arc(0, -7, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(7, -1.5, 8, 3);
    ctx.restore();
  }

  const combat = game.combat;
  for (let i = 0; i < combat.shots.length; i++) {
    const s = combat.shots[i];
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.owner === 'police' ? 2 : 2.4;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * 1.8, s.y - s.vy * 1.8);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  for (let i = 0; i < combat.particles.length; i++) {
    const q = combat.particles[i];
    ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;

  if (p.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,60,80,${0.12 * (p.hitFlash / 10)})`;
    ctx.fillRect(left, top, right - left, bottom - top);
  }

  ctx.restore();

  const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 220, VIEW_W / 2, VIEW_H / 2, 780);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

export function renderMinimap(ctx, game) {
  const size = 180;
  const scale = size / WORLD;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#050914';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(34,224,255,0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= GRID; i++) {
    const v = i * CELL * scale;
    ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(size, v); ctx.stroke();
  }

  ctx.fillStyle = 'rgba(120,150,200,0.28)';
  for (let i = 0; i < game.world.buildings.length; i++) {
    const b = game.world.buildings[i];
    ctx.fillRect(b.x * scale, b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  }

  ctx.fillStyle = '#3dffa8';
  for (let i = 0; i < game.world.money.length; i++) {
    const m = game.world.money[i];
    if (!m.taken) ctx.fillRect(m.x * scale - 1, m.y * scale - 1, 2, 2);
  }

  ctx.fillStyle = '#ff4d5e';
  for (let i = 0; i < game.police.length; i++) {
    const c = game.police[i];
    ctx.beginPath(); ctx.arc(c.x * scale, c.y * scale, 2.6, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = '#9aa8bd';
  for (let i = 0; i < game.traffic.length; i++) {
    const c = game.traffic[i];
    ctx.fillRect(c.x * scale - 1, c.y * scale - 1, 2, 2);
  }

  const mark = game.world.missionPoints[game.missionIndex];
  if (mark && game.missionIndex < 3) {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mark.x * scale, mark.y * scale, 5, 0, Math.PI * 2); ctx.stroke();
  }

  const p = game.player;
  ctx.save();
  ctx.translate(p.x * scale, p.y * scale);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#22e0ff';
  ctx.shadowColor = '#22e0ff';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
