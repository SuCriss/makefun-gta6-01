// Neon Hustle final authored entrypoint.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function findRepositoryRoot() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  let cursor = moduleDir;
  for (let hop = 0; hop < 12; hop += 1) {
    if (fs.existsSync(path.join(cursor, "game")) && fs.existsSync(path.join(cursor, "vendor"))) {
      return cursor;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return moduleDir;
}

function mirrorDirectory(source, destination) {
  if (!fs.existsSync(source)) {
    fs.mkdirSync(destination, { recursive: true });
    return;
  }
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) mirrorDirectory(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

const repositoryRoot = findRepositoryRoot();
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

fs.mkdirSync(outputDir, { recursive: true });
mirrorDirectory(path.join(repositoryRoot, "game"), path.join(outputDir, "game"));
mirrorDirectory(path.join(repositoryRoot, "screenshots"), path.join(outputDir, "screenshots"));

const dossierModule = await import(pathToFileURL(path.join(repositoryRoot, "vendor", "makefun-game.ts")).href);
const dossier = await dossierModule.buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000
});

fs.writeFileSync(path.join(outputDir, "dossier.json"), dossier);
