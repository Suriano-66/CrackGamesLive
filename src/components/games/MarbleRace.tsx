"use client";

import { useEffect, useRef } from "react";
import { useGameFeed } from "@/components/games/useGameFeed";
import {
  marblesForGift,
  MAX_MARBLES_PER_PLAYER,
  type GameEvent,
} from "@/lib/gameEvents";

// ---------------------------------------------------------------------------
// Paramètres
// ---------------------------------------------------------------------------
const WORLD_H = 2200;
const BASE_W = 900;
const W_PER_PLAYER = 26; // le plateau s'élargit avec le nombre de joueurs
const MAX_WORLD_W = 2000;
const MARBLE_R = 11;
const MAX_LIVE_MARBLES = 240; // garde-fou perf
const RACE_MAX_MS = 55000;
const INTERMISSION_MS = 7000;
const CAM_SWITCH_MS = 5200;

type Phase = "filling" | "racing" | "intermission";

interface Player {
  id: string;
  name: string;
  avatarUrl: string;
  img: HTMLImageElement | null;
  color: string;
  ballCount: number; // niveau cumulé (cap 100)
  full: boolean;
  finishRank: number | null; // ordre d'arrivée dans la course en cours
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

interface Props {
  wsUrl?: string | null;
  demo?: boolean;
}

export default function MarbleRace({ wsUrl, demo }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Boîte d'état mutable partagée avec la boucle de jeu.
  const stateRef = useRef<any>(null);

  // File d'événements entrants (consommée dans la boucle de jeu).
  const eventQueue = useRef<GameEvent[]>([]);
  const { connected } = useGameFeed({
    wsUrl,
    demo,
    onEvent: (e) => eventQueue.current.push(e),
  });
  const connectedRef = useRef(connected);
  connectedRef.current = connected;

  useEffect(() => {
    let raf = 0;
    let disposed = false;
    let Matter: any;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    // ----- état du jeu -----
    const S = {
      engine: null as any,
      worldW: BASE_W,
      players: new Map<string, Player>(),
      marbles: [] as any[], // corps matter des billes
      spawnQueue: [] as { p: Player }[],
      course: [] as any[], // { body, kind } pour le rendu
      spinners: [] as any[],
      finishY: WORLD_H - 70,
      phase: "filling" as Phase,
      phaseStart: 0,
      raceStart: 0,
      finishOrder: [] as Player[],
      cam: { cx: BASE_W / 2, cy: WORLD_H / 2, zoom: 0.3 },
      camTarget: { cx: BASE_W / 2, cy: WORLD_H / 2, zoom: 0.3 },
      camMode: 0,
      camModeStart: 0,
      lastNudge: 0,
      seed: 1,
      winner: null as Player | null,
    };
    stateRef.current = S;

    function rnd() {
      // PRNG déterministe par course (pour des maps variées mais stables).
      S.seed = (S.seed * 1103515245 + 12345) & 0x7fffffff;
      return S.seed / 0x7fffffff;
    }

    // ------------------------------------------------------------------
    // Génération du parcours (Plinko + déflecteurs + spinners)
    // ------------------------------------------------------------------
    function buildCourse() {
      const { World, Bodies, Composite } = Matter;
      // vide le monde
      Composite.clear(S.engine.world, false);
      S.course = [];
      S.spinners = [];
      S.marbles = [];

      const nPlayers = Math.max(1, S.players.size);
      S.worldW = Math.min(MAX_WORLD_W, BASE_W + nPlayers * W_PER_PLAYER);
      const W = S.worldW;
      const wallOpts = { isStatic: true, restitution: 0.2, friction: 0.02 };

      // Murs latéraux
      S.course.push({ body: Bodies.rectangle(-20, WORLD_H / 2, 40, WORLD_H * 2, wallOpts), kind: "wall" });
      S.course.push({ body: Bodies.rectangle(W + 20, WORLD_H / 2, 40, WORLD_H * 2, wallOpts), kind: "wall" });

      // Entonnoir haut pour rassembler les billes
      const funnelY = 210;
      S.course.push({ body: Bodies.rectangle(W * 0.16, funnelY, W * 0.5, 16, { ...wallOpts, angle: 0.32 }), kind: "bar" });
      S.course.push({ body: Bodies.rectangle(W * 0.84, funnelY, W * 0.5, 16, { ...wallOpts, angle: -0.32 }), kind: "bar" });

      // Champs de pegs (style Plinko) — garantit un flux descendant sans blocage
      const topY = 380;
      const bottomY = WORLD_H - 260;
      const rows = 12;
      const rowGap = (bottomY - topY) / rows;
      for (let r = 0; r < rows; r++) {
        const y = topY + r * rowGap;
        const offset = r % 2 === 0 ? 0 : 0.5;
        const cols = Math.max(5, Math.floor(W / 95));
        const colGap = W / cols;
        for (let c = 0; c <= cols; c++) {
          const jitter = (rnd() - 0.5) * 14;
          const x = (c + offset) * colGap + jitter;
          if (x < 30 || x > W - 30) continue;
          const peg = Bodies.circle(x, y, 7 + rnd() * 3, { isStatic: true, restitution: 0.5, friction: 0.02 });
          S.course.push({ body: peg, kind: "peg" });
        }
      }

      // Quelques déflecteurs inclinés
      const nBars = 3 + Math.floor(rnd() * 3);
      for (let i = 0; i < nBars; i++) {
        const y = topY + rnd() * (bottomY - topY);
        const x = 90 + rnd() * (W - 180);
        const len = 90 + rnd() * 130;
        const ang = (rnd() - 0.5) * 1.1;
        S.course.push({
          body: Bodies.rectangle(x, y, len, 16, { isStatic: true, angle: ang, restitution: 0.4, friction: 0.02, chamfer: { radius: 8 } }),
          kind: "bar",
        });
      }

      // Spinners (portes tournantes) — batifolent les billes, jamais de blocage
      const nSpin = 2 + Math.floor(rnd() * 2);
      for (let i = 0; i < nSpin; i++) {
        const y = topY + 120 + rnd() * (bottomY - topY - 200);
        const x = 120 + rnd() * (W - 240);
        const len = 120 + rnd() * 90;
        const body = Bodies.rectangle(x, y, len, 18, { isStatic: true, restitution: 0.6, chamfer: { radius: 9 } });
        const spin = { body, speed: (rnd() < 0.5 ? 1 : -1) * (0.02 + rnd() * 0.03) };
        S.spinners.push(spin);
        S.course.push({ body, kind: "spin" });
      }

      World.add(
        S.engine.world,
        S.course.map((c) => c.body),
      );
    }

    // ------------------------------------------------------------------
    // Billes
    // ------------------------------------------------------------------
    function spawnMarble(p: Player) {
      if (S.marbles.length >= MAX_LIVE_MARBLES) return;
      const { World, Bodies } = Matter;
      const W = S.worldW;
      const x = W * 0.25 + rnd() * W * 0.5;
      const y = 80 + rnd() * 60;
      const b = Bodies.circle(x, y, MARBLE_R, {
        restitution: 0.35,
        friction: 0.02,
        frictionAir: 0.004,
        density: 0.02,
      });
      b.playerId = p.id;
      b.finished = false;
      Matter.Body.setVelocity(b, { x: (rnd() - 0.5) * 2, y: 0 });
      S.marbles.push(b);
      World.add(S.engine.world, b);
    }

    function queueSpawns(p: Player, n: number) {
      for (let i = 0; i < n; i++) S.spawnQueue.push({ p });
    }

    // ------------------------------------------------------------------
    // Événements (cadeaux)
    // ------------------------------------------------------------------
    function ensurePlayer(id: string, name: string, avatar: string): Player {
      let p = S.players.get(id);
      if (!p) {
        const hue = hashHue(id);
        p = {
          id,
          name: name || "Viewer",
          avatarUrl: avatar || "",
          img: null,
          color: `hsl(${hue} 85% 58%)`,
          ballCount: 0,
          full: false,
          finishRank: null,
        };
        if (avatar) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = avatar;
          p.img = img;
        }
        S.players.set(id, p);
      } else if (avatar && !p.avatarUrl) {
        p.avatarUrl = avatar;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = avatar;
        p.img = img;
      }
      return p;
    }

    function handleGift(userId: string, nickname: string, avatar: string, diamonds: number, count: number) {
      const p = ensurePlayer(userId, nickname, avatar);
      if (p.ballCount >= MAX_MARBLES_PER_PLAYER) {
        p.full = true;
        return; // déjà full → cadeau = donation, aucune bille ajoutée
      }
      const add = marblesForGift(diamonds, count);
      const before = p.ballCount;
      p.ballCount = Math.min(MAX_MARBLES_PER_PLAYER, p.ballCount + add);
      if (p.ballCount >= MAX_MARBLES_PER_PLAYER) p.full = true;
      const gained = p.ballCount - before;
      // Pendant une course, les nouvelles billes rejoignent le plateau.
      if (S.phase !== "intermission" && gained > 0) queueSpawns(p, gained);
    }

    function drainEvents() {
      const q = eventQueue.current;
      while (q.length) {
        const e = q.shift()!;
        if (e.type === "gift") {
          handleGift(e.userId, e.nickname, e.avatar, e.diamonds, e.count);
        }
        // les autres types (chat/connected) sont ignorés pour ce jeu
      }
    }

    // ------------------------------------------------------------------
    // Cycle de course
    // ------------------------------------------------------------------
    function startRace(now: number) {
      S.seed = Math.floor((now % 100000) + S.players.size * 7 + 1);
      S.finishOrder = [];
      S.winner = null;
      S.spawnQueue = [];
      for (const p of S.players.values()) p.finishRank = null;
      buildCourse();
      // Lâche les billes de chaque joueur selon son niveau.
      for (const p of S.players.values()) queueSpawns(p, p.ballCount);
      S.phase = S.players.size === 0 ? "filling" : "racing";
      S.phaseStart = now;
      S.raceStart = now;
      S.camMode = 0;
      S.camModeStart = now;
    }

    function endRace(now: number) {
      S.phase = "intermission";
      S.phaseStart = now;
      S.winner = S.finishOrder[0] ?? null;
    }

    // ------------------------------------------------------------------
    // Boucle principale
    // ------------------------------------------------------------------
    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function playRect() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const panelW = w > 780 ? 300 : 0;
      return { x: 12, y: 64, w: w - panelW - 24, h: h - 150, panelW };
    }

    function updateCamera(now: number, pr: { x: number; y: number; w: number; h: number }) {
      const fullZoom = Math.min(pr.w / S.worldW, pr.h / WORLD_H) * 0.98;
      let t = { cx: S.worldW / 2, cy: WORLD_H / 2, zoom: fullZoom };

      if (S.phase === "racing") {
        if (now - S.camModeStart > CAM_SWITCH_MS) {
          S.camMode = (S.camMode + 1) % 3;
          S.camModeStart = now;
        }
        const active = S.marbles.filter((m) => !m.finished);
        if (S.camMode === 1 && active.length) {
          // Leader (bille la plus basse)
          let lead = active[0];
          for (const m of active) if (m.position.y > lead.position.y) lead = m;
          t = { cx: lead.position.x, cy: lead.position.y, zoom: fullZoom * 2.4 };
        } else if (S.camMode === 2 && active.length) {
          // Dernier (bille la plus haute)
          let last = active[0];
          for (const m of active) if (m.position.y < last.position.y) last = m;
          t = { cx: last.position.x, cy: last.position.y, zoom: fullZoom * 2.4 };
        }
      }
      // Clamp du centre pour rester près du monde
      const halfW = pr.w / (2 * t.zoom);
      const halfH = pr.h / (2 * t.zoom);
      t.cx = Math.max(halfW, Math.min(S.worldW - halfW, t.cx));
      t.cy = Math.max(halfH, Math.min(WORLD_H - halfH, t.cy));
      if (!isFinite(t.cx)) t.cx = S.worldW / 2;
      if (!isFinite(t.cy)) t.cy = WORLD_H / 2;

      S.camTarget = t;
      const k = 0.07;
      S.cam.cx += (t.cx - S.cam.cx) * k;
      S.cam.cy += (t.cy - S.cam.cy) * k;
      S.cam.zoom += (t.zoom - S.cam.zoom) * k;
    }

    function w2s(wx: number, wy: number, pr: any) {
      return {
        x: (wx - S.cam.cx) * S.cam.zoom + pr.x + pr.w / 2,
        y: (wy - S.cam.cy) * S.cam.zoom + pr.y + pr.h / 2,
      };
    }

    function step(now: number) {
      if (disposed) return;
      raf = requestAnimationFrame(step);

      drainEvents();

      // Transitions de phase
      if (S.phase === "filling") {
        // Démarre dès qu'il y a au moins 1 joueur et un petit délai.
        if (S.players.size > 0 && now - S.phaseStart > 2500) startRace(now);
      } else if (S.phase === "racing") {
        const active = S.marbles.filter((m) => !m.finished);
        const done = now - S.raceStart > RACE_MAX_MS;
        if ((active.length === 0 && S.marbles.length > 0) || done) endRace(now);
        if (S.marbles.length === 0 && now - S.raceStart > 6000) endRace(now);
      } else if (S.phase === "intermission") {
        if (now - S.phaseStart > INTERMISSION_MS) startRace(now);
      }

      // Spawns progressifs (quelques billes par frame)
      let budget = 4;
      while (budget-- > 0 && S.spawnQueue.length) {
        const it = S.spawnQueue.shift()!;
        spawnMarble(it.p);
      }

      // Spinners
      for (const s of S.spinners) {
        Matter.Body.setAngle(s.body, s.body.angle + s.speed);
      }

      // Physique
      if (S.engine) Matter.Engine.update(S.engine, 1000 / 60);

      // Anti-blocage : petit coup de pouce aux billes trop lentes
      if (now - S.lastNudge > 650) {
        S.lastNudge = now;
        for (const m of S.marbles) {
          if (m.finished) continue;
          const v = Math.hypot(m.velocity.x, m.velocity.y);
          if (v < 0.35) {
            Matter.Body.applyForce(m, m.position, {
              x: (rnd() - 0.5) * 0.0009 * m.mass,
              y: 0.0006 * m.mass,
            });
          }
        }
      }

      // Détection d'arrivée
      for (const m of S.marbles) {
        if (!m.finished && m.position.y >= S.finishY) {
          m.finished = true;
          const p = S.players.get(m.playerId);
          if (p && p.finishRank == null) {
            p.finishRank = S.finishOrder.length + 1;
            S.finishOrder.push(p);
          }
          Matter.World.remove(S.engine.world, m);
        }
        // Filet de sécurité : bille hors-monde
        if (!m.finished && (m.position.y > WORLD_H + 400 || m.position.x < -300 || m.position.x > S.worldW + 300)) {
          m.finished = true;
          Matter.World.remove(S.engine.world, m);
        }
      }
      S.marbles = S.marbles.filter((m) => !m.finished);

      render(now);
    }

    // ------------------------------------------------------------------
    // Rendu
    // ------------------------------------------------------------------
    function roundRect(x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function drawAvatar(p: Player, x: number, y: number, r: number) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();
      if (p.img && p.img.complete && p.img.naturalWidth > 0) {
        ctx.clip();
        try {
          ctx.drawImage(p.img, x - r, y - r, r * 2, r * 2);
        } catch {
          /* image tainted : on garde le fond couleur */
        }
      } else {
        ctx.clip();
        ctx.fillStyle = "rgba(0,0,0,.25)";
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = "#fff";
        ctx.font = `700 ${r}px "Hanken Grotesk", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((p.name[0] || "?").toUpperCase(), x, y + 1);
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    function render(now: number) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const pr = playRect();
      ctx.clearRect(0, 0, w, h);
      updateCamera(now, pr);

      // Panneau de la zone de jeu (translucide, lisible sur webcam)
      ctx.save();
      roundRect(pr.x, pr.y, pr.w, pr.h, 18);
      ctx.fillStyle = "rgba(8,10,16,.55)";
      ctx.fill();
      ctx.clip(); // le monde ne déborde pas de la zone

      // Obstacles
      for (const c of S.course) {
        const b = c.body;
        if (c.kind === "wall") continue;
        const s = w2s(b.position.x, b.position.y, pr);
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(b.angle);
        if (c.kind === "peg") {
          const rr = (b.circleRadius || 8) * S.cam.zoom;
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(1.5, rr), 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,.55)";
          ctx.fill();
        } else {
          const bw = (b.bounds.max.x - b.bounds.min.x);
          // largeur approx via vertices
          const verts = b.vertices;
          ctx.beginPath();
          const first = w2sLocal(verts[0], b, S.cam.zoom);
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < verts.length; i++) {
            const v = w2sLocal(verts[i], b, S.cam.zoom);
            ctx.lineTo(v.x, v.y);
          }
          ctx.closePath();
          ctx.fillStyle = c.kind === "spin" ? "rgba(255,60,95,.85)" : "rgba(150,170,200,.8)";
          ctx.fill();
          void bw;
        }
        ctx.restore();
      }

      // Ligne d'arrivée
      const f1 = w2s(0, S.finishY, pr);
      const f2 = w2s(S.worldW, S.finishY, pr);
      ctx.save();
      ctx.strokeStyle = "rgba(53,208,160,.9)";
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.moveTo(f1.x, f1.y);
      ctx.lineTo(f2.x, f2.y);
      ctx.stroke();
      ctx.restore();

      // Billes
      const leadByPlayer = new Map<string, any>();
      for (const m of S.marbles) {
        const prev = leadByPlayer.get(m.playerId);
        if (!prev || m.position.y > prev.position.y) leadByPlayer.set(m.playerId, m);
      }
      for (const m of S.marbles) {
        const p = S.players.get(m.playerId);
        const s = w2s(m.position.x, m.position.y, pr);
        const rr = MARBLE_R * S.cam.zoom;
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(2, rr), 0, Math.PI * 2);
        ctx.fillStyle = p?.color || "#fff";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Étiquettes (avatar + pseudo) au-dessus de la bille de tête de chaque joueur
      const labels = Array.from(leadByPlayer.values())
        .map((m) => ({ m, p: S.players.get(m.playerId)! }))
        .filter((o) => o.p)
        .sort((a, b) => a.m.position.y - b.m.position.y)
        .slice(-14); // limite pour éviter la surcharge
      for (const { m, p } of labels) {
        const s = w2s(m.position.x, m.position.y, pr);
        const ar = Math.max(9, Math.min(18, 15 * S.cam.zoom + 6));
        const ay = s.y - ar - 12;
        drawAvatar(p, s.x, ay, ar);
        // pseudo
        ctx.font = '700 12px "Hanken Grotesk", sans-serif';
        ctx.textAlign = "center";
        const tw = ctx.measureText(p.name).width;
        roundRect(s.x - tw / 2 - 6, ay + ar + 3, tw + 12, 16, 8);
        ctx.fillStyle = "rgba(8,10,16,.7)";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textBaseline = "middle";
        ctx.fillText(p.name, s.x, ay + ar + 12);
        if (p.full) {
          ctx.fillText("⚠️", s.x + tw / 2 + 14, ay + ar + 12);
        }
      }
      ctx.restore(); // clip zone de jeu

      // ---- HUD ----
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.font = '800 26px "Bricolage Grotesque", sans-serif';
      ctx.fillStyle = "#fff";
      ctx.fillText("🏁 La grande course", pr.x + 4, 44);

      // état / minuteur
      ctx.font = '700 14px "JetBrains Mono", monospace';
      let statusTxt = "";
      if (S.phase === "filling") statusTxt = "En attente de billes…";
      else if (S.phase === "racing") {
        const left = Math.max(0, Math.ceil((RACE_MAX_MS - (now - S.raceStart)) / 1000));
        statusTxt = `Course en cours · ${left}s`;
      } else statusTxt = "Résultats…";
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.textAlign = "right";
      ctx.fillText(statusTxt, pr.x + pr.w, 44);

      // Bandeau bas : consigne + légende
      ctx.textAlign = "left";
      ctx.font = '600 14px "Hanken Grotesk", sans-serif';
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.fillText("🎁 Offre un cadeau pour lâcher tes billes ! (cumul jusqu'à 100)", pr.x + 4, h - 42);
      ctx.fillStyle = connectedRef.current ? "rgba(53,208,160,.95)" : "rgba(255,194,75,.95)";
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText(connectedRef.current ? "● TikTok connecté" : "● Mode démo", pr.x + 4, h - 22);

      // ---- Classement ----
      if (pr.panelW) {
        drawLeaderboard(w - pr.panelW + 0, 64, pr.panelW - 12, h - 150);
      }

      // ---- Intermission / podium ----
      if (S.phase === "intermission" && S.winner) {
        drawPodium(pr);
      }
    }

    function drawLeaderboard(x: number, y: number, w: number, h: number) {
      roundRect(x, y, w, h, 16);
      ctx.fillStyle = "rgba(8,10,16,.6)";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = '800 16px "Bricolage Grotesque", sans-serif';
      ctx.textAlign = "left";
      ctx.fillText("🏆 Classement", x + 14, y + 26);

      // Ordre : arrivés d'abord (par rang), puis en course par progression, puis en attente
      const arrived = [...S.finishOrder];
      const arrivedSet = new Set(arrived.map((p) => p.id));
      const racing = Array.from(S.players.values())
        .filter((p) => !arrivedSet.has(p.id))
        .map((p) => {
          const ms = S.marbles.filter((m) => m.playerId === p.id);
          const bestY = ms.length ? Math.max(...ms.map((m) => m.position.y)) : -1;
          return { p, bestY };
        })
        .sort((a, b) => b.bestY - a.bestY)
        .map((o) => o.p);
      const ordered = [...arrived, ...racing].slice(0, 12);

      let ry = y + 44;
      let rank = 1;
      for (const p of ordered) {
        drawAvatar(p, x + 26, ry + 9, 13);
        ctx.fillStyle = "#fff";
        ctx.font = '700 13px "Hanken Grotesk", sans-serif';
        ctx.textAlign = "left";
        const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
        let label = `${medal} ${p.name}`;
        if (label.length > 18) label = label.slice(0, 18) + "…";
        ctx.fillText(label, x + 46, ry + 14);
        // billes
        ctx.textAlign = "right";
        ctx.fillStyle = p.full ? "rgba(255,194,75,.95)" : "rgba(255,255,255,.65)";
        ctx.font = '700 12px "JetBrains Mono", monospace';
        ctx.fillText(`${p.ballCount}${p.full ? " ⚠️" : "🔵"}`, x + w - 12, ry + 14);
        ry += 30;
        rank++;
        if (ry > y + h - 20) break;
      }
      if (S.players.size === 0) {
        ctx.fillStyle = "rgba(255,255,255,.5)";
        ctx.font = '500 13px "Hanken Grotesk", sans-serif';
        ctx.textAlign = "left";
        ctx.fillText("En attente de participants…", x + 14, y + 54);
      }
    }

    function drawPodium(pr: any) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.save();
      ctx.fillStyle = "rgba(8,10,16,.55)";
      roundRect(pr.x, pr.y, pr.w, pr.h, 18);
      ctx.fill();
      const cx = pr.x + pr.w / 2;
      const cy = pr.y + pr.h / 2;
      ctx.textAlign = "center";
      ctx.fillStyle = "#FFC24B";
      ctx.font = '800 30px "Bricolage Grotesque", sans-serif';
      ctx.fillText("🏆 Vainqueur", cx, cy - 90);
      const win = S.winner!;
      drawAvatar(win, cx, cy - 20, 46);
      ctx.fillStyle = "#fff";
      ctx.font = '800 28px "Bricolage Grotesque", sans-serif';
      ctx.fillText(win.name, cx, cy + 62);
      // top 3
      ctx.font = '600 15px "Hanken Grotesk", sans-serif';
      ctx.fillStyle = "rgba(255,255,255,.8)";
      const top = S.finishOrder.slice(0, 3).map((p, i) => `${["🥇", "🥈", "🥉"][i]} ${p.name}`).join("    ");
      ctx.fillText(top, cx, cy + 100);
      ctx.fillStyle = "rgba(255,255,255,.6)";
      ctx.font = '500 14px "Hanken Grotesk", sans-serif';
      ctx.fillText("Nouvelle course dans quelques secondes…", cx, cy + 132);
      ctx.restore();
    }

    // helper : vertex monde -> écran
    function w2sLocal(v: { x: number; y: number }, _b: any, _z: number) {
      const pr = playRect();
      return w2s(v.x, v.y, pr);
    }

    // ------------------------------------------------------------------
    // Démarrage
    // ------------------------------------------------------------------
    (async () => {
      Matter = (await import("matter-js")).default ?? (await import("matter-js"));
      if (disposed) return;
      const engine = Matter.Engine.create();
      engine.gravity.y = 1;
      engine.gravity.scale = 0.0012;
      S.engine = engine;
      buildCourse();
      S.phase = "filling";
      S.phaseStart = performance.now();
      resize();
      window.addEventListener("resize", resize);
      raf = requestAnimationFrame(step);
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", display: "block" }}
    />
  );
}
