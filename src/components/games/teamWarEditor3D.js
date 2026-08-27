// Éditeur 3D « Rouge vs Bleu » — arène de bagarre.
// Rôles : arene | mur | bumper | spawnRouge | spawnBleu
//
// Tout le comportement (gizmo, sélection multiple, aimantation, vol ZQSD,
// annulation) vient de editorCore.js, partagé avec l'éditeur de la course.
// Ce fichier ne décrit que les pièces propres à l'arène.
import * as THREE from "three";
import { creerEditeur3D } from "./editorCore.js";

// Description des rôles : couleur d'affichage, taille par défaut, libellé.
export const TW_ROLES = [
  { role: "arene", label: "Sol d'arène", icon: "▭", color: "#2b3350", size: [46, 2, 66] },
  { role: "mur", label: "Mur / rambarde", icon: "🧱", color: "#59627f", size: [1, 6, 40] },
  { role: "bumper", label: "Bumper", icon: "💥", color: "#ffc23c", size: [3, 3, 3] },
  { role: "spawnRouge", label: "Camp rouge", icon: "🔴", color: "#8e1f33", size: [34, 0.4, 14] },
  { role: "spawnBleu", label: "Camp bleu", icon: "🔵", color: "#1f4d8e", size: [34, 0.4, 14] },
];
const ROLE_COLORS = Object.fromEntries(TW_ROLES.map((r) => [r.role, new THREE.Color(r.color).getHex()]));
const ROLE_SIZE = Object.fromEntries(TW_ROLES.map((r) => [r.role, r.size]));
export function twRoleDef(role) {
  return TW_ROLES.find((r) => r.role === role) || TW_ROLES[0];
}

export function createTeamWarEditor3D(canvas, opts = {}) {
  return creerEditeur3D(canvas, opts, {
    fond: 0x0b1018,
    cameraDepart: [60, 62, -74],
    cible: [0, 4, 0],
    cadrage: [0.8, 0.75, -1.05],
    roleDefaut: "arene",
    couleurs: ROLE_COLORS,
    tailles: ROLE_SIZE,
    // Un seul camp de chaque couleur par niveau.
    uniques: ["spawnRouge", "spawnBleu"],
    decalageDup: [4, 0, 4],
    hauteurAjout: (size) => size[1] / 2 + 1,
    lumieres(scene) {
      scene.add(new THREE.HemisphereLight(0xdfeaff, 0x20263a, 1.2));
      const sun = new THREE.DirectionalLight(0xffffff, 1.3);
      sun.position.set(-40, 90, -30);
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xff8fa3, 0.4);
      fill.position.set(50, 40, 60);
      scene.add(fill);
    },
    materiau(base, role) {
      const estCamp = role === "spawnRouge" || role === "spawnBleu";
      return new THREE.MeshStandardMaterial({
        color: base,
        roughness: role === "bumper" ? 0.35 : role === "mur" ? 0.55 : 0.85,
        metalness: role === "bumper" ? 0.45 : role === "mur" ? 0.25 : 0.05,
        emissive: role === "bumper" ? base.clone().multiplyScalar(0.4) : base.clone().multiplyScalar(0.06),
        transparent: estCamp,
        opacity: estCamp ? 0.82 : 1,
      });
    },
  });
}
