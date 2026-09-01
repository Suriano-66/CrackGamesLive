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
  // Une piste tracée gère ses propres rambardes (bloc « Piste tracée »).
  if (!piece || piece.role === "modele" || estPolygone(piece) || estChemin(piece)) return false;
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

// ══════════════════════════════════════════════════════════════════════════
//  Pistes tracées : un ruban qui suit une ligne de points
//
//  On pose quelques points ; le reste est calculé : la piste les relie par une
//  courbe lissée, descend d'une pente régulière, se borde de rambardes des deux
//  côtés et s'incline d'elle-même dans les virages. Une piste entière est UNE
//  pièce, donc aucune jointure où une bille peut accrocher.
//
//    { role:"track",
//      chemin: [[x,z], …],   points du tracé, dans le repère de la pièce
//      largeur, epaisseur,   dimensions du ruban
//      denivele,             hauteur perdue du début à la fin (pente régulière)
//      lissage,              0 = lignes droites, 6 = très arrondi
//      devers,               inclinaison maxi dans les virages, en degrés
//      boucle,               true = circuit fermé
//      rails: { g, d, h, e } rambardes gauche / droite, hauteur, épaisseur
//    }
//
//  `pos` est le point de DÉPART du tracé (au niveau du dessus de la piste), et
//  `size` reste l'encombrement total : les tests de zone des moteurs et le
//  cadrage caméra continuent de fonctionner sans rien savoir des rubans.
// ══════════════════════════════════════════════════════════════════════════

export const CHEMIN_DEFAUT = {
  largeur: 14,
  epaisseur: 1.4,
  denivele: 40,
  lissage: 3,
  devers: 12,
  boucle: false,
  rails: { g: true, d: true, h: 2.4, e: 0.6 },
};

export function estChemin(p) {
  return !!(p && Array.isArray(p.chemin) && p.chemin.length >= 2);
}

export function reglagesChemin(p) {
  const r = p && p.rails ? p.rails : CHEMIN_DEFAUT.rails;
  return {
    largeur: Math.max(2, Number(p?.largeur) || CHEMIN_DEFAUT.largeur),
    epaisseur: Math.max(0.2, Number(p?.epaisseur) || CHEMIN_DEFAUT.epaisseur),
    denivele: Number.isFinite(Number(p?.denivele)) ? Number(p.denivele) : CHEMIN_DEFAUT.denivele,
    lissage: Math.max(0, Math.min(6, Math.round(Number(p?.lissage ?? CHEMIN_DEFAUT.lissage)))),
    devers: Math.max(0, Math.min(45, Number(p?.devers ?? CHEMIN_DEFAUT.devers))),
    boucle: !!p?.boucle,
    railG: r.g !== false,
    railD: r.d !== false,
    railH: Math.max(0.2, Number(r.h) || CHEMIN_DEFAUT.rails.h),
    railE: Math.max(0.1, Number(r.e) || CHEMIN_DEFAUT.rails.e),
  };
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

// Échantillonne le tracé : positions, tangentes, vecteur « droite » incliné par
// le dévers, et normale de la surface. Tout le reste (maillage, collisions) en
// découle, ce qui garantit que le visuel et la physique ne peuvent pas diverger.
export function echantillonnerChemin(piece) {
  const r = reglagesChemin(piece);
  const base = (piece.chemin || []).map((c) => [Number(c[0]) || 0, Number(c[1]) || 0]);
  if (base.length < 2) return null;
  const n = base.length;
  const boucle = r.boucle && n >= 3;

  // 1. Sous-découpage lissé (Catmull-Rom) — 0 = on garde les segments droits.
  const sub = r.lissage > 0 ? 2 + r.lissage * 2 : 1;
  const plan = [];
  const dernier = boucle ? n : n - 1;
  for (let i = 0; i < dernier; i++) {
    const p0 = base[boucle ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const p1 = base[i % n];
    const p2 = base[(i + 1) % n];
    const p3 = base[boucle ? (i + 2) % n : Math.min(n - 1, i + 2)];
    for (let k = 0; k < sub; k++) plan.push(r.lissage > 0 ? catmull(p0, p1, p2, p3, k / sub) : [p1[0] + ((p2[0] - p1[0]) * k) / sub, p1[1] + ((p2[1] - p1[1]) * k) / sub]);
  }
  if (!boucle) plan.push(base[n - 1]);
  if (plan.length < 2) return null;

  // 2. Longueur cumulée → hauteur (pente régulière du début à la fin).
  const cum = [0];
  for (let i = 1; i < plan.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(plan[i][0] - plan[i - 1][0], plan[i][1] - plan[i - 1][1]));
  }
  const total = cum[cum.length - 1] || 1;

  // 3. Tangentes et angles, puis dévers déduit de la courbure.
  const nb = plan.length;
  const tang = [];
  for (let i = 0; i < nb; i++) {
    const a = plan[Math.max(0, i - 1)];
    const b = plan[Math.min(nb - 1, i + 1)];
    let dx = b[0] - a[0];
    let dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    tang.push([dx / l, dz / l]);
  }
  const angles = tang.map((t) => Math.atan2(t[1], t[0]));
  const brut = [];
  for (let i = 0; i < nb; i++) {
    const a0 = angles[Math.max(0, i - 1)];
    const a1 = angles[Math.min(nb - 1, i + 1)];
    let d = a1 - a0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const pas = Math.max(0.5, (cum[Math.min(nb - 1, i + 1)] - cum[Math.max(0, i - 1)]) / 2);
    // rad/unité × rayon de référence → 1 pour un virage serré
    const k = Math.max(-1, Math.min(1, (d / pas) * 22));
    brut.push(k * r.devers);
  }
  // Lissage du dévers : sans ça, une marche apparaît là où la courbure saute.
  const devers = brut.map((_, i) => {
    const a = brut[Math.max(0, i - 1)];
    const b = brut[i];
    const c = brut[Math.min(nb - 1, i + 1)];
    return (a + 2 * b + c) / 4;
  });

  const ech = [];
  for (let i = 0; i < nb; i++) {
    const y = -r.denivele * (cum[i] / total);
    const t = [tang[i][0], 0, tang[i][1]];
    // « droite » = tangente × haut, puis inclinée du dévers autour de la tangente.
    const d0 = [-t[2], 0, t[0]];
    const th = devers[i] * (Math.PI / 180);
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    const droite = [d0[0] * cs, -sn, d0[2] * cs];
    // normale de la surface = droite × tangente
    const haut = [
      droite[1] * t[2] - droite[2] * t[1],
      droite[2] * t[0] - droite[0] * t[2],
      droite[0] * t[1] - droite[1] * t[0],
    ];
    const hl = Math.hypot(haut[0], haut[1], haut[2]) || 1;
    ech.push({
      p: [plan[i][0], y, plan[i][1]],
      t,
      droite,
      haut: [haut[0] / hl, haut[1] / hl, haut[2] / hl],
    });
  }
  return { ech, longueur: total, reglages: r, boucle };
}

// Bords du ruban à un échantillon : sol gauche/droite, et pied/haut des
// rambardes. Une seule source pour le maillage ET les collisions.
function bordsRuban(e, r) {
  const w = r.largeur / 2;
  const dep = (k) => [e.p[0] + e.droite[0] * k, e.p[1] + e.droite[1] * k, e.p[2] + e.droite[2] * k];
  const bas = (v, k) => [v[0] - e.haut[0] * k, v[1] - e.haut[1] * k, v[2] - e.haut[2] * k];
  const haut = (v, k) => [v[0] + e.haut[0] * k, v[1] + e.haut[1] * k, v[2] + e.haut[2] * k];
  const G = dep(-w);
  const D = dep(w);
  return {
    G,
    D,
    Gb: bas(G, r.epaisseur),
    Db: bas(D, r.epaisseur),
    // pieds des rambardes (vers l'intérieur de l'épaisseur du garde-corps)
    Gi: dep(-w + r.railE),
    Di: dep(w - r.railE),
    GH: haut(G, r.railH),
    DH: haut(D, r.railH),
    GiH: haut(dep(-w + r.railE), r.railH),
    DiH: haut(dep(w - r.railE), r.railH),
  };
}

function ajouterQuad(pos, nor, a, b, c, d) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  n = [n[0] / l, n[1] / l, n[2] / l];
  for (const s of [a, b, c, a, c, d]) {
    pos.push(s[0], s[1], s[2]);
    nor.push(n[0], n[1], n[2]);
  }
}

// Maillage du ruban, en unités RÉELLES dans le repère de la pièce.
export function geometrieChemin(piece) {
  const s = echantillonnerChemin(piece);
  if (!s) return null;
  const { ech, reglages: r, boucle } = s;
  const pos = [];
  const nor = [];
  const nb = ech.length;
  const fin = boucle ? nb : nb - 1;
  for (let i = 0; i < fin; i++) {
    const A = bordsRuban(ech[i], r);
    const B = bordsRuban(ech[(i + 1) % nb], r);
    ajouterQuad(pos, nor, A.G, A.D, B.D, B.G); // dessus
    ajouterQuad(pos, nor, A.Gb, B.Gb, B.Db, A.Db); // dessous
    ajouterQuad(pos, nor, A.G, B.G, B.Gb, A.Gb); // flanc gauche
    ajouterQuad(pos, nor, A.D, A.Db, B.Db, B.D); // flanc droit
    if (r.railG) {
      ajouterQuad(pos, nor, A.G, A.GH, B.GH, B.G); // face externe
      ajouterQuad(pos, nor, A.Gi, B.Gi, B.GiH, A.GiH); // face interne
      ajouterQuad(pos, nor, A.GH, A.GiH, B.GiH, B.GH); // dessus
    }
    if (r.railD) {
      ajouterQuad(pos, nor, A.D, B.D, B.DH, A.DH);
      ajouterQuad(pos, nor, A.Di, A.DiH, B.DiH, B.Di);
      ajouterQuad(pos, nor, A.DH, B.DH, B.DiH, A.DiH);
    }
  }
  // Bouchons aux deux extrémités d'une piste ouverte.
  if (!boucle) {
    const A = bordsRuban(ech[0], r);
    const Z = bordsRuban(ech[nb - 1], r);
    ajouterQuad(pos, nor, A.D, A.G, A.Gb, A.Db);
    ajouterQuad(pos, nor, Z.G, Z.D, Z.Db, Z.Gb);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

// Prisme quelconque à partir de deux triangles superposés.
function prismeDe(A, B, C, A2, B2, C2) {
  const bruts = [A, B, C, A2, B2, C2];
  const centre = [0, 0, 0];
  for (const v of bruts) {
    centre[0] += v[0] / 6;
    centre[1] += v[1] / 6;
    centre[2] += v[2] / 6;
  }
  const sommets = bruts.map((v) => [v[0] - centre[0], v[1] - centre[1], v[2] - centre[2]]);
  const faces = orienterFacesCannon(sommets, [
    [0, 1, 2],
    [3, 4, 5],
    [0, 1, 4, 3],
    [1, 2, 5, 4],
    [2, 0, 3, 5],
  ]);
  return { centre, sommets, faces };
}

// Collisions du ruban, découpées en TRONÇONS : un corps par segment plutôt
// qu'un seul corps géant. Chaque tronçon a une petite boîte englobante, donc le
// moteur écarte tout de suite les billes qui n'en sont pas proches — c'est ce
// qui permet d'avoir une piste longue sans effondrer les performances.
export function troncsChemin(piece) {
  const s = echantillonnerChemin(piece);
  if (!s) return [];
  const { ech, reglages: r, boucle } = s;
  const nb = ech.length;
  const fin = boucle ? nb : nb - 1;
  const troncs = [];
  for (let i = 0; i < fin; i++) {
    const A = bordsRuban(ech[i], r);
    const B = bordsRuban(ech[(i + 1) % nb], r);
    const prismes = [
      // sol : le quadrilatère du dessus, coupé en deux, extrudé vers le bas
      prismeDe(A.G, A.D, B.D, A.Gb, A.Db, B.Db),
      prismeDe(A.G, B.D, B.G, A.Gb, B.Db, B.Gb),
    ];
    if (r.railG) {
      prismes.push(prismeDe(A.G, A.Gi, B.Gi, A.GH, A.GiH, B.GiH));
      prismes.push(prismeDe(A.G, B.Gi, B.G, A.GH, B.GiH, B.GH));
    }
    if (r.railD) {
      prismes.push(prismeDe(A.Di, A.D, B.D, A.DiH, A.DH, B.DH));
      prismes.push(prismeDe(A.Di, B.D, B.Di, A.DiH, B.DH, B.DiH));
    }
    troncs.push({ prismes });
  }
  return troncs;
}

// Encombrement du ruban : sert aux tests de zone et au cadrage caméra.
export function empriseChemin(piece) {
  const g = geometrieChemin(piece);
  if (!g || !g.boundingBox) return null;
  const b = g.boundingBox;
  const t = (v) => Math.round(v * 100) / 100;
  const res = {
    taille: [t(Math.max(0.5, b.max.x - b.min.x)), t(Math.max(0.5, b.max.y - b.min.y)), t(Math.max(0.5, b.max.z - b.min.z))],
    centre: [t((b.max.x + b.min.x) / 2), t((b.max.y + b.min.y) / 2), t((b.max.z + b.min.z) / 2)],
  };
  g.dispose();
  return res;
}

// Fabrique une pièce « piste » à partir de points cliqués dans le monde.
// Le premier point devient l'origine de la pièce : déplacer la piste revient
// alors à déplacer son départ, ce qui est le geste attendu.
export function creerPieceChemin(ptsMonde, opt = {}) {
  const pts = (ptsMonde || []).map((c) => [Number(c[0]) || 0, Number(c[1]) || 0]);
  if (pts.length < 2) return null;
  const o = pts[0];
  const piece = {
    role: opt.role || "track",
    pos: [Math.round(o[0] * 100) / 100, Math.round((Number(opt.hauteur) || 0) * 100) / 100, Math.round(o[1] * 100) / 100],
    rot: [0, 0, 0],
    chemin: pts.map(([x, z]) => [Math.round((x - o[0]) * 100) / 100, Math.round((z - o[1]) * 100) / 100]),
    largeur: Math.max(2, Number(opt.largeur) || CHEMIN_DEFAUT.largeur),
    epaisseur: Math.max(0.2, Number(opt.epaisseur) || CHEMIN_DEFAUT.epaisseur),
    denivele: Number.isFinite(Number(opt.denivele)) ? Number(opt.denivele) : CHEMIN_DEFAUT.denivele,
    lissage: Number.isFinite(Number(opt.lissage)) ? Number(opt.lissage) : CHEMIN_DEFAUT.lissage,
    devers: Number.isFinite(Number(opt.devers)) ? Number(opt.devers) : CHEMIN_DEFAUT.devers,
    boucle: !!opt.boucle,
    rails: { ...CHEMIN_DEFAUT.rails, ...(opt.rails || {}) },
    size: [1, 1, 1],
  };
  majEmpriseChemin(piece);
  return piece;
}

// Recalcule `size` après toute modification : c'est ce que lisent les tests de
// zone des moteurs, le cadrage et l'aimant.
export function majEmpriseChemin(piece) {
  const e = empriseChemin(piece);
  if (e) piece.size = e.taille;
  return piece;
}
