// Éditeur 3D "façon Roblox" pour La grande course.
// On place des PLATEFORMES (boîtes) dans l'espace et on les déplace / tourne /
// étire sur les axes X, Y, Z avec un gizmo. Caméra libre (orbite + vol ZQSD),
// sélection au clic (Ctrl+clic = sélection multiple). Renvoie les plateformes
// via onChange et la sélection via onSelect.
//
// Tout le comportement est dans editorCore.js, partagé avec l'éditeur de
// « Rouge vs Bleu » : ce fichier n'apporte que l'apparence et les rôles de la
// course de billes.
import * as THREE from "three";
import { creerEditeur3D } from "./editorCore.js";

const ROLE_COLORS = {
  track: 0x3a4670,
  start: 0x2fbf6b,
  finish: 0xffcf40,
  wall: 0xff3c5f,
  bumper: 0xffb43c,
  booster: 0x37d0ff,
  hazard: 0xff4d2e,
  checkpoint: 0x9b7bff,
  spinner: 0xff6ad5,
  mover: 0x59e0a0,
};
const ROLE_SIZE = {
  track: [16, 1, 18],
  start: [16, 1, 14],
  finish: [20, 1, 16],
  wall: [1, 4, 18],
  bumper: [3, 3, 3],
  booster: [7, 0.6, 8],
  hazard: [10, 3, 10],
  checkpoint: [14, 5, 1.5],
  spinner: [10, 1, 1.4],
  mover: [8, 1, 6],
};

export function createMarbleEditor3D(canvas, opts = {}) {
  return creerEditeur3D(canvas, opts, {
    fond: 0x0c111c,
    cameraDepart: [46, 52, -58],
    cible: [0, 8, 30],
    cadrage: [0.9, 0.9, -1.2],
    roleDefaut: "track",
    couleurs: ROLE_COLORS,
    tailles: ROLE_SIZE,
    // Animation par défaut posée avec un spinner / une plateforme mobile : la
    // pièce bouge tout de suite, et le réglage reste modifiable dans le panneau.
    // (Doit rester aligné sur ROLE_ANIM du moteur marbleRaceEngine.js.)
    animDefauts: {
      spinner: { type: "rotation", axe: "y", sens: 1, vitesse: 14, amplitude: 90, phase: 0 },
      mover: { type: "translation", axe: "x", sens: 1, vitesse: 12, amplitude: 6, phase: 0 },
    },
    decalageDup: [4, 1, 4],
    hauteurAjout: () => 1.5,
    lumieres(scene) {
      scene.add(new THREE.HemisphereLight(0xdfeaff, 0x20263a, 1.25));
      const sun = new THREE.DirectionalLight(0xffffff, 1.35);
      sun.position.set(-40, 90, -30);
      scene.add(sun);
      const sun2 = new THREE.DirectionalLight(0x88a0ff, 0.5);
      sun2.position.set(50, 40, 60);
      scene.add(sun2);
    },
    materiau(base, role) {
      // Le checkpoint est une porte translucide qu'on traverse ; les autres
      // obstacles brillent pour se repérer dans l'éditeur comme en jeu.
      const glow = { bumper: 0.55, booster: 0.55, hazard: 0.6, checkpoint: 0.5, spinner: 0.5, mover: 0.4 }[role];
      const shiny = role === "bumper" || role === "booster" || role === "spinner" || role === "mover";
      const m = new THREE.MeshStandardMaterial({
        color: base,
        roughness: role === "wall" ? 0.5 : shiny ? 0.3 : 0.85,
        metalness: role === "wall" ? 0.2 : shiny ? 0.45 : 0.05,
        emissive: glow != null ? base.clone().multiplyScalar(glow) : base.clone().multiplyScalar(0.06),
      });
      if (role === "checkpoint") {
        m.transparent = true;
        m.opacity = 0.34;
        m.depthWrite = false;
        m.side = THREE.DoubleSide;
      }
      return m;
    },
  });
}
