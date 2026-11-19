const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

function money(value) {
  const text = String(Math.floor(value));
  return text.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function neonText(ctx, text, x, y, size, color, align = "left", weight = "700") {
  ctx.save();
  ctx.font = weight + " " + size + "px " + FONT;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawBackdrop(ctx, w, h) {
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, "#070a18");
  wash.addColorStop(0.55, "#0b0f20");
  wash.addColorStop(1, "#140a1d");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(90,130,200,0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
  }
}

function drawRoads(ctx, world, cam, w, h) {
  const t = world.tile;
  const x0 = Math.max(0, Math.floor(cam.x / t) - 1);
  const x1 = Math.min(world.cols - 1, Math.ceil((cam.x + w) / t) + 1);
  const y0 = Math.max(0, Math.floor(cam.y / t) - 1);
  const y1 = Math.min(world.rows - 1, Math.ceil((cam.y + h) / t) + 1);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx % 4 !== 0 && ty % 4 !== 0) continue;
      const sx = tx * t - cam.x;
      const sy = ty * t - cam.y;
      ctx.fillStyle = "#0e1424";
      ctx.fillRect(sx, sy, t, t);
      ctx.fillStyle = "rgba(130,170,230,0.11)";
      if (tx % 4 === 0) ctx.fillRect(sx + t / 2 - 1, sy, 2, t);
      if (ty % 4 === 0) ctx.fillRect(sx, sy + t / 2 - 1, t, 2);
      ctx.strokeStyle = "rgba(40,231,255,0.06)";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 0.5, sy + 0.5, t - 1, t - 1);
    }
  }
}

function drawBuildings(ctx, world, cam, w, h) {
  for (const b of world.buildings) {
    const sx = b.x - cam.x;
    const sy = b.y - cam.y;
    if (sx > w + 40 || sy > h + 40 || sx + b.w < -40 || sy + b.h < -40) continue;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(sx + 4, sy + 6, b.w, b.h);
    ctx.fillStyle = b.facade;
    ctx.fillRect(sx, sy, b.w, b.h);
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = b.neon;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, sy + 1, b.w - 2, b.h - 2);
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = b.neon;
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        if ((i * 7 + j * 13 + b.variant * 29) % 5 < 2) {
          ctx.fillRect(sx + 10 + i * 16, sy + 10 + j * 16, 6, 5);
        }
      }
    }
    ctx.globalAlpha = 1;
    if (b.variant === 2) {
      ctx.font = "700 11px " + FONT;
      ctx.fillStyle = b.neon;
      ctx.globalAlpha = 0.85;
      ctx.fillText("NH", sx + 8, sy + b.h - 9);
      ctx.globalAlpha = 1;
    }
  }
}

function drawProps(ctx, world, cam, w, h) {
  for (const p of world.props) {
    const sx = p.x - cam.x;
    const sy = p.y - cam.y;
    if (sx < -30 || sy < -30 || sx > w + 30 || sy > h + 30) continue;
    ctx.strokeStyle = p.neon;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 2;
    if (p.kind === "billboard") {
      ctx.strokeRect(sx - 12, sy - 8, 24, 16);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = p.neon;
      ctx.fillRect(sx - 10, sy - 6, 20, 12);
    } else {
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawCash(ctx, state, cam, w, h) {
  for (const c of state.world.cash) {
    if (c.taken) continue;
    const sx = c.x - cam.x;
    const sy = c.y - cam.y;
    if (sx < -30 || sy < -30 || sx > w + 30 || sy > h + 30) continue;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#0d2b22";
    ctx.strokeStyle = "#45ffb0";
    ctx.lineWidth = 2;
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.restore();
    ctx.font = "700 10px " + FONT;
    ctx.fillStyle = "#45ffb0";
    ctx.textAlign = "center";
    ctx.fillText("$", sx, sy + 3);
  }
}

function drawCar(ctx, car, cam, isPolice) {
  const sx = car.x - cam.x;
  const sy = car.y - cam.y;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(car.angle);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, -16, -9, 34, 20, 6);
  ctx.fill();
  if (isPolice) {
    ctx.fillStyle = "#f2f5ff";
    roundRect(ctx, -17, -10, 34, 20, 5);
    ctx.fill();
    ctx.fillStyle = "#10162a";
    ctx.fillRect(-4, -10, 8, 20);
    ctx.fillStyle = car.siren ? "#ff2d6f" : "#28e7ff";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 16;
    ctx.fillRect(-3, -13, 6, 5);
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = car.color || "#ff3d9a";
    roundRect(ctx, -16, -9, 32, 18, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(10,18,34,0.9)";
    roundRect(ctx, -6, -7, 12, 14, 3);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(9, -7, 4, 14);
  }
  ctx.restore();
}

function drawPerson(ctx, p, cam) {
  const sx = p.x - cam.x;
  const sy = p.y - cam.y;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(2, 3, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(0, -2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, state, cam) {
  const p = state.player;
  const sx = p.x - cam.x;
  const sy = p.y - cam.y;
  if (p.inCar) {
    drawCar(ctx, { x: p.x, y: p.y, angle: p.angle, color: "#ff3d9a" }, cam, false);
    ctx.fillStyle = "#ffd45e";
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(2, 4, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#182238";
    roundRect(ctx, -7, -7, 14, 14, 4);
    ctx.fill();
    ctx.strokeStyle = "#ff3d9a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ffcf9e";
    ctx.beginPath();
    ctx.arc(2, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#28e7ff";
    ctx.fillRect(9, -2, 13, 4);
    ctx.restore();
  }
}

function drawShots(ctx, shots, cam) {
  ctx.lineCap = "round";
  for (const s of shots) {
    const sx = s.x - cam.x;
    const sy = s.y - cam.y;
    ctx.strokeStyle = s.friendly ? "#ffe27a" : "#ff5470";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - s.vx * 0.02, sy - s.vy * 0.02);
    ctx.stroke();
  }
}

function bar(ctx, x, y, w, h, value, maximum, color, label) {
  ctx.fillStyle = "rgba(6,10,20,0.72)";
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,160,220,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
  const pct = Math.max(0, Math.min(1, value / maximum));
  if (pct > 0) {
    ctx.fillStyle = color;
    roundRect(ctx, x + 2, y + 2, (w - 4) * pct, h - 4, 4);
    ctx.fill();
  }
  ctx.font = "700 10px " + FONT;
  ctx.fillStyle = "#e6f0ff";
  ctx.textAlign = "left";
  ctx.fillText(label, x + 8, y + h / 2 + 1);
}

function star(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = "#ffd45e";
    ctx.shadowColor = "#ffd45e";
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.strokeStyle = "rgba(255,212,94,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawMinimap(ctx, state, x, y, size) {
  ctx.save();
  ctx.fillStyle = "rgba(4,8,16,0.82)";
  roundRect(ctx, x, y, size, size, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,231,255,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  roundRect(ctx, x + 2, y + 2, size - 4, size - 4, 8);
  ctx.clip();
  ctx.translate(x, y);
  const scale = size / state.world.width;
  ctx.fillStyle = "rgba(20,32,56,0.9)";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "rgba(90,130,190,0.22)";
  for (let ty = 0; ty < state.world.rows; ty += 4) {
    ctx.fillRect(0, ty * state.world.tile * scale, size, 2);
  }
  for (let tx = 0; tx < state.world.cols; tx += 4) {
    ctx.fillRect(tx * state.world.tile * scale, 0, 2, size);
  }
  const dot = (wx, wy, color, radius) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(wx * scale, wy * scale, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const c of state.world.cash) if (!c.taken) dot(c.x, c.y, "#45ffb0", 1.6);
  for (const c of state.cars) dot(c.x, c.y, "#5f7fb0", 1.4);
  for (const u of state.police) dot(u.x, u.y, "#ff5470", 2.2);
  dot(state.player.x, state.player.y, "#28e7ff", 3.4);
  ctx.restore();
}

function drawHud(ctx, state, w, h) {
  const p = state.player;
  ctx.save();
  ctx.fillStyle = "rgba(5,9,18,0.62)";
  roundRect(ctx, 16, 16, 214, 86, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,231,255,0.18)";
  ctx.lineWidth = 1;
  ctx.stroke();
  neonText(ctx, "NEON HUSTLE", 28, 34, 14, "#28e7ff", "left", "800");
  bar(ctx, 28, 48, 190, 12, p.health, 100, "#ff3d6e", "HP " + Math.round(p.health));
  bar(ctx, 28, 66, 190, 12, p.armor, 100, "#7b61ff", "AR " + Math.round(p.armor));
  ctx.font = "700 13px " + FONT;
  ctx.fillStyle = "#45ffb0";
  ctx.textAlign = "left";
  ctx.fillText("$ " + money(p.cash), 28, 91);

  const mission = state.world.missions[state.missionIndex % state.world.missions.length];
  ctx.fillStyle = "rgba(5,9,18,0.72)";
  roundRect(ctx, w / 2 - 178, 16, 356, 46, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,61,154,0.35)";
  ctx.stroke();
  ctx.font = "700 11px " + FONT;
  ctx.fillStyle = "#ff3d9a";
  ctx.textAlign = "center";
  ctx.fillText("ACTIVE CONTRACT", w / 2, 30);
  ctx.font = "800 14px " + FONT;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(mission.title + "  ·  " + mission.desc, w / 2, 49);

  drawMinimap(ctx, state, w - 176, 16, 160);
  for (let i = 0; i < 5; i++) star(ctx, w - 140 + i * 22, 190, 8, i < p.wanted);

  ctx.fillStyle = "rgba(5,9,18,0.66)";
  roundRect(ctx, 16, h - 70, 200, 54, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,212,94,0.25)";
  ctx.stroke();
  ctx.font = "700 11px " + FONT;
  ctx.fillStyle = "#ffd45e";
  ctx.textAlign = "left";
  ctx.fillText("PISTOL", 28, h - 49);
  ctx.font = "800 18px " + FONT;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(String(p.ammo), 28, h - 27);
  ctx.font = "700 11px " + FONT;
  ctx.fillStyle = "#28e7ff";
  ctx.textAlign = "right";
  ctx.fillText((p.inCar ? "CAR " : "FOOT ") + Math.round(Math.abs(p.speed) * 18) + " KM/H", 204, h - 27);

  if (state.prompt) {
    ctx.font = "700 13px " + FONT;
    ctx.textAlign = "center";
    const tw = ctx.measureText(state.prompt).width + 28;
    ctx.fillStyle = "rgba(5,9,18,0.75)";
    roundRect(ctx, w / 2 - tw / 2, h - 46, tw, 30, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,212,94,0.4)";
    ctx.stroke();
    ctx.fillStyle = "#ffd45e";
    ctx.fillText(state.prompt, w / 2, h - 27);
  }
  ctx.restore();
}

export function renderScene(ctx, state, w, h, options = {}) {
  const cam = state.camera || { x: state.player.x - w / 2, y: state.player.y - h / 2 };
  drawBackdrop(ctx, w, h);
  drawRoads(ctx, state.world, cam, w, h);
  drawBuildings(ctx, state.world, cam, w, h);
  drawProps(ctx, state.world, cam, w, h);
  drawCash(ctx, state, cam, w, h);
  for (const c of state.cars) if (c.kind !== "police") drawCar(ctx, c, cam, false);
  for (const u of state.police) drawCar(ctx, u, cam, true);
  for (const p of state.people) drawPerson(ctx, p, cam);
  drawPlayer(ctx, state, cam);
  drawShots(ctx, state.shots, cam);
  if (!options.noHud) drawHud(ctx, state, w, h);
  if (options.label) {
    ctx.save();
    ctx.font = "800 12px " + FONT;
    ctx.textAlign = "left";
    const tw = ctx.measureText(options.label).width + 20;
    ctx.fillStyle = "rgba(3,6,14,0.78)";
    roundRect(ctx, 16, h - 26, tw, 20, 5);
    ctx.fill();
    ctx.fillStyle = "#ff3d9a";
    ctx.fillText(options.label, 26, h - 12);
    ctx.restore();
  }
}

export function renderStart(ctx, state, w, h) {
  renderScene(ctx, state, w, h, { noHud: true });
  ctx.fillStyle = "rgba(3,6,14,0.72)";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(40,231,255,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(w / 2 - 300, h / 2 - 190, 600, 380);
  neonText(ctx, "NEON", w / 2, h / 2 - 118, 72, "#ff3d9a", "center", "900");
  neonText(ctx, "HUSTLE", w / 2, h / 2 - 46, 72, "#28e7ff", "center", "900");
  ctx.font = "700 14px " + FONT;
  ctx.textAlign = "center";
  ctx.fillStyle = "#c9d8f5";
  ctx.fillText("STEAL. DRIVE. SHOOT. SURVIVE.", w / 2, h / 2 + 4);
  ctx.fillStyle = "rgba(10,16,30,0.85)";
  roundRect(ctx, w / 2 - 230, h / 2 + 32, 460, 120, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,61,154,0.35)";
  ctx.stroke();
  ctx.font = "700 12px " + FONT;
  ctx.fillStyle = "#45ffb0";
  ctx.fillText("WASD / ARROWS  DRIVE     MOUSE  AIM     CLICK / SPACE  FIRE", w / 2, h / 2 + 56);
  ctx.fillStyle = "#ffd45e";
  ctx.fillText("E  STEAL OR EXIT CAR     SHIFT  BOOST     ENTER  START", w / 2, h / 2 + 82);
  ctx.fillStyle = "#8fa6cc";
  ctx.fillText("Complete contracts, dodge the cops, bank the cash.", w / 2, h / 2 + 108);
  neonText(ctx, "PRESS ENTER TO START", w / 2, h / 2 + 164, 20, "#ffd45e", "center", "800");
}

export function renderEnd(ctx, state, w, h) {
  renderScene(ctx, state, w, h, { noHud: true });
  ctx.fillStyle = "rgba(3,6,14,0.78)";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(8,13,26,0.94)";
  roundRect(ctx, w / 2 - 270, h / 2 - 180, 540, 360, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(69,255,176,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  const cleared = state.endReason !== "busted" && state.player.alive;
  neonText(ctx, cleared ? "CONTRACT COMPLETE" : "BUSTED", w / 2, h / 2 - 126, 40,
    cleared ? "#45ffb0" : "#ff3d6e", "center", "900");
  ctx.font = "700 13px " + FONT;
  ctx.textAlign = "center";
  ctx.fillStyle = "#9fb4d8";
  ctx.fillText("SHIFT REPORT  ·  NIGHT 01", w / 2, h / 2 - 94);
  const rows = [
    ["CASH BANKED", "$" + money(state.player.cash)],
    ["DROPS COLLECTED", String(state.player.collected)],
    ["CARS DELIVERED", String(state.player.delivered)],
    ["WANTED PEAK", state.peakWanted + " STARS"],
    ["DISTANCE", Math.round(state.player.distance / 10) + " BLOCKS"]
  ];
  for (let i = 0; i < rows.length; i++) {
    const y = h / 2 - 56 + i * 34;
    ctx.textAlign = "left";
    ctx.fillStyle = "#8fa6cc";
    ctx.font = "700 12px " + FONT;
    ctx.fillText(rows[i][0], w / 2 - 200, y);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 15px " + FONT;
    ctx.fillText(rows[i][1], w / 2 + 200, y);
    ctx.strokeStyle = "rgba(120,160,220,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 200, y + 12);
    ctx.lineTo(w / 2 + 200, y + 12);
    ctx.stroke();
  }
  neonText(ctx, "PRESS ENTER TO PLAY AGAIN", w / 2, h / 2 + 142, 16, "#28e7ff", "center", "800");
}

export function drawShotTag(ctx, text, w, h) {
  ctx.save();
  ctx.font = "800 11px " + FONT;
  const tw = ctx.measureText(text).width + 20;
  ctx.fillStyle = "rgba(3,6,14,0.85)";
  roundRect(ctx, w - tw - 16, h - 32, tw, 22, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,61,154,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#ffd45e";
  ctx.textAlign = "left";
  ctx.fillText(text, w - tw - 6, h - 17);
  ctx.restore();
}
