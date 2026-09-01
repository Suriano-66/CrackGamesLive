// Salles de co-édition en mémoire — une salle par niveau. Chaque salle garde :
//  • ses clients connectés (flux SSE),
//  • l'ÉTAT courant du niveau (pièces + réglages), qui fait autorité pendant la
//    session : un nouvel arrivant reçoit cet état à jour (et non la base,
//    potentiellement en retard), et l'état est enregistré en base par à-coups
//    puis au départ du dernier éditeur — donc aucun travail perdu si celui qui
//    a fait la dernière modif se déconnecte avant d'avoir sauvegardé.
//
// LIMITE ASSUMÉE : l'état vit dans le processus (une instance Render). Suffisant
// pour vous ; à l'échelle multi-instances il faudrait un relais (Redis).

// `camera` est facultative : un Studio plus ancien n'en envoie pas, et les
// fantômes s'affichent alors simplement sans repère de vue.
export interface Camera {
  pos: number[];
  cible: number[];
}
export interface Presence {
  name: string;
  color: string;
  selection: string[];
  camera?: Camera | null;
}
export interface Client {
  id: string;
  userId: string | null;
  presence: Presence;
  send: (evt: string, data: unknown) => void;
}
type Piece = Record<string, unknown> & { id: string };
export interface Snapshot {
  platforms: Piece[];
  settings: Record<string, unknown>;
}
type SaveFn = (snap: Snapshot) => Promise<void>;

interface Room {
  clients: Map<string, Client>;
  pieces: Map<string, Piece>;
  settings: Record<string, unknown>;
  loaded: boolean; // l'état a-t-il été chargé depuis la base ?
  dirty: boolean;
  saveTimer: ReturnType<typeof setTimeout> | null;
  save: SaveFn | null;
}

const SAVE_DEBOUNCE_MS = 2500;

// Accroché à globalThis : survit au rechargement à chaud de Next.js en dev.
const g = globalThis as unknown as { __collabRooms?: Map<string, Room> };
const rooms: Map<string, Room> = g.__collabRooms ?? (g.__collabRooms = new Map());

function room(levelId: string): Room {
  let r = rooms.get(levelId);
  if (!r) {
    r = { clients: new Map(), pieces: new Map(), settings: {}, loaded: false, dirty: false, saveTimer: null, save: null };
    rooms.set(levelId, r);
  }
  return r;
}

function snapOf(r: Room): Snapshot {
  return { platforms: [...r.pieces.values()], settings: r.settings };
}

// ───────────── État du niveau ─────────────
export function isLoaded(levelId: string): boolean {
  return !!rooms.get(levelId)?.loaded;
}
// Amorce l'état depuis la base au premier arrivant (idempotent).
export function seed(levelId: string, platforms: readonly { id: string }[], settings: Record<string, unknown>, save: SaveFn): void {
  const r = room(levelId);
  if (r.loaded) return;
  r.pieces = new Map((platforms || []).filter((p) => p && p.id).map((p) => [p.id, p as Piece]));
  r.settings = settings || {};
  r.loaded = true;
  r.save = save;
}
export function snapshot(levelId: string): Snapshot | null {
  const r = rooms.get(levelId);
  return r ? snapOf(r) : null;
}
// Applique une opération à l'état de la salle et programme une sauvegarde.
export function applyOp(levelId: string, op: unknown): void {
  const r = rooms.get(levelId);
  if (!r || !op || typeof op !== "object") return;
  const o = op as { type?: string; piece?: Piece; id?: string; settings?: Record<string, unknown> };
  if (o.type === "upsert" && o.piece && o.piece.id) r.pieces.set(o.piece.id, o.piece);
  else if (o.type === "remove" && o.id) r.pieces.delete(o.id);
  else if (o.type === "settings" && o.settings) r.settings = o.settings;
  else return;
  r.dirty = true;
  scheduleSave(r);
}
function scheduleSave(r: Room): void {
  if (!r.save || r.saveTimer) return;
  r.saveTimer = setTimeout(async () => {
    r.saveTimer = null;
    if (!r.dirty || !r.save) return;
    r.dirty = false;
    try {
      await r.save(snapOf(r));
    } catch {
      /* réessai à la prochaine op ou au départ du dernier client */
      r.dirty = true;
    }
  }, SAVE_DEBOUNCE_MS);
}

// ───────────── Présence / diffusion ─────────────
export function join(levelId: string, client: Client): void {
  room(levelId).clients.set(client.id, client);
}
export function leave(levelId: string, clientId: string): void {
  const r = rooms.get(levelId);
  if (!r) return;
  r.clients.delete(clientId);
  if (r.clients.size > 0) return;
  // Dernier parti : on enregistre l'état final tout de suite, puis on oublie la salle.
  if (r.saveTimer) {
    clearTimeout(r.saveTimer);
    r.saveTimer = null;
  }
  const finalSnap = snapOf(r);
  const save = r.save;
  const wasDirty = r.dirty;
  rooms.delete(levelId);
  if (wasDirty && save) save(finalSnap).catch(() => {});
}
export function peers(levelId: string, exceptId?: string) {
  const r = rooms.get(levelId);
  if (!r) return [] as Array<{ id: string; name: string; color: string; selection: string[]; camera: Camera | null }>;
  return [...r.clients.values()]
    .filter((c) => c.id !== exceptId)
    .map((c) => ({
      id: c.id,
      name: c.presence.name,
      color: c.presence.color,
      selection: c.presence.selection,
      camera: c.presence.camera ?? null,
    }));
}
export function getClient(levelId: string, clientId: string): Client | undefined {
  return rooms.get(levelId)?.clients.get(clientId);
}
export function broadcast(levelId: string, evt: string, data: unknown, exceptId?: string): void {
  const r = rooms.get(levelId);
  if (!r) return;
  for (const c of r.clients.values()) {
    if (c.id === exceptId) continue;
    try {
      c.send(evt, data);
    } catch {
      /* client mort : retiré à sa fermeture */
    }
  }
}
export function roomSize(levelId: string): number {
  return rooms.get(levelId)?.clients.size ?? 0;
}
