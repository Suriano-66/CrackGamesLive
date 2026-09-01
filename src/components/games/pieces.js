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
  return !!piece && piece.role !== "modele" && ROLES_AVEC_BORDS.has(piece.role);
}
