import { CITY, carAngle } from "./world.js";
import { playerPosition } from "./player.js";

const VIEW_W = 1280;
const VIEW_H = 720;

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function glow(ctx, hue, blur, draw) {
  ctx.save();
  ctx.shadowColor = "hsla(" + hue + ",100%,65%,0.9)";
  ctx.shadowBlur = blur;
  draw();
  ctx.restore();
}

function inView(x, y, cam, margin) {
  return x > cam.x - margin && y > cam.y - margin && x < cam.x + VIEW_W + margin && y < cam.y + VIEW_H + margin;
}

function drawGround(ctx, cam) {
  ctx.fillStyle = "#050811";
  ctx.fillRect(cam.x - 100, cam.y - 100, VIEW_W + 200, VIEW_H + 200);
}

function drawRoads(ctx, cam) {
  const step = CITY.block;
  const half = CITY.road * 0.5;
  const fromX = Math.max(0, Math.floor((cam.x - step) / step));
  const toX = Math.min(Math.ceil(CITY.width / step), Math.ceil((cam.x + VIEW_W + step) / step));
  const fromY = Math.max(0, Math.floor((cam.y - step) / step));
  const toY = Math.min(Math.ceil(CITY.height / step), Math.ceil((cam.y + VIEW_H + step) / step));

  for (let ix = fromX; ix <= toX; ix += 1) {
    const x = ix * step - half;
    ctx.fillStyle = "#11172b";
    ctx.fillRect(x, cam.y - 100, CITY.road, VIEW_H + 200);
    ctx.fillStyle = "rgba(57,246,255,0.10)";
    ctx.fillRect(x, cam.y - 100, 2, VIEW_H + 200);
    ctx.fillRect(x + CITY.road - 2, cam.y - 100, 2, VIEW_H + 200);
    ctx.fillStyle = "rgba(255,209,102,0.28)";
    for (let y = Math.floor((cam.y - 100) / 48) * 48; y < cam.y + VIEW_H + 100; y += 48) {
      ctx.fillRect(x + CITY.road * 0.5 - 1, y, 2, 18);
    }
  }

  for (let iy = fromY; iy <= toY; iy += 1) {
    const y = iy * step - half;
    ctx.fillStyle = "#11172b";
    ctx.fillRect(cam.x - 100, y, VIEW_W + 200, CITY.road);
    ctx.fillStyle = "rgba(255,62,165,0.09)";
    ctx.fillRect(cam.x - 100, y, VIEW_W + 200, 2);
    ctx.fillRect(cam.x - 100, y + CITY.road - 2, VIEW_W + 200, 2);
    ctx.fillStyle = "rgba(255,209,102,0.28)";
    for (let x = Math.floor((cam.x - 100) / 48) * 48; x < cam.x + VIEW_W + 100; x += 48) {
      ctx.fillRect(x, y + CITY.road * 0.5 - 1, 18, 2);
    }
  }
}

function drawCityBlocks(ctx, world, cam, tick) {
  const step = CITY.block;
  for (const plaza of world.plazas) {
    if (!inView(plaza.x, plaza.y, cam, plaza.w)) continue;
    ctx.fillStyle = "rgba(24,64,58,0.55)";
    ctx.fillRect(plaza.x, plaza.y, plaza.w, plaza.h);
    ctx.strokeStyle = "hsla(" + plaza.hue + ",90%,55%,0.28)";
    ctx.lineWidth = 1;
    ctx.strokeRect(plaza.x + 8, plaza.y + 8, plaza.w - 16, plaza.h - 16);
    ctx.beginPath();
    ctx.arc(plaza.x + plaza.w * 0.5, plaza.y + plaza.h * 0.5, 18 + Math.sin(tick + plaza.x) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const building of world.buildings) {
    if (!inView(building.x, building.y, cam, building.w + 20)) continue;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(building.x + 9, building.y + 11, building.w, building.h);
    const surface = ctx.createLinearGradient(building.x, building.y, building.x + building.w, building.y + building.h);
    surface.addColorStop(0, "hsl(" + building.hue + ",48%,16%)");
    surface.addColorStop(1, "#080c19");
    ctx.fillStyle = surface;
    ctx.fillRect(building.x, building.y, building.w, building.h);
    ctx.strokeStyle = "hsla(" + building.hue + ",100%,66%,0.82)";
    ctx.lineWidth = 2;
    ctx.strokeRect(building.x + 1, building.y + 1, building.w - 2, building.h - 2);

    const pad = 9;
    const innerW = Math.max(0, building.w - pad * 2);
    const innerH = Math.max(0, building.h - pad * 2);
    const cellW = innerW / building.cols;
    const cellH = innerH / building.rows;
    for (let row = 0; row < building.rows; row += 1) {
      for (let col = 0; col < building.cols; col += 1) {
        const lit = (row * 13 + col * 7 + building.seed) % 6 < 3;
        ctx.fillStyle = lit ? "hsla(" + building.hue + ",100%,74%,0.55)" : "rgba(4,8,18,0.85)";
        ctx.fillRect(building.x + pad + col * cellW + 2, building.y + pad + row * cellH + 2, Math.max(2, cellW - 5), Math.max(2, cellH - 5));
      }
    }

    if (building.sign && building.w > 70) {
      ctx.save();
      ctx.font = "bold 11px 'Segoe UI', sans-serif";
      const textWidth = ctx.measureText(building.sign).width;
      const sx = building.x + building.w * 0.5 - textWidth * 0.5 - 8;
      const sy = building.y + building.h * 0.5 - 10;
      glow(ctx, building.hue, 12, () => {
        ctx.fillStyle = "rgba(4,8,18,0.9)";
        ctx.fillRect(sx, sy, textWidth + 16, 20);
        ctx.strokeStyle = "hsla(" + building.hue + ",100%,70%,0.9)";
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, sy, textWidth + 16, 20);
        ctx.fillStyle = "hsl(" + building.hue + ",100%,78%)";
        ctx.fillText(building.sign, sx + 8, sy + 14);
      });
      ctx.restore();
    }
  }

  for (const light of world.lights) {
    if (!inView(light.x, light.y, cam, 40)) continue;
    const pulse = 0.6 + 0.4 * Math.sin(tick * 2 + light.x * 0.01);
    glow(ctx, light.hue, 14, () => {
      ctx.fillStyle = "hsla(" + light.hue + ",100%,75%," + (0.45 + pulse * 0.35) + ")";
      ctx.fillRect(light.x - 2, light.y - 2, 4, 4);
    });
  }
}

function drawPickups(ctx, world, cam, tick) {
  for (const drop of world.pickups) {
    if (drop.taken || !inView(drop.x, drop.y, cam, 40)) continue;
    const bob = Math.sin(tick * 3 + drop.phase) * 4;
    const y = drop.y + bob;
    ctx.save();
    ctx.translate(drop.x, y);
    glow(ctx, 42, 16, () => {
      ctx.rotate(Math.PI * 0.25);
      ctx.fillStyle = "rgba(255,209,102,0.22)";
      ctx.fillRect(-13, -13, 26, 26);
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 2;
      ctx.strokeRect(-13, -13, 26, 26);
    });
    ctx.rotate(-Math.PI * 0.25);
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff2c2";
    ctx.fillText("$", 0, 5);
    ctx.restore();
  }
}

function drawMissionMarker(ctx, state) {
  const mission = state.world.missions[state.missionIndex];
  if (!mission) return;
  const cam = state.camera;
  if (!inView(mission.x, mission.y, cam, 80)) return;
  const pulse = 1 + Math.sin(state.tick * 3) * 0.12;
  ctx.save();
  glow(ctx, 42, 18, () => {
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mission.x, mission.y, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.fillStyle = "rgba(255,209,102,0.12)";
  ctx.fillRect(mission.x - 7, mission.y - 30, 14, 14);
  ctx.font = "bold 10px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd166";
  ctx.fillText("OBJECTIVE", mission.x, mission.y - 38);
  ctx.restore();
}

function drawVehicleShape(ctx, x, y, angle, hue, kind, police) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const length = kind === "sport" ? 52 : 46;
  const width = kind === "sport" ? 25 : 27;

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundRect(ctx, -length * 0.5 + 5, -width * 0.5 + 7, length, width, 9);
  ctx.fill();

  const body = ctx.createLinearGradient(-length * 0.5, 0, length * 0.5, 0);
  if (police) {
    body.addColorStop(0, "#e8f4ff");
    body.addColorStop(0.5, "#9fb4d4");
    body.addColorStop(1, "#e8f4ff");
  } else {
    body.addColorStop(0, "hsl(" + hue + ",70%,22%)");
    body.addColorStop(0.55, "hsl(" + hue + ",75%,38%)");
    body.addColorStop(1, "hsl(" + hue + ",70%,20%)");
  }
  glow(ctx, hue, 10, () => {
    ctx.fillStyle = body;
    roundRect(ctx, -length * 0.5, -width * 0.5, length, width, 9);
    ctx.fill();
    ctx.strokeStyle = "hsla(" + hue + ",100%,72%,0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  ctx.fillStyle = "rgba(8,16,32,0.9)";
  roundRect(ctx, -length * 0.08, -width * 0.5 + 4, length * 0.34, width - 8, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(120,200,255,0.25)";
  ctx.fillRect(-length * 0.08 + 2, -width * 0.5 + 6, length * 0.3, 3);

  ctx.fillStyle = "#fff5bf";
  ctx.fillRect(length * 0.5 - 4, -width * 0.5 + 3, 4, 6);
  ctx.fillRect(length * 0.5 - 4, width * 0.5 - 9, 4, 6);
  ctx.fillStyle = "#ff3b5c";
  ctx.fillRect(-length * 0.5, -width * 0.5 + 3, 3, 6);
  ctx.fillRect(-length * 0.5, width * 0.5 - 9, 3, 6);

  if (police) {
    const flash = Math.floor(stateTick * 7) % 2;
    glow(ctx, flash ? 350 : 210, 18, () => {
      ctx.fillStyle = flash ? "#ff2d55" : "#39a8ff";
      ctx.fillRect(-6, -5, 12, 10);
    });
  }
  ctx.restore();
}

let stateTick = 0;

function drawTraffic(ctx, state) {
  const cam = state.camera;
  for (const car of state.world.traffic) {
    if (!inView(car.x, car.y, cam, 60)) continue;
    drawVehicleShape(ctx, car.x, car.y, carAngle(car), car.hue, car.kind, false);
  }
}

function drawPolice(ctx, state) {
  const cam = state.camera;
  for (const officer of state.police) {
    if (!inView(officer.x, officer.y, cam, 70)) continue;
    drawVehicleShape(ctx, officer.x, officer.y, officer.angle, officer.hue, "sport", true);
  }
}

function drawPedestrians(ctx, state) {
  const cam = state.camera;
  for (const person of state.world.pedestrians) {
    if (!inView(person.x, person.y, cam, 20)) continue;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(person.x + 2, person.y + 3, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    glow(ctx, person.hue, 7, () => {
      ctx.fillStyle = "hsl(" + person.hue + ",80%,58%)";
      ctx.beginPath();
      ctx.arc(person.x, person.y, person.height * 0.7, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(person.x, person.y);
    ctx.lineTo(person.x + Math.cos(person.angle) * 7, person.y + Math.sin(person.angle) * 7);
    ctx.stroke();
  }
}

function drawPlayer(ctx, state) {
  const player = state.player;
  if (player.vehicle) {
    drawVehicleShape(ctx, player.vehicle.x, player.vehicle.y, player.vehicle.angle, 186, player.vehicle.kind, false);
    ctx.fillStyle = "rgba(57,246,255,0.5)";
    ctx.font = "bold 10px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("YOU", player.vehicle.x, player.vehicle.y - 30);
    return;
  }
  if (player.dashFx > 0) {
    ctx.strokeStyle = "rgba(57,246,255," + (player.dashFx / 0.22) + ")";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 16 + (0.22 - player.dashFx) * 40, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(player.x + 3, player.y + 5, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  glow(ctx, 186, 14, () => {
    ctx.fillStyle = "#39f6ff";
    ctx.beginPath();
    ctx.arc(player.x, player.y, 10, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = "#ff3ea5";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(player.x + Math.cos(player.aim) * 8, player.y + Math.sin(player.aim) * 8);
  ctx.lineTo(player.x + Math.cos(player.aim) * 24, player.y + Math.sin(player.aim) * 24);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(player.x, player.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawProjectiles(ctx, state) {
  for (const shot of state.projectiles) {
    ctx.save();
    glow(ctx, shot.hue, 12, () => {
      ctx.strokeStyle = "hsl(" + shot.hue + ",100%,72%)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(shot.px, shot.py);
      ctx.lineTo(shot.x, shot.y);
      ctx.stroke();
    });
    ctx.restore();
  }
}

function drawParticles(ctx, state) {
  for (const particle of state.particles) {
    const alpha = Math.max(0, particle.life / particle.max);
    ctx.fillStyle = "hsla(" + particle.hue + ",100%,70%, " + alpha + ")";
    ctx.fillRect(particle.x - particle.size * 0.5, particle.y - particle.size * 0.5, particle.size, particle.size);
  }
}

function drawVignette(ctx) {
  const gradient = ctx.createRadialGradient(VIEW_W * 0.5, VIEW_H * 0.5, VIEW_H * 0.28, VIEW_W * 0.5, VIEW_H * 0.5, VIEW_H * 0.86);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.62)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = "rgba(120,200,255,0.025)";
  for (let y = 0; y < VIEW_H; y += 4) ctx.fillRect(0, y, VIEW_W, 1);
}

function drawShotTag(ctx, state) {
  if (!state.shot) return;
  ctx.save();
  ctx.font = "bold 11px 'Segoe UI', sans-serif";
  ctx.fillStyle = "rgba(57,246,255,0.8)";
  ctx.textAlign = "left";
  ctx.fillText("NEON HUSTLE // SHOT: " + state.shot.toUpperCase() + " // SEED " + state.world.seed, 18, VIEW_H - 18);
  ctx.fillStyle = "rgba(255,62,165,0.85)";
  ctx.beginPath();
  ctx.arc(VIEW_W - 24, VIEW_H - 22, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.textAlign = "right";
  ctx.fillText("LIVE CAPTURE", VIEW_W - 36, VIEW_H - 18);
  ctx.restore();
}

export function renderScene(ctx, state) {
  stateTick = state.tick || 0;
  const cam = state.camera;
  ctx.save();
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawGround(ctx, cam);
  ctx.translate(-cam.x, -cam.y);
  drawRoads(ctx, cam);
  drawCityBlocks(ctx, state.world, cam, stateTick);
  drawPickups(ctx, state.world, cam, stateTick);
  drawMissionMarker(ctx, state);
  drawPedestrians(ctx, state);
  drawTraffic(ctx, state);
  drawPolice(ctx, state);
  drawPlayer(ctx, state);
  drawProjectiles(ctx, state);
  drawParticles(ctx, state);
  ctx.restore();
  drawVignette(ctx);
  drawShotTag(ctx, state);
}

export function renderMinimap(ctx, state) {
  const size = 180;
  const scale = size / Math.max(state.world.width, state.world.height);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#04060e";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(57,246,255,0.22)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= state.world.width; x += CITY.block) {
    ctx.beginPath();
    ctx.moveTo(x * scale, 0);
    ctx.lineTo(x * scale, size);
    ctx.stroke();
  }
  for (let y = 0; y <= state.world.height; y += CITY.block) {
    ctx.beginPath();
    ctx.moveTo(0, y * scale);
    ctx.lineTo(size, y * scale);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(120,150,200,0.2)";
  for (const building of state.world.buildings) {
    ctx.fillRect(building.x * scale, building.y * scale, Math.max(1, building.w * scale), Math.max(1, building.h * scale));
  }

  ctx.fillStyle = "#ffd166";
  for (const drop of state.world.pickups) {
    if (drop.taken) continue;
    ctx.fillRect(drop.x * scale - 1.5, drop.y * scale - 1.5, 3, 3);
  }

  const mission = state.world.missions[state.missionIndex];
  if (mission) {
    ctx.strokeStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(mission.x * scale, mission.y * scale, 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#ff3b5c";
  for (const officer of state.police) {
    ctx.beginPath();
    ctx.arc(officer.x * scale, officer.y * scale, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const me = playerPosition(state.player);
  ctx.save();
  ctx.shadowColor = "#39f6ff";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#39f6ff";
  ctx.beginPath();
  ctx.arc(me.x * scale, me.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
