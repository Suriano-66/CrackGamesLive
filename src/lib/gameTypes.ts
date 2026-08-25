// Registre des types de jeux.
// Nouveau modèle « plateformes libres » : un niveau est une liste de
// plateformes (boîtes) que l'on place / oriente / étire dans l'espace 3D,
// façon éditeur type Roblox. Chaque plateforme :
//   { id, role, pos:[x,y,z], size:[w,h,l], rot:[rx,ry,rz] (degrés), color? }

export type PlatformRole = "track" | "start" | "finish" | "wall";

export interface Platform {
  id: string;
  role: PlatformRole;
  pos: [number, number, number];
  size: [number, number, number];
  rot: [number, number, number];
  color?: string;
}

export interface RoleDef {
  role: PlatformRole;
  label: string;
  icon: string;
  color: string; // couleur d'affichage par défaut
  size: [number, number, number]; // taille par défaut à la création
}

export interface GameTypeDef {
  id: string;
  label: string;
  roles: RoleDef[];
  defaultPlatforms: Platform[];
}

export const ROLES: RoleDef[] = [
  { role: "track", label: "Plateforme", icon: "▭", color: "#3a4670", size: [16, 1, 18] },
  { role: "start", label: "Départ", icon: "🏁", color: "#2fbf6b", size: [16, 1, 14] },
  { role: "finish", label: "Arrivée", icon: "🏆", color: "#ffcf40", size: [20, 1, 16] },
  { role: "wall", label: "Mur / rambarde", icon: "🧱", color: "#ff3c5f", size: [1, 4, 18] },
];

export function roleDef(role: string): RoleDef {
  return ROLES.find((r) => r.role === role) ?? ROLES[0];
}

// ----- Génération du circuit par défaut (départ → chute → virage → arrivée) -----
// On construit chaque segment comme un sol incliné + deux rambardes bien posées
// dessus, pour un rendu propre et jouable dès la création.
const D2R = Math.PI / 180;
let _uid = 0;
function nid(prefix: string) {
  _uid += 1;
  return `${prefix}${_uid}`;
}

// Vecteur « haut local » d'une plateforme inclinée de (pitch) autour de X
// puis (yaw) autour de Y — ordre XYZ comme dans le moteur/éditeur.
function localUp(pitchDeg: number, yawDeg: number): [number, number, number] {
  const px = pitchDeg * D2R;
  const yw = yawDeg * D2R;
  // up après rotX(px) : (0, cos, sin) ; puis rotY(yw)
  const uy = Math.cos(px);
  const uz = Math.sin(px);
  // rotation Y sur (0, uy, uz)
  const x = Math.sin(yw) * uz;
  const z = Math.cos(yw) * uz;
  return [x, uy, z];
}
function localRight(yawDeg: number): [number, number, number] {
  const yw = yawDeg * D2R;
  return [Math.cos(yw), 0, -Math.sin(yw)];
}

function buildDefaultTrack(): Platform[] {
  const out: Platform[] = [];
  const W = 16;
  const railH = 4;
  function seg(
    role: PlatformRole,
    cx: number,
    cy: number,
    cz: number,
    len: number,
    pitch: number,
    yaw: number,
    rails: boolean,
  ) {
    out.push({
      id: nid(role === "start" ? "start" : role === "finish" ? "finish" : "t"),
      role,
      pos: [cx, cy, cz],
      size: [W, 1, len],
      rot: [pitch, yaw, 0],
    });
    if (rails) {
      const up = localUp(pitch, yaw);
      const rt = localRight(yaw);
      const off = W / 2; // bord de la route
      const lift = railH / 2 + 0.5; // pose la rambarde sur le sol
      for (const s of [-1, 1]) {
        out.push({
          id: nid("rail"),
          role: "wall",
          pos: [
            cx + rt[0] * s * off + up[0] * lift,
            cy + rt[1] * s * off + up[1] * lift,
            cz + rt[2] * s * off + up[2] * lift,
          ],
          size: [1, railH, len],
          rot: [pitch, yaw, 0],
        });
      }
    }
  }

  // Départ (rampe inclinée) puis descente régulière, un léger virage, arrivée plate.
  seg("start", 0, 22, 0, 14, 16, 0, true);
  seg("track", 0, 15.8, 19, 20, 16, 0, true);
  seg("track", 0, 10.2, 37, 20, 14, 8, true);
  seg("track", 5, 5.6, 54, 20, 12, 20, true);
  seg("track", 13, 2.2, 69, 18, 8, 12, true);
  seg("finish", 20, 0, 84, 16, 0, 0, false);
  return out;
}

const MARBLE_RACE: GameTypeDef = {
  id: "marble-race",
  label: "Course de billes",
  roles: ROLES,
  defaultPlatforms: buildDefaultTrack(),
};

export const GAME_TYPES: Record<string, GameTypeDef> = {
  "marble-race": MARBLE_RACE,
};

export function getGameType(id: string): GameTypeDef | undefined {
  return GAME_TYPES[id];
}

// Crée une plateforme neuve avec des valeurs par défaut selon son rôle.
export function newPlatform(role: PlatformRole, pos?: [number, number, number]): Platform {
  const def = roleDef(role);
  return {
    id: nid(role),
    role,
    pos: pos ?? [0, 8, 0],
    size: [...def.size] as [number, number, number],
    rot: [0, 0, 0],
    color: undefined,
  };
}
