import { BLOCK, ROAD, GRID, WORLD_W, WORLD_H, MISSIONS } from './world.js';

const COLORS = {
  bg: '#05060f',
  road: '#0e1220',
  edge: '#1b2340',
  cyan: '#20e6ff',
  pink: '#ff3ec8',
  gold: '#ffe45c',
  red: '#ff4d6d',
  green: '#35ffae',
};

function rounded(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, w, h, accent) {
  ctx.save();
  rounded(ctx, x, y, w, h, 11);
  ctx.fillStyle = 'rgba(6,10,22,0.82)';
  ctx.fill();
  ctx.strokeStyle = accent || 'rgba(32,230,255,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = accent || COLORS.cyan;
  ctx.fillRect(x + 1, y + 1, 3, h - 2);
  ctx.restore();
}

function money(value) {
  return '$' + String(Math.floor(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function star(ctx, cx, cy, outer, inner, fill) {
  ctx.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const radius = index % 2 === 0 ? outer : inner;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function visible(x, y, w, h, cam, view) {
  const left = cam.x - view.w / 2 - 70;
  const right = cam.x + view.w / 2 + 70;
  const top = cam.y - view.h / 2 - 70;
  const bottom = cam.y + view.h / 2 + 70;
  return !(x + w < left || x > right || y + h < top || y > bottom);
}

function drawGround(ctx, game, view, cam) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(cam.x - view.w / 2 - 220, cam.y - view.h / 2 - 220, view.w + 440, view.h + 440);
  ctx.strokeStyle = 'rgba(32,230,255,0.035)';
  ctx.lineWidth = 1;
  const step = 52;
  const startX = Math.floor((cam.x - view.w / 2 - 100) / step) * step;
  const endX = cam.x + view.w / 2 + 100;
  const startY = Math.floor((cam.y - view.h / 2 - 100) / step) * step;
  const endY = cam.y + view.h / 2 + 100;
  ctx.beginPath();
  for (let x = startX; x <= endX; x += step) {
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
  }
  for (let y = startY; y <= endY; y += step) {
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
  }
  ctx.stroke();
}

function drawRoads(ctx, game, view, cam) {
  ctx.fillStyle = COLORS.road;
  for (let index = 0; index <= GRID; index += 1) {
    const line = index * BLOCK;
    ctx.fillRect(line - ROAD / 2, 0, ROAD, WORLD_H);
    ctx.fillRect(0, line - ROAD / 2, WORLD_W, ROAD);
  }

  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let index = 0; index <= GRID; index += 1) {
    const line = index * BLOCK;
    ctx.moveTo(line - ROAD / 2, 0);
    ctx.lineTo(line - ROAD / 2, WORLD_H);
    ctx.moveTo(line + ROAD / 2, 0);
    ctx.lineTo(line + ROAD / 2, WORLD_H);
    ctx.moveTo(0, line - ROAD / 2);
    ctx.lineTo(WORLD_W, line - ROAD / 2);
    ctx.moveTo(0, line + ROAD / 2);
    ctx.lineTo(WORLD_W, line + ROAD / 2);
  }
  ctx.stroke();

  ctx.setLineDash([16, 18]);
  ctx.lineDashOffset = -(game.tick * 0.6) % 34;
  ctx.strokeStyle = 'rgba(32,230,255,0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let index = 0; index <= GRID; index += 1) {
    const line = index * BLOCK;
    ctx.moveTo(line, 0);
    ctx.lineTo(line, WORLD_H);
    ctx.moveTo(0, line);
    ctx.lineTo(WORLD_W, line);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(220,240,255,0.2)';
  for (let gy = 0; gy <= GRID; gy += 1) {
    for (let gx = 0; gx <= GRID; gx += 1) {
      const x = gx * BLOCK;
      const y = gy * BLOCK;
      if (!visible(x - ROAD, y - ROAD, ROAD * 2, ROAD * 2, cam, view)) continue;
      for (let stripe = -2; stripe <= 2; stripe += 1) {
        ctx.fillRect(x - 30 + stripe * 10, y - ROAD / 2 + 4, 5, 10);
        ctx.fillRect(x - 30 + stripe * 10, y + ROAD / 2 - 14, 5, 10);
      }
    }
  }
}

function drawBuildings(ctx, game, view, cam) {
  const buildings = game.world.buildings;
  for (let index = 0; index < buildings.length; index += 1) {
    const building = buildings[index];
    if (!visible(building.x, building.y, building.w, building.h, cam, view)) continue;

    ctx.fillStyle = '#0a0d1c';
    ctx.fillRect(building.x, building.y, building.w, building.h);
    const gradient = ctx.createLinearGradient(building.x, building.y, building.x + building.w, building.y + building.h);
    gradient.addColorStop(0, 'rgba(255,255,255,0.055)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = gradient;
    ctx.fillRect(building.x, building.y, building.w, building.h);

    const padX = 10;
    const padY = 10;
    const cellW = (building.w - padX * 2) / building.cols;
    const cellH = (building.h - padY * 2) / building.rows;
    for (let row = 0; row < building.rows; row += 1) {
      for (let col = 0; col < building.cols; col += 1) {
        if ((row * 7 + col * 13 + building.rows) % 5 === 0) continue;
        ctx.globalAlpha = 0.2 + ((row + col) % 3) * 0.12;
        ctx.fillStyle = building.color;
        ctx.fillRect(building.x + padX + col * cellW + 3, building.y + padY + row * cellH + 3, Math.max(4, cellW - 7), Math.max(4, cellH - 7));
      }
    }
    ctx.globalAlpha = 1;

    ctx.shadowColor = building.color;
    ctx.shadowBlur = 12 * building.glow;
    ctx.strokeStyle = building.color;
    ctx.globalAlpha = 0.68;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(building.x + 0.5, building.y + 0.5, building.w - 1, building.h - 1);
    ctx.shadowBlur = 0;

    ctx.font = '800 11px system-ui';
    ctx.fillStyle = building.color;
    if (building.signVertical) {
      ctx.save();
      ctx.translate(building.x + building.w - 7, building.y + 8);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = 'left';
      ctx.fillText(building.sign, 0, 0);
      ctx.restore();
    } else {
      ctx.textAlign = 'center';
      ctx.fillText(building.sign, building.x + building.w / 2, building.y + 14);
    }
    ctx.globalAlpha = 1;
  }
}

function drawCash(ctx, game, view, cam) {
  const pickups = game.world.cash;
  for (let index = 0; index < pickups.length; index += 1) {
    const pickup = pickups[index];
    if (pickup.taken || !visible(pickup.x - 16, pickup.y - 16, 32, 32, cam, view)) continue;
    const bob = Math.sin(game.tick * 0.07 + pickup.phase) * 3;
    ctx.save();
    ctx.translate(pickup.x, pickup.y + bob);
    ctx.rotate(Math.sin(game.tick * 0.03 + pickup.phase) * 0.12);
    ctx.shadowColor = COLORS.green;
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(8,28,22,0.92)';
    ctx.fillRect(-10, -12, 20, 24);
    ctx.strokeStyle = COLORS.green;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-10, -12, 20, 24);
    ctx.fillStyle = COLORS.green;
    ctx.font = '800 14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 5);
    ctx.restore();
  }
}

function drawCarShape(ctx, x, y, angle, color, glow, outline) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  rounded(ctx, -16, -9, 32, 18, 5);
  ctx.fill();
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 16;
  }
  ctx.fillStyle = color;
  rounded(ctx, -15, -8, 30, 16, 4);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(9,14,28,0.88)';
  rounded(ctx, -3, -6, 11, 12, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  rounded(ctx, -13, -6, 8, 3, 1);
  ctx.fill();
  ctx.fillStyle = '#fff4c2';
  ctx.fillRect(14, -6, 3, 3);
  ctx.fillRect(14, 3, 3, 3);
  ctx.fillStyle = '#ff3b4e';
  ctx.fillRect(-17, -6, 3, 3);
  ctx.fillRect(-17, 3, 3, 3);
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.6;
    rounded(ctx, -16, -9, 32, 18, 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVehicles(ctx, game, view, cam) {
  const traffic = game.world.traffic;
  for (let index = 0; index < traffic.length; index += 1) {
    const car = traffic[index];
    if (!visible(car.x - 20, car.y - 20, 40, 40, cam, view)) continue;
    if (car.stolen) drawCarShape(ctx, car.x, car.y, car.heading, car.color, COLORS.gold, COLORS.gold);
    else drawCarShape(ctx, car.x, car.y, car.heading, car.color, null, null);
  }
}

function drawPedestrians(ctx, game, view, cam) {
  const people = game.world.pedestrians;
  for (let index = 0; index < people.length; index += 1) {
    const person = people[index];
    if (!visible(person.x - 10, person.y - 10, 20, 20, cam, view)) continue;
    ctx.save();
    ctx.translate(person.x, person.y);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(0, 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = person.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = person.skin;
    ctx.beginPath();
    ctx.arc(0, -1, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPolice(ctx, game, view, cam) {
  const cars = game.police.cars;
  for (let index = 0; index < cars.length; index += 1) {
    const car = cars[index];
    if (!visible(car.x - 22, car.y - 22, 44, 44, cam, view)) continue;
    drawCarShape(ctx, car.x, car.y, car.heading, '#eef3ff', '#2b6bff', '#2b6bff');
    const bluePhase = Math.floor(game.tick / 6) % 2 === 0;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.heading);
    ctx.shadowColor = bluePhase ? '#ff2b4d' : '#2b6bff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = bluePhase ? '#ff2b4d' : '#2b6bff';
    ctx.fillRect(-4, -9, 8, 4);
    ctx.restore();
  }

  const officers = game.police.officers;
  for (let index = 0; index < officers.length; index += 1) {
    const officer = officers[index];
    if (!visible(officer.x - 12, officer.y - 12, 24, 24, cam, view)) continue;
    ctx.save();
    ctx.translate(officer.x, officer.y);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.arc(0, 4, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#173a8a';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd8a8';
    ctx.beginPath();
    ctx.arc(0, -2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9fd8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(officer.heading) * 10, Math.sin(officer.heading) * 10);
    ctx.stroke();
    ctx.restore();
  }
}

function drawShots(ctx, game) {
  ctx.save();
  for (let index = 0; index < game.shots.bullets.length; index += 1) {
    const bullet = game.shots.bullets[index];
    ctx.strokeStyle = bullet.color;
    ctx.lineWidth = 2.4;
    ctx.shadowColor = bullet.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(bullet.x, bullet.y);
    ctx.lineTo(bullet.x - bullet.vx * 0.016, bullet.y - bullet.vy * 0.016);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  for (let index = 0; index < game.shots.particles.length; index += 1) {
    const particle = game.shots.particles[index];
    ctx.globalAlpha = Math.min(1, particle.life / 0.5);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(ctx, game) {
  const player = game.player;
  if (!player) return;
  if (player.inCar && player.car) {
    drawCarShape(ctx, player.car.x, player.car.y, player.car.heading, COLORS.pink, COLORS.pink, COLORS.gold);
    return;
  }
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = player.hurt > 0 ? '#ff6b81' : COLORS.cyan;
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0b1020';
  ctx.beginPath();
  ctx.arc(2, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(6, -1);
  ctx.lineTo(19, -1);
  ctx.stroke();
  if (player.muzzle > 0) {
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.moveTo(18, -1);
    ctx.lineTo(30, -7);
    ctx.lineTo(26, -1);
    ctx.lineTo(30, 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function missionMetric(game, mission) {
  if (!mission) return 0;
  if (mission.kind === 'cash') return game.cashCollected;
  if (mission.kind === 'drive') return game.player.driveDistance;
  if (mission.kind === 'wanted') return game.player.wanted;
  if (mission.kind === 'evade') return game.player.evadedCount;
  if (mission.kind === 'bank') return game.player.cash;
  return 0;
}

function drawMinimap(ctx, game, view) {
  const size = 178;
  const x = 18;
  const y = view.h - 18 - size;
  panel(ctx, x - 4, y - 4, size + 8, size + 8, COLORS.cyan);
  ctx.save();
  rounded(ctx, x, y, size, size, 8);
  ctx.clip();
  ctx.fillStyle = '#070a16';
  ctx.fillRect(x, y, size, size);
  const scale = size / WORLD_W;

  ctx.fillStyle = 'rgba(32,230,255,0.16)';
  for (let index = 0; index <= GRID; index += 1) {
    const line = index * BLOCK * scale;
    ctx.fillRect(x + line - 1, y, 2, size);
    ctx.fillRect(x, y + line - 1, size, 2);
  }

  ctx.fillStyle = 'rgba(150,180,230,0.24)';
  for (let index = 0; index < game.world.buildings.length; index += 1) {
    const building = game.world.buildings[index];
    ctx.fillRect(x + building.x * scale, y + building.y * scale, Math.max(1, building.w * scale), Math.max(1, building.h * scale));
  }

  ctx.fillStyle = COLORS.green;
  for (let index = 0; index < game.world.cash.length; index += 1) {
    const pickup = game.world.cash[index];
    if (pickup.taken) continue;
    ctx.fillRect(x + pickup.x * scale - 1.5, y + pickup.y * scale - 1.5, 3, 3);
  }

  ctx.fillStyle = 'rgba(190,215,255,0.5)';
  for (let index = 0; index < game.world.traffic.length; index += 1) {
    const car = game.world.traffic[index];
    ctx.fillRect(x + car.x * scale - 1, y + car.y * scale - 1, 2, 2);
  }

  ctx.fillStyle = COLORS.red;
  for (let index = 0; index < game.police.cars.length; index += 1) {
    const car = game.police.cars[index];
    ctx.fillRect(x + car.x * scale - 2, y + car.y * scale - 2, 4, 4);
  }

  const player = game.player;
  ctx.fillStyle = COLORS.cyan;
  ctx.beginPath();
  ctx.arc(x + player.x * scale, y + player.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + player.x * scale, y + player.y * scale);
  ctx.lineTo(x + player.x * scale + Math.cos(player.angle) * 10, y + player.y * scale + Math.sin(player.angle) * 10);
  ctx.stroke();
  ctx.restore();
}

function drawHUD(ctx, game, view) {
  const player = game.player;
  if (!player) return;
  ctx.save();

  panel(ctx, 18, 18, 232, 66, COLORS.cyan);
  ctx.textAlign = 'left';
  ctx.font = '700 11px system-ui';
  ctx.fillStyle = '#8fb3cc';
  ctx.fillText('HEALTH', 34, 40);
  ctx.textAlign = 'right';
  ctx.font = '800 19px system-ui';
  ctx.fillStyle = player.health < 30 ? COLORS.red : '#eaf7ff';
  ctx.fillText(String(Math.max(0, Math.ceil(player.health))), 234, 42);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  rounded(ctx, 34, 50, 200, 10, 5);
  ctx.fill();
  ctx.fillStyle = player.health < 30 ? COLORS.red : COLORS.cyan;
  rounded(ctx, 34, 50, 200 * clamp01(player.health / 100), 10, 5);
  ctx.fill();

  panel(ctx, 18, 92, 232, 58, COLORS.gold);
  ctx.textAlign = 'left';
  ctx.font = '700 11px system-ui';
  ctx.fillStyle = '#8fb3cc';
  ctx.fillText('CASH', 34, 115);
  ctx.textAlign = 'right';
  ctx.font = '800 24px system-ui';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(money(player.cash), 234, 128);

  const rightX = view.w - 18 - 230;
  panel(ctx, rightX, 18, 230, 64, COLORS.pink);
  ctx.textAlign = 'left';
  ctx.font = '700 11px system-ui';
  ctx.fillStyle = '#8fb3cc';
  ctx.fillText('WANTED', rightX + 16, 40);
  for (let index = 0; index < 5; index += 1) {
    star(ctx, rightX + 30 + index * 38, 56, 10, 5, index < player.wanted ? COLORS.gold : 'rgba(255,255,255,0.14)');
  }

  const mission = MISSIONS[game.missionIndex];
  panel(ctx, rightX, 90, 230, 88, COLORS.cyan);
  ctx.textAlign = 'left';
  ctx.font = '700 10px system-ui';
  ctx.fillStyle = '#8fb3cc';
  ctx.fillText('ACTIVE CONTRACT', rightX + 16, 112);
  ctx.font = '800 15px system-ui';
  ctx.fillStyle = mission ? COLORS.gold : COLORS.green;
  ctx.fillText(mission ? mission.title : 'ALL CLEAR', rightX + 16, 136);
  ctx.font = '500 10px system-ui';
  ctx.fillStyle = '#9fb6d4';
  ctx.fillText(mission ? mission.desc : 'The city is yours.', rightX + 16, 154);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  rounded(ctx, rightX + 16, 162, 198, 6, 3);
  ctx.fill();
  ctx.fillStyle = COLORS.cyan;
  const progress = mission ? clamp01(missionMetric(game, mission) / mission.goal) : 1;
  rounded(ctx, rightX + 16, 162, 198 * progress, 6, 3);
  ctx.fill();

  drawMinimap(ctx, game, view);

  panel(ctx, rightX, view.h - 18 - 58, 230, 58, COLORS.gold);
  ctx.textAlign = 'left';
  ctx.font = '700 10px system-ui';
  ctx.fillStyle = '#8fb3cc';
  ctx.fillText('SCORE · ' + game.missionsDone + '/' + MISSIONS.length + ' CONTRACTS', rightX + 16, view.h - 52);
  ctx.textAlign = 'right';
  ctx.font = '800 20px system-ui';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(money(game.score), rightX + 214, view.h - 34);

  if (!game.deterministic && game.screen === 'play') {
    const px = game.pointer.x;
    const py = game.pointer.y;
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.moveTo(px - 16, py);
    ctx.lineTo(px - 12, py);
    ctx.moveTo(px + 12, py);
    ctx.lineTo(px + 16, py);
    ctx.moveTo(px, py - 16);
    ctx.lineTo(px, py - 12);
    ctx.moveTo(px, py + 12);
    ctx.lineTo(px, py + 16);
    ctx.stroke();
  }
  ctx.restore();
}

function drawToast(ctx, game, view) {
  if (game.toastTimer <= 0 || !game.toastText) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, game.toastTimer * 2);
  ctx.font = '800 15px system-ui';
  const width = Math.min(460, ctx.measureText(game.toastText).width + 56);
  panel(ctx, view.w / 2 - width / 2, 94, width, 38, COLORS.gold);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff4cf';
  ctx.fillText(game.toastText, view.w / 2, 119);
  ctx.restore();
}

function drawStartOverlay(ctx, game, view) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,5,14,0.82)';
  ctx.fillRect(0, 0, view.w, view.h);

  const titleGradient = ctx.createLinearGradient(0, view.h * 0.2, 0, view.h * 0.42);
  titleGradient.addColorStop(0, COLORS.cyan);
  titleGradient.addColorStop(0.52, '#ffffff');
  titleGradient.addColorStop(1, COLORS.pink);
  ctx.textAlign = 'center';
  ctx.font = '900 ' + Math.min(92, Math.floor(view.w / 13)) + 'px system-ui';
  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 30;
  ctx.fillStyle = titleGradient;
  ctx.fillText('NEON HUSTLE', view.w / 2, view.h * 0.36);
  ctx.shadowBlur = 0;
  ctx.font = '700 18px system-ui';
  ctx.fillStyle = COLORS.pink;
  ctx.fillText('OPEN-WORLD CRIME · MAKE.FUN GTA6-01', view.w / 2, view.h * 0.36 + 36);

  const cardWidth = Math.min(560, view.w - 60);
  const cardHeight = 190;
  const cardX = view.w / 2 - cardWidth / 2;
  const cardY = view.h * 0.51;
  panel(ctx, cardX, cardY, cardWidth, cardHeight, 'rgba(255,62,200,0.6)');
  const rows = [
    'W A S D / ARROWS   move · steer        SHIFT   sprint',
    'MOUSE   aim         CLICK   fire        R   reload',
    'SPACE / E   steal or leave a car        P   pause',
  ];
  ctx.font = '600 14px system-ui';
  ctx.fillStyle = '#c6d9ee';
  for (let index = 0; index < rows.length; index += 1) {
    ctx.fillText(rows[index], view.w / 2, cardY + 46 + index * 38);
  }

  if (Math.floor(game.tick / 30) % 2 === 0) {
    ctx.font = '800 22px system-ui';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText('PRESS ENTER TO HIT THE STREETS', view.w / 2, view.h * 0.88);
  }
  ctx.font = '600 12px system-ui';
  ctx.fillStyle = '#7b8fb5';
  ctx.fillText('BEST SCORE ' + money(game.save.high || 0) + '   ·   RUNS ' + (game.save.runs || 0), view.w / 2, view.h * 0.93);
  ctx.restore();
}

function drawEndOverlay(ctx, game, view) {
  ctx.save();
  ctx.fillStyle = 'rgba(3,5,13,0.78)';
  ctx.fillRect(0, 0, view.w, view.h);
  const won = game.endReason === 'legend';
  const accent = won ? COLORS.green : COLORS.red;
  const width = Math.min(520, view.w - 60);
  const height = 330;
  const x = view.w / 2 - width / 2;
  const y = view.h / 2 - height / 2;
  panel(ctx, x, y, width, height, accent);
  ctx.textAlign = 'center';
  ctx.font = '900 46px system-ui';
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 22;
  ctx.fillText(won ? 'CITY CONQUERED' : 'BUSTED', view.w / 2, y + 68);
  ctx.shadowBlur = 0;
  ctx.font = '600 13px system-ui';
  ctx.fillStyle = '#9fb6d4';
  ctx.fillText(won ? 'Every contract closed. The neon crown is yours.' : 'The crew scattered. The streets remember.', view.w / 2, y + 98);

  const stats = [
    ['BANKED CASH', money(game.player.cash)],
    ['CONTRACTS', game.missionsDone + ' / ' + MISSIONS.length],
    ['TOP WANTED', game.maxWanted + ' STARS'],
    ['BUNDLES GRABBED', String(game.cashCollected)],
    ['FINAL SCORE', money(game.score)],
  ];
  ctx.font = '700 15px system-ui';
  for (let index = 0; index < stats.length; index += 1) {
    const lineY = y + 140 + index * 32;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8fb3cc';
    ctx.fillText(stats[index][0], x + 40, lineY);
    ctx.textAlign = 'right';
    ctx.fillStyle = index === stats.length - 1 ? COLORS.gold : '#eaf7ff';
    ctx.fillText(stats[index][1], x + width - 40, lineY);
  }

  ctx.textAlign = 'center';
  ctx.font = '800 18px system-ui';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText('PRESS R TO RUN IT BACK', view.w / 2, y + height - 22);
  ctx.restore();
}

function drawShotLabel(ctx, game, view) {
  const label = game.label;
  if (!label) return;
  ctx.save();
  ctx.fillStyle = 'rgba(3,5,12,0.9)';
  ctx.fillRect(0, 0, view.w, 58);
  ctx.fillRect(0, view.h - 72, view.w, 72);
  ctx.fillStyle = COLORS.cyan;
  ctx.fillRect(0, 56, view.w, 2);
  ctx.fillRect(0, view.h - 74, view.w, 2);
  ctx.textAlign = 'left';
  ctx.font = '800 21px system-ui';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('NEON HUSTLE · ' + label.scene, 24, 37);
  ctx.textAlign = 'right';
  ctx.font = '700 15px system-ui';
  ctx.fillStyle = COLORS.cyan;
  ctx.fillText(label.tag + '  ·  SEED ' + label.seed, view.w - 24, 36);
  ctx.textAlign = 'left';
  ctx.font = '600 17px system-ui';
  ctx.fillStyle = '#e8f6ff';
  ctx.fillText(label.caption, 24, view.h - 38);
  ctx.font = '500 12px system-ui';
  ctx.fillStyle = '#7b8fb5';
  ctx.fillText('make.fun / SuCriss / makefun-gta6-01', 24, view.h - 16);
  ctx.restore();
}

export function renderScene(ctx, game, view) {
  ctx.save();
  ctx.clearRect(0, 0, view.w, view.h);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, view.w, view.h);

  const cam = game.camera;
  const shakeX = Math.sin(game.tick * 12.7) * game.shake * 0.5;
  const shakeY = Math.cos(game.tick * 9.3) * game.shake * 0.5;
  ctx.save();
  ctx.translate(view.w / 2 - cam.x + shakeX, view.h / 2 - cam.y + shakeY);
  drawGround(ctx, game, view, cam);
  drawRoads(ctx, game, view, cam);
  drawBuildings(ctx, game, view, cam);
  drawCash(ctx, game, view, cam);
  drawPedestrians(ctx, game, view, cam);
  drawVehicles(ctx, game, view, cam);
  drawPolice(ctx, game, view, cam);
  drawShots(ctx, game);
  drawPlayer(ctx, game);
  ctx.restore();

  drawHUD(ctx, game, view);
  drawToast(ctx, game, view);
  if (game.screen === 'start') drawStartOverlay(ctx, game, view);
  if (game.screen === 'end') drawEndOverlay(ctx, game, view);
  drawShotLabel(ctx, game, view);
  ctx.restore();
}
