import { caller } from "@/lib/levelApi";
import { isStaff } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { parseLevelData } from "@/lib/levels";
import * as collab from "@/lib/collab";

export const dynamic = "force-dynamic";
// Node obligatoire : on garde les salles EN MÉMOIRE entre les requêtes et on
// tient un flux SSE ouvert — l'edge ne le permet pas.
export const runtime = "nodejs";

// ───────────────────────────── Flux SSE ─────────────────────────────
// Le Studio ouvre ce flux à l'entrée dans un niveau : il reçoit l'accueil (son
// clientId + les pairs présents), puis en continu les opérations et la présence
// des autres, plus un ping de maintien.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const who = await caller(req);
  if (!who || !isStaff(who.role)) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;

  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId") || crypto.randomUUID();
  const name = (url.searchParams.get("name") || who.name || "Éditeur").slice(0, 40);
  const color = (url.searchParams.get("color") || "#5a9bff").slice(0, 24);

  // Première connexion à cette salle : on amorce l'état du niveau depuis la base.
  // La sauvegarde (debounce + départ du dernier) réécrit `data` avec l'état vivant.
  if (!collab.isLoaded(id)) {
    const lvl = await prisma.level.findUnique({ where: { id } });
    if (lvl) {
      const parsed = parseLevelData(lvl.data);
      collab.seed(id, parsed.platforms, parsed.settings || {}, async (snap) => {
        await prisma.level
          .update({ where: { id }, data: { data: JSON.stringify(snap) } })
          .catch(() => {});
      });
    }
  }

  const encoder = new TextEncoder();
  let closed = false;
  let ping: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (evt: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${evt}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* flux fermé */
        }
      };

      // Accueil : l'état à jour du niveau (snapshot) + les pairs déjà présents.
      // Le snapshot resynchronise un arrivant tardif ou une reconnexion.
      send("hello", { clientId, peers: collab.peers(id), snapshot: collab.snapshot(id) });

      collab.join(id, {
        id: clientId,
        userId: who.id,
        presence: { name, color, selection: [], camera: null },
        send,
      });
      collab.broadcast(id, "presence", { type: "join", id: clientId, name, color, selection: [], camera: null }, clientId);

      ping = setInterval(() => send("ping", Date.now()), 25000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (ping) clearInterval(ping);
        collab.leave(id, clientId);
        collab.broadcast(id, "presence", { type: "leave", id: clientId }, clientId);
        try {
          controller.close();
        } catch {
          /* déjà fermé */
        }
      };
      // Déconnexion du client (onglet fermé, réseau coupé…).
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      if (closed) return;
      closed = true;
      if (ping) clearInterval(ping);
      collab.leave(id, clientId);
      collab.broadcast(id, "presence", { type: "leave", id: clientId }, clientId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Empêche la mise en tampon par un proxy (sinon les événements n'arrivent
      // qu'à la fermeture du flux).
      "X-Accel-Buffering": "no",
    },
  });
}

// ─────────────────────────── Émission d'une op ───────────────────────────
// Le Studio POST ici une opération (pièce) ou une mise à jour de présence ; on
// la rediffuse à tous les AUTRES membres de la salle.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const who = await caller(req);
  if (!who || !isStaff(who.role)) return Response.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as
    | { clientId?: string; kind?: string; op?: unknown; selection?: string[]; camera?: collab.Camera | null }
    | null;
  if (!body || !body.clientId) return Response.json({ error: "bad_request" }, { status: 400 });

  if (body.kind === "op" && body.op) {
    // On applique l'op à l'état de la salle (pour le snapshot des futurs arrivants
    // et la persistance) PUIS on la rediffuse aux autres.
    collab.applyOp(id, body.op);
    collab.broadcast(id, "op", { from: body.clientId, op: body.op }, body.clientId);
  } else if (body.kind === "presence") {
    const c = collab.getClient(id, body.clientId);
    const selection = Array.isArray(body.selection) ? body.selection : [];
    // La caméra sert au repère « d'où il regarde » chez les autres éditeurs.
    const cam =
      body.camera && Array.isArray(body.camera.pos) && Array.isArray(body.camera.cible)
        ? { pos: body.camera.pos.slice(0, 3).map(Number), cible: body.camera.cible.slice(0, 3).map(Number) }
        : null;
    if (c) {
      c.presence.selection = selection;
      c.presence.camera = cam;
    }
    collab.broadcast(id, "presence", { type: "update", id: body.clientId, selection, camera: cam }, body.clientId);
  }
  return Response.json({ ok: true });
}
