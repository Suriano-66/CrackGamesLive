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

const ROLE_COLORS = { track: 0x3a4670, start: 0x2fbf6b, finish: 0xffcf40, wall: 0xff3c5f };
const ROLE_SIZE = {
  track: [16, 1, 18],
  start: [16, 1, 14],
  finish: [20, 1, 16],
  wall: [1, 4, 18],
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
      return new THREE.MeshStandardMaterial({
        color: base,
        roughness: role === "wall" ? 0.5 : 0.85,
        metalness: role === "wall" ? 0.2 : 0.05,
        emissive: base.clone().multiplyScalar(0.06),
      });
    },
  });
}
