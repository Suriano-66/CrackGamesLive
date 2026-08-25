"use client";

import { useEffect, useState } from "react";
import MarbleRace3D from "@/components/games/MarbleRace3D";

// Port par défaut du worker TikTok (voir scripts/tiktok-worker.mjs).
const WS_PORT = 3002;

// Choisit et rend le bon jeu selon le slug, et construit l'URL du flux
// temps réel (worker TikTok) côté navigateur.
export default function OverlayGame({
  slug,
  level,
}: {
  slug: string;
  level?: { platforms: unknown[]; settings?: Record<string, unknown> } | null;
}) {
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  useEffect(() => {
    const host = window.location.hostname || "localhost";
    setWsUrl(`ws://${host}:${WS_PORT}`);
  }, []);

  if (slug === "grande-course") {
    // demo=true : tant que le worker TikTok n'est pas connecté, une
    // simulation tourne pour ne pas laisser l'écran vide.
    return <MarbleRace3D wsUrl={wsUrl} demo level={level ?? undefined} />;
  }

  return null;
}
