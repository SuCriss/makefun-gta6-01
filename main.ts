// Neon Hustle authored entrypoint round 3.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Delivery folders are created on demand so the build works on a clean checkout.
function makeFolder(folder) {
  fs.mkdirSync(folder, { recursive: true });
}

// Mirror a whole directory tree while skipping anything that is not a regular file.
function mirrorTree(source, destination) {
  if (!fs.existsSync(source)) {
    return 0;
  }
  makeFolder(destination);
  let mirrored = 0;
  for (const item of fs.readdirSync(source, { withFileTypes: true })) {
    const fromItem = path.join(source, item.name);
    const toItem = path.join(destination, item.name);
    if (item.isDirectory()) {
      mirrored += mirrorTree(fromItem, toItem);
    } else if (item.isFile()) {
      fs.copyFileSync(fromItem, toItem);
      mirrored += 1;
    }
  }
  return mirrored;
}

async function runBuild() {
  const deliveryDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  makeFolder(deliveryDir);

  // The browser bundle stays completely self contained and offline.
  const bundleCount = mirrorTree(path.join(projectRoot, 'game'), path.join(deliveryDir, 'game'));
  const shotCount = mirrorTree(path.join(projectRoot, 'screenshots'), path.join(deliveryDir, 'screenshots'));

  const { buildDossier } = await import('./vendor/makefun-game.ts');

  // Budget caps keep the assembled dossier inside the make.fun submission limits.
  const dossier = await buildDossier(deliveryDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });

  fs.writeFileSync(path.join(deliveryDir, 'dossier.json'), dossier, 'utf8');
  process.stdout.write(`Neon Hustle packaged ${bundleCount} game files and ${shotCount} screenshots into ${deliveryDir}\n`);
}

runBuild().catch((failure) => {
  process.stderr.write(`${failure && failure.stack ? failure.stack : String(failure)}\n`);
  process.exitCode = 1;
});
