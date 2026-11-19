// Neon Hustle final authored entrypoint.
import fs from "node:fs";
import path from "node:path";

// Where the deliverable bundle is assembled; overridable by the harness.
const DELIVERY_ROOT = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// Create a directory only when absent so repeated runs stay safe.
function makeSureDir(folder) {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
}

// Mirror one source tree into the delivery tree, file by file.
function duplicateTree(source, destination) {
  makeSureDir(destination);
  if (!fs.existsSync(source)) {
    return;
  }
  const items = fs.readdirSync(source, { withFileTypes: true });
  for (const item of items) {
    const src = path.join(source, item.name);
    const dst = path.join(destination, item.name);
    if (item.isDirectory()) {
      duplicateTree(src, dst);
    } else if (item.isFile()) {
      fs.copyFileSync(src, dst);
    }
  }
}

// Lay out the folders that the dossier builder will inspect.
function assembleDelivery() {
  const here = process.cwd();
  const out = path.resolve(DELIVERY_ROOT);
  makeSureDir(out);
  duplicateTree(path.join(here, "game"), path.join(out, "game"));
  duplicateTree(path.join(here, "screenshots"), path.join(out, "screenshots"));
  return out;
}

async function main() {
  const deliveryDir = assembleDelivery();
  const vendor = await import("./vendor/makefun-game.ts");
  const buildDossier = vendor.buildDossier;
  const dossierResult = buildDossier(deliveryDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000
  });
  fs.writeFileSync(path.join(deliveryDir, "dossier.json"), dossierResult);
}

main();
