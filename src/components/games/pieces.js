// ══════════════════════════════════════════════════════════════════════════
//  Géométrie partagée des pièces de niveau.
//
//  Aujourd'hui : les RAMBARDES INTÉGRÉES. Poser un mur séparé le long de
//  chaque plateforme est le geste le plus pénible de la construction d'un
//  niveau : il faut le dimensionner, l'aligner, le remonter, et tout refaire
//  dès qu'on déplace ou redimensionne la plateforme. Une pièce peut désormais
//  porter ses propres bords : ils suivent sa taille, sa rotation et ses
//  déplacements, sans jamais se désaligner.
//
//  Sur une pièce :
//    rails: { g, d, av, ar, h, e }
//      g / d   — bords gauche et droit, le long de la pièce (axe Z)
//      av      — bord AVANT : le bout vers lequel on va (+Z), celui qui ferme
//                une arrivée pour que les billes s'y arrêtent
//      ar      — bord ARRIÈRE : le bout d'où l'on vient (-Z), celui qui ferme
//                le fond d'un départ
//      h       — hauteur du bord au-dessus de la face supérieure (défaut 2)
//      e       — épaisseur du bord (défaut 0.4)
//  Absence de `rails` (ou aucun côté coché) = pièce nue, comme avant.
//
//  Ce fichier est partagé par l'éditeur 3D ET les moteurs de jeu : les bords
//  affichés dans le Studio sont exactement ceux qui bloquent les billes.
// ══════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

export const RAILS_DEFAUT = { g: false, d: false, av: false, ar: false, h: 2, e: 0.4 };

// Normalise ce qu'on a stocké sur la pièce, ou renvoie null si aucun bord.
export function railsDe(piece) {
  const r = piece && piece.rails;
  if (!r || typeof r !== "object") return null;
  const n = {
    g: !!r.g,
    d: !!r.d,
    av: !!r.av,
    ar: !!r.ar,
    h: Math.max(0.1, Number(r.h) || RAILS_DEFAUT.h),
    e: Math.max(0.05, Number(r.e) || RAILS_DEFAUT.e),
  };
  return n.g || n.d || n.av || n.ar ? n : null;
}

export function aDesRails(piece) {
  return railsDe(piece) !== null;
}

// Bords d'une pièce, dans SON repère (avant rotation), en dimensions réelles.
// → [{ cote, pos:[x,y,z], size:[sx,sy,sz] }]
// L'éditeur en fait des sous-objets, les moteurs des formes de collision
// décalées : même calcul des deux côtés, donc aucun écart possible.
export function bordsDe(piece) {
  const r = railsDe(piece);
  if (!r) return [];
  const s = piece.size || [1, 1, 1];
  const sx = Math.max(0.05, Math.abs(s[0]));
  const sy = Math.max(0.05, Math.abs(s[1]));
  const sz = Math.max(0.05, Math.abs(s[2]));
  // Le bord repose sur la face supérieure de la pièce.
  const y = sy / 2 + r.h / 2;
  const e = Math.min(r.e, sx / 2, sz / 2);
  const out = [];
  if (r.g) out.push({ cote: "g", pos: [-(sx - e) / 2, y, 0], size: [e, r.h, sz] });
  if (r.d) out.push({ cote: "d", pos: [(sx - e) / 2, y, 0], size: [e, r.h, sz] });
  // Les bords avant/arrière couvrent toute la largeur : les angles se
  // recouvrent avec les bords latéraux, ce qui ferme proprement les coins.
  // On se déplace vers +Z : « avant » est donc en +Z, « arrière » en -Z.
  if (r.av) out.push({ cote: "av", pos: [0, y, (sz - e) / 2], size: [sx, r.h, e] });
  if (r.ar) out.push({ cote: "ar", pos: [0, y, -(sz - e) / 2], size: [sx, r.h, e] });
  return out;
}

// Rôles qui acceptent des bords : uniquement ce sur quoi on roule ou marche.
// Inutile de proposer des rambardes sur un bumper ou une zone de chute.
const ROLES_AVEC_BORDS = new Set(["track", "start", "finish", "arene", "spawnRouge", "spawnBleu"]);
export function accepteRails(piece) {
  // Une dalle polygonale n'a pas de « côtés » identifiables : les rambardes
  // cochables n'y ont pas de sens.
  if (!piece || piece.role === "modele" || estPolygone(piece)) return false;
  return ROLES_AVEC_BORDS.has(piece.role);
}

// ══════════════════════════════════════════════════════════════════════════
//  Sols polygonaux
//
//  Un sol composé de plusieurs boîtes qui se chevauchent laisse toujours des
//  micro-marches à leurs jointures : une bille les accroche, ralentit, ou part
//  de travers. Une pièce peut donc porter un CONTOUR (`pts`) au lieu d'être une
//  boîte : elle devient alors une dalle plate à N côtés, d'un seul tenant —
//  une seule surface, donc aucune arête à l'intérieur.
//
//  Les points sont stockés NORMALISÉS dans [-0.5, 0.5], en (x, z), dans le
//  repère de la pièce. La vraie taille reste dans `size`, exactement comme
//  pour une boîte : le gizmo, l'aimant, l'inspecteur et les tests de zone des
//  moteurs continuent donc de fonctionner sans rien savoir des polygones.
//
//    { role:"track", pts:[[x,z],…], size:[largeur, épaisseur, profondeur], … }
//
//  Côté physique, le contour est découpé en triangles, et chaque triangle
//  devient un PRISME CONVEXE. Tous ces prismes vont sur le même corps statique,
//  leurs faces supérieures sont exactement coplanaires : la bille roule dessus
//  comme sur une seule dalle.
// ══════════════════════════════════════════════════════════════════════════

export function estPolygone(p) {
  return !!(p && Array.isArray(p.pts) && p.pts.length >= 3);
}

// Aire signée dans le plan XZ. Sert à garantir un sens de parcours constant,
// sans quoi les normales sortiraient à l'envers et la dalle serait invisible
// par-dessus.
function aireSignee(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

// Contour propre : doublons retirés, sens direct garanti.
export function contourDe(p) {
  const bruts = (p.pts || []).map((c) => [Number(c[0]) || 0, Number(c[1]) || 0]);
  const pts = [];
  for (const c of bruts) {
    const d = pts[pts.length - 1];
    if (d && Math.abs(d[0] - c[0]) < 1e-5 && Math.abs(d[1] - c[1]) < 1e-5) continue;
    pts.push(c);
  }
  if (pts.length >= 2) {
    const a = pts[0];
    const z = pts[pts.length - 1];
    if (Math.abs(a[0] - z[0]) < 1e-5 && Math.abs(a[1] - z[1]) < 1e-5) pts.pop();
  }
  if (pts.length < 3) return null;
  if (aireSignee(pts) < 0) pts.reverse();
  return pts;
}

// Découpe du contour en triangles (indices dans `pts`).
export function trianglesDe(pts) {
  const contour = pts.map((c) => new THREE.Vector2(c[0], c[1]));
  let tris = [];
  try {
    tris = THREE.ShapeUtils.triangulateShape(contour, []) || [];
  } catch {
    tris = [];
  }
  if (!tris.length && pts.length >= 3) {
    // Repli : éventail depuis le premier point. Correct pour un contour convexe,
    // approximatif sinon — mais on ne se retrouve jamais avec une dalle vide.
    for (let i = 1; i < pts.length - 1; i++) tris.push([0, i, i + 1]);
  }
  // Sens direct pour chaque triangle : les prismes physiques en dépendent.
  return tris.map(([a, b, c]) => (aireSignee([pts[a], pts[b], pts[c]]) < 0 ? [a, c, b] : [a, b, c]));
}

// Maillage NORMALISÉ dans une boîte 1×1×1 : la pièce est ensuite mise à
// l'échelle par `size` comme une boîte ordinaire.
export function geometriePolygone(piece) {
  const pts = contourDe(piece);
  if (!pts) return null;
  const tris = trianglesDe(pts);
  const h = 0.5;
  const pos = [];
  const nor = [];
  const ajout = (x, y, z, nx, ny, nz) => {
    pos.push(x, y, z);
    nor.push(nx, ny, nz);
  };
  // Dessus (+Y) et dessous (−Y).
  for (const [a, b, c] of tris) {
    const A = pts[a];
    const B = pts[b];
    const C = pts[c];
    ajout(A[0], h, A[1], 0, 1, 0);
    ajout(C[0], h, C[1], 0, 1, 0);
    ajout(B[0], h, B[1], 0, 1, 0);
    ajout(A[0], -h, A[1], 0, -1, 0);
    ajout(B[0], -h, B[1], 0, -1, 0);
    ajout(C[0], -h, C[1], 0, -1, 0);
  }
  // Flancs.
  for (let i = 0; i < pts.length; i++) {
    const P = pts[i];
    const Q = pts[(i + 1) % pts.length];
    const dx = Q[0] - P[0];
    const dz = Q[1] - P[1];
    const l = Math.hypot(dx, dz) || 1;
    const nx = dz / l;
    const nz = -dx / l;
    ajout(P[0], h, P[1], nx, 0, nz);
    ajout(Q[0], h, Q[1], nx, 0, nz);
    ajout(Q[0], -h, Q[1], nx, 0, nz);
    ajout(P[0], h, P[1], nx, 0, nz);
    ajout(Q[0], -h, Q[1], nx, 0, nz);
    ajout(P[0], -h, P[1], nx, 0, nz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  return g;
}

// Oriente les faces selon la convention EXACTE de cannon-es. Deux pièges :
//  1. il vérifie la normale contre le PREMIER SOMMET de la face, ce qui n'a
//     de sens que si la forme contient son origine — d'où le recentrage des
//     prismes sur leur propre centre avant de les passer au moteur ;
//  2. la convention exacte a été établie en confrontant les deux sens au vrai
//     cannon-es : c'est la normale sortante qu'il attend.
// Se tromper ne lève aucune erreur : les billes traversent simplement le sol.
function orienterFacesCannon(sommetsCentres, faces) {
  return faces.map((f) => {
    const a = sommetsCentres[f[0]];
    const b = sommetsCentres[f[1]];
    const d = sommetsCentres[f[2]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    // Convention vérifiée directement contre cannon-es (aucun avertissement,
    // une normale vers le haut et une vers le bas par prisme) : la normale du
    // produit vectoriel doit pointer vers l'EXTÉRIEUR, donc n·a > 0 puisque la
    // forme est recentrée sur son origine.
    const dot = n[0] * a[0] + n[1] * a[1] + n[2] * a[2];
    return dot > 0 ? f : [...f].reverse();
  });
}

// Prismes convexes, en unités RÉELLES dans le repère de la pièce (les corps
// physiques n'ont pas d'échelle). Chaque moteur en fait des CANNON.ConvexPolyhedron.
export function prismesDe(piece) {
  const pts = contourDe(piece);
  if (!pts) return [];
  const s = piece.size || [1, 1, 1];
  const sx = Math.max(0.05, Math.abs(s[0]));
  const sy = Math.max(0.05, Math.abs(s[1]));
  const sz = Math.max(0.05, Math.abs(s[2]));
  const h = sy / 2;
  return trianglesDe(pts).map(([a, b, c]) => {
    const A = pts[a];
    const B = pts[b];
    const C = pts[c];
    const bruts = [
      [A[0] * sx, h, A[1] * sz],
      [B[0] * sx, h, B[1] * sz],
      [C[0] * sx, h, C[1] * sz],
      [A[0] * sx, -h, A[1] * sz],
      [B[0] * sx, -h, B[1] * sz],
      [C[0] * sx, -h, C[1] * sz],
    ];
    // Chaque prisme est recentré sur lui-même ; sa position dans la pièce est
    // rendue à part, dans `centre`, et devient le décalage de la forme.
    const centre = [0, 0, 0];
    for (const v of bruts) {
      centre[0] += v[0] / 6;
      centre[1] += v[1] / 6;
      centre[2] += v[2] / 6;
    }
    const sommets = bruts.map((v) => [v[0] - centre[0], v[1] - centre[1], v[2] - centre[2]]);
    // Sens des faces : cannon-es exige un parcours anti-horaire vu DE
    // L'EXTÉRIEUR. Le déduire à la main est une source d'erreurs silencieuses
    // (la bille traverse la dalle sans rien signaler), alors on le VÉRIFIE :
    // pour chaque face, si la normale calculée pointe vers l'intérieur du
    // prisme, on retourne l'ordre.
    const faces = orienterFacesCannon(sommets, [
      [0, 1, 2],
      [3, 4, 5],
      [0, 1, 4, 3],
      [1, 2, 5, 4],
      [2, 0, 3, 5],
    ]);
    return { centre, sommets, faces };
  });
}

// Fabrique une pièce « sol polygonal » à partir de points cliqués dans le
// monde. Le contour est ramené au centre et normalisé : la pièce se manipule
// ensuite exactement comme une boîte.
export function creerPiecePolygone(ptsMonde, opt = {}) {
  const pts = contourDe({ pts: ptsMonde });
  if (!pts) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const w = Math.max(0.5, maxX - minX);
  const d = Math.max(0.5, maxZ - minZ);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const ep = Math.max(0.2, Number(opt.epaisseur) || 1.2);
  const hautDessus = Number(opt.hauteur) || 0;
  const a2 = (v) => Math.round(v * 10000) / 10000;
  const a1 = (v) => Math.round(v * 100) / 100;
  return {
    role: opt.role || "track",
    // Le dessus de la dalle tombe pile sur la hauteur visée.
    pos: [a1(cx), a1(hautDessus - ep / 2), a1(cz)],
    size: [a1(w), a1(ep), a1(d)],
    rot: [0, 0, 0],
    pts: pts.map(([x, z]) => [a2((x - cx) / w), a2((z - cz) / d)]),
  };
}
