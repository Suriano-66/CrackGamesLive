// Type de jeu « Rouge vs Bleu » — bagarre de bonhommes.
//
// Deux camps s'affrontent dans une arène. Chaque cadeau TikTok fait apparaître
// des combattants aux couleurs du camp du viewer ; ils foncent sur l'ennemi le
// plus proche et se battent à coups de poings. Un combattant KO est éliminé
// pour la manche : le dernier camp encore debout gagne.
//
// Fichier séparé volontairement : la course de billes vit dans gameTypes.ts et
// n'est pas modifiée, pour que les deux jeux évoluent sans conflit.
import type { GameTypeDef, Platform, RoleDef } from "./gameTypes";

export const TEAM_WAR_ROLES: RoleDef[] = [
  { role: "arene", label: "Sol d'arène", icon: "▭", color: "#2b3350", size: [46, 2, 66] },
  { role: "mur", label: "Mur / rambarde", icon: "🧱", color: "#59627f", size: [1, 6, 40] },
  { role: "bumper", label: "Bumper", icon: "💥", color: "#ffc23c", size: [3, 3, 3] },
  { role: "spawnRouge", label: "Camp rouge", icon: "🔴", color: "#8e1f33", size: [34, 0.4, 14] },
  { role: "spawnBleu", label: "Camp bleu", icon: "🔵", color: "#1f4d8e", size: [34, 0.4, 14] },
];

// Arène par défaut : plateau fermé, un camp de chaque côté, 4 bumpers au centre
// pour que la mêlée ne soit pas une simple ligne droite.
function buildDefaultArena(): Platform[] {
  const p = (
    id: string,
    role: string,
    pos: [number, number, number],
    size: [number, number, number],
  ): Platform => ({ id, role: role as Platform["role"], pos, size, rot: [0, 0, 0] });

  return [
    p("sol", "arene", [0, 0, 0], [46, 2, 66]),
    p("murG", "mur", [-23.5, 3, 0], [1, 6, 66]),
    p("murD", "mur", [23.5, 3, 0], [1, 6, 66]),
    p("murN", "mur", [0, 3, -33.5], [48, 6, 1]),
    p("murS", "mur", [0, 3, 33.5], [48, 6, 1]),
    p("campR", "spawnRouge", [0, 1.2, -24], [38, 0.4, 14]),
    p("campB", "spawnBleu", [0, 1.2, 24], [38, 0.4, 14]),
    p("bump1", "bumper", [-12, 2.6, -8], [3, 3, 3]),
    p("bump2", "bumper", [12, 2.6, 8], [3, 3, 3]),
    p("bump3", "bumper", [-12, 2.6, 8], [3, 3, 3]),
    p("bump4", "bumper", [12, 2.6, -8], [3, 3, 3]),
  ];
}

export const TEAM_WAR: GameTypeDef = {
  id: "team-war",
  label: "Rouge vs Bleu (bagarre)",
  roles: TEAM_WAR_ROLES,
  defaultPlatforms: buildDefaultArena(),
};
