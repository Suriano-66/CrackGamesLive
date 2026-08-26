"use client";

import { useEffect, useRef, useState } from "react";
import { useGameFeed } from "@/components/games/useGameFeed";
import type { GameEvent } from "@/lib/gameEvents";

interface BoardRow {
  rank: number;
  id: string;
  name: string;
  color: string;
  balls: number;
  full: boolean;
  avatar: string | null;
}
interface GameState {
  phase: "filling" | "countdown" | "racing" | "intermission";
  timer: number;
  count?: number;
  connected: boolean;
  players: number;
  board: BoardRow[];
  winner: { name: string; color: string; avatar: string | null } | null;
}

function Avatar({
  row,
  size,
  big,
}: {
  row: { color: string; name: string; avatar: string | null };
  size: string;
  big?: boolean;
}) {
  return (
    <span
      className={`lb-av${big ? " big" : ""}`}
      style={{ width: size, height: size, background: row.color }}
    >
      {row.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.avatar} alt="" />
      ) : (
        (row.name[0] || "?").toUpperCase()
      )}
    </span>
  );
}

export default function MarbleRace3D({
  wsUrl,
  demo,
  level,
}: {
  wsUrl?: string | null;
  demo?: boolean;
  level?: { platforms: unknown[]; settings?: Record<string, unknown> } | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<{
    handleEvent: (e: GameEvent) => void;
    setConnected: (v: boolean) => void;
    dispose: () => void;
  } | null>(null);
  const [st, setSt] = useState<GameState | null>(null);
  const levelRef = useRef(level);
  levelRef.current = level;
  // Recrée le moteur quand le niveau (plateformes ou réglages) change.
  const levelKey = JSON.stringify({
    p: level?.platforms ?? "default",
    s: level?.settings ?? null,
  });

  const { connected } = useGameFeed({
    wsUrl,
    demo,
    onEvent: (e) => engineRef.current?.handleEvent(e),
  });

  useEffect(() => {
    engineRef.current?.setConnected(connected);
  }, [connected]);

  useEffect(() => {
    let alive = true;
    let engine: { dispose: () => void } | null = null;
    (async () => {
      const mod = await import("@/components/games/marbleRaceEngine.js");
      if (!alive || !canvasRef.current) return;
      engine = mod.createMarbleRace3D(canvasRef.current, {
        onState: (s: GameState) => setSt(s),
        level: levelRef.current,
      });
      engineRef.current = engine as never;
    })();
    return () => {
      alive = false;
      engine?.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelKey]);

  const phase = st?.phase ?? "filling";
  const board = st?.board ?? [];

  return (
    <div className="mr3d">
      <canvas ref={canvasRef} className="mr3d-canvas" />

      {/* Bandeau haut */}
      <div className="mr3d-top">
        <div className="mr3d-title">🏁 La grande course</div>
        <div className="mr3d-status">
          {phase === "countdown" ? (
            <span className="mr3d-timer">{st?.count ?? 3}…</span>
          ) : phase === "racing" ? (
            <span className="mr3d-timer">⏱ {st?.timer ?? 0}s</span>
          ) : phase === "filling" ? (
            <span>En attente de billes…</span>
          ) : (
            <span>Résultats…</span>
          )}
        </div>
      </div>

      {/* Classement */}
      <div className="mr3d-board">
        <div className="mr3d-board-h">🏆 Classement</div>
        {board.length === 0 && (
          <div className="mr3d-empty">En attente de participants…</div>
        )}
        {board.map((r) => (
          <div className="lb-row" key={r.id}>
            <span className="lb-rank">
              {r.rank === 1
                ? "🥇"
                : r.rank === 2
                  ? "🥈"
                  : r.rank === 3
                    ? "🥉"
                    : r.rank}
            </span>
            <Avatar row={r} size="5cqw" />
            <span className="lb-name">{r.name}</span>
            <span className={`lb-balls${r.full ? " full" : ""}`}>
              {r.balls}
              {r.full ? " ⚠️" : ""}
            </span>
          </div>
        ))}
      </div>

      {/* Bandeau bas */}
      <div className="mr3d-bottom">
        <div className="mr3d-cta">🎁 Offre un cadeau pour lâcher tes billes !</div>
        <div className={`mr3d-conn ${st?.connected ? "on" : "off"}`}>
          ● {st?.connected ? "TikTok connecté" : "Mode démo"}
        </div>
      </div>

      {/* Gagnant */}
      {phase === "intermission" && st?.winner && (
        <div className="mr3d-winner">
          <div className="mr3d-winner-card">
            <div className="mr3d-winner-h">🏆 Vainqueur</div>
            <Avatar row={st.winner} size="18cqw" big />
            <div className="mr3d-winner-name">{st.winner.name}</div>
            <div className="mr3d-winner-sub">Nouvelle course imminente…</div>
          </div>
        </div>
      )}
    </div>
  );
}
