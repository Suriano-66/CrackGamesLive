// Prépare les fichiers embarqués par le studio :
//  - le moteur three.js + cannon-es (copiés depuis node_modules → vendor/)
//  - le moteur d'édition et de course du jeu (copiés depuis ../src → renderer/engine/)
// Ainsi le studio reste TOUJOURS synchro avec le code du jeu, et l'app packagée
// (.exe) est autonome (elle embarque ces copies).
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, ".."); // studio/
const NM = path.join(ROOT, "node_modules");
const PARENT_SRC = path.resolve(ROOT, "..", "src", "components", "games");

const VENDOR_COPIES = [
  ["three/build/three.module.js", "vendor/three/build/three.module.js"],
  ["three/build/three.core.js", "vendor/three/build/three.core.js"],
  ["three/examples/jsm/controls/OrbitControls.js", "vendor/three/examples/jsm/controls/OrbitControls.js"],
  ["three/examples/jsm/controls/TransformControls.js", "vendor/three/examples/jsm/controls/TransformControls.js"],
  ["cannon-es/dist/cannon-es.js", "vendor/cannon-es/dist/cannon-es.js"],
];

const ENGINE_COPIES = [
  ["marbleEditor3D.js", "renderer/engine/marbleEditor3D.js"],
  ["marbleRaceEngine.js", "renderer/engine/marbleRaceEngine.js"],
];

async function copy(src, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

let ok = 0;
let warnings = 0;

for (const [rel, out] of VENDOR_COPIES) {
  const src = path.join(NM, rel);
  const dest = path.join(ROOT, out);
  try {
    await copy(src, dest);
    ok++;
  } catch {
    warnings++;
    console.warn(`⚠️  Introuvable: ${rel} — as-tu lancé "npm install" dans le dossier studio ?`);
  }
}

for (const [rel, out] of ENGINE_COPIES) {
  const src = path.join(PARENT_SRC, rel);
  const dest = path.join(ROOT, out);
  try {
    await copy(src, dest);
    ok++;
  } catch {
    warnings++;
    console.warn(
      `⚠️  Moteur introuvable: ${rel} — le studio doit se trouver dans le dépôt CrackGamesLive (dossier ../src attendu).`,
    );
  }
}

console.log(`✅ Studio préparé : ${ok} fichier(s) copié(s)${warnings ? `, ${warnings} avertissement(s)` : ""}.`);
