"use client";

import { useEffect, useState } from "react";

// Petit compte à rebours décoratif pour la carte de jeu "Compte à rebours".
export default function MiniCountdown() {
  const [c, setC] = useState(60);
  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;
    const t = setInterval(() => setC((v) => (v <= 0 ? 60 : v - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return <span>{c}</span>;
}
