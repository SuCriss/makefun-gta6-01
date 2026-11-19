import { generateWorld, generateTraffic, generatePedestrians } from "./world.js";
import { createPlayer, bumpWanted } from "./player.js";
import { createPolice } from "./police.js";
import { renderScene, renderStart, renderEnd, drawShotTag } from "./render.js";

function baseState(seed) {
  const world = generateWorld(seed);
  const player = createPlayer(seed);
  return {
    world, player,
    cars: generateTraffic(world, 18),
    people: generatePedestrians(world, 26),
    police: createPolice(world, 5),
    shots: [],
    missionIndex: 0,
    missionProgress: 0,
    missionPeak: 0,
    prompt: "",
    promptUntil: 0,
    peakWanted: 0,
    elapsed: 0,
    endReason: "complete",
    best: 0,
    camera: null,
    seed
  };
}

function setStage(state) {
  state.player.x = 720;
  state.player.y = 700;
  state.player.angle = -0.35;
  const offsets = [
    [-168, -84, 0.12, "#ff4d6d"],
    [132, -126, Math.PI, "#3fa9f5"],
    [186, 94, Math.PI / 2, "#f7c948"],
    [-124, 152, -Math.PI / 2, "#36d7a1"],
    [42, 196, 0.4, "#b478ff"]
  ];
  for (let i = 0; i < offsets.length; i++) {
    const car = state.cars[i];
    if (!car) continue;
    car.x = state.player.x + offsets[i][0];
    car.y = state.player.y + offsets[i][1];
    car.angle = offsets[i][2];
    car.color = offsets[i][3];
  }
  const units = [
    [148, -182, -2.2],
    [-196, 58, 0.4],
    [92, 206, -1.4],
    [228, 36, Math.PI]
  ];
  for (let i = 0; i < units.length; i++) {
    const unit = state.police[i];
    if (!unit) continue;
    unit.x = state.player.x + units[i][0];
    unit.y = state.player.y + units[i][1];
    unit.angle = units[i][2];
    unit.speed = 3.2;
    unit.siren = i % 2 === 0;
  }
  for (let i = 0; i < Math.min(8, state.people.length); i++) {
    const ped = state.people[i];
    ped.x = state.player.x + ((i % 4) - 2) * 58 + 26;
    ped.y = state.player.y - 76 + Math.floor(i / 4) * 152;
    ped.angle = (i * 0.7) % (Math.PI * 2);
  }
  const drops = state.world.cash;
  for (let i = 0; i < drops.length; i++) drops[i].taken = i > 13;
  for (let i = 0; i < 4; i++) {
    const drop = drops[i];
    drop.x = state.player.x + ((i % 2) * 128 - 64);
    drop.y = state.player.y - 42 - Math.floor(i / 2) * 116;
    drop.taken = false;
  }
}

function composeStart(seed) {
  const state = baseState(seed);
  setStage(state);
  state.player.inCar = true;
  state.player.carId = state.cars[0].id;
  state.player.speed = 0;
  state.player.wanted = 0;
  return state;
}

function composePlay(seed) {
  const state = baseState(seed);
  setStage(state);
  state.player.inCar = true;
  state.player.carId = state.cars[0].id;
  state.cars[0].occupied = true;
  state.cars[0].stolen = true;
  state.player.speed = 4.2;
  state.player.cash = 1240;
  state.player.ammo = 21;
  state.player.health = 76;
  state.player.armor = 34;
  state.player.collected = 4;
  bumpWanted(state.player, 3);
  state.peakWanted = 3;
  state.missionPeak = 3;
  state.prompt = "HOTWIRE COMPLETE  +$250";
  state.shots.push({
    x: state.player.x + 126, y: state.player.y - 34,
    vx: 520, vy: -60, life: 0.8, friendly: true, damage: 24
  });
  state.shots.push({
    x: state.player.x - 142, y: state.player.y + 72,
    vx: -420, vy: 40, life: 0.8, friendly: false, damage: 12
  });
  return state;
}

function composeEnd(seed) {
  const state = baseState(seed);
  setStage(state);
  state.player.inCar = false;
  state.player.x = 748;
  state.player.y = 736;
  state.player.angle = 0.6;
  state.player.cash = 2450;
  state.player.ammo = 12;
  state.player.health = 62;
  state.player.armor = 8;
  state.player.collected = 11;
  state.player.delivered = 4;
  state.player.distance = 12840;
  state.player.wanted = 1;
  state.peakWanted = 4;
  state.missionIndex = 3;
  state.endReason = "complete";
  state.best = 2450;
  return state;
}

export function renderShot(ctx, mode, seed, w, h) {
  const chosen = Number.isFinite(seed) ? seed : 1;
  if (mode === "start") {
    const state = composeStart(chosen);
    renderStart(ctx, state, w, h);
    drawShotTag(ctx, "SHOT START  ·  SEED " + chosen, w, h);
    return state;
  }
  if (mode === "end") {
    const state = composeEnd(chosen);
    renderEnd(ctx, state, w, h);
    drawShotTag(ctx, "SHOT END  ·  SEED " + chosen, w, h);
    return state;
  }
  const state = composePlay(chosen);
  renderScene(ctx, state, w, h, { label: "SHOT PLAY  ·  SEED " + chosen });
  drawShotTag(ctx, "NEON HUSTLE  ·  PLAY", w, h);
  return state;
}
