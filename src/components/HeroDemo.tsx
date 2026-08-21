"use client";

import { useEffect, useRef, useState } from "react";

// Démo animée du hero : un aperçu du type de jeu "battle" qui tourne
// en boucle. Purement décoratif.
export default function HeroDemo() {
  const [a, setA] = useState(52);
  const [viewers, setViewers] = useState(1284);
  const aRef = useRef(52);
  const vRef = useRef(1284);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;

    const t1 = setInterval(() => {
      let next = aRef.current + (Math.random() * 8 - 4);
      if (next < 30) next = 30;
      if (next > 70) next = 70;
      aRef.current = next;
      setA(Math.round(next));
    }, 1400);

    const t2 = setInterval(() => {
      let n = vRef.current + Math.floor(Math.random() * 24 - 9);
      if (n < 800) n = 800;
      vRef.current = n;
      setViewers(n);
    }, 2000);

    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, []);

  const b = 100 - a;

  return (
    <div className="demo" aria-hidden="true">
      <div className="demo-top">
        <span className="live-badge">
          <span className="rec" /> LIVE
        </span>
        <span
          style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}
        >
          Battle royale des équipes
        </span>
        <span className="viewers">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>{" "}
          <b>{viewers.toLocaleString("fr-FR")}</b>
        </span>
      </div>
      <div className="demo-stage">
        <div className="demo-title">
          🔥 Team Feu &nbsp;vs&nbsp; 💧 Team Eau
        </div>
        <div className="demo-sub">
          Commente <b>1</b> ou <b>2</b> pour soutenir ton équipe
        </div>
        <div className="team">
          <div className="team-row">
            <span className="name">🔥 Team Feu</span>
            <span className="val">{a}%</span>
          </div>
          <div className="bar a">
            <span style={{ width: `${a}%` }} />
          </div>
        </div>
        <div className="team">
          <div className="team-row">
            <span className="name">💧 Team Eau</span>
            <span className="val">{b}%</span>
          </div>
          <div className="bar b">
            <span style={{ width: `${b}%` }} />
          </div>
        </div>
      </div>
      <div className="ticker">
        <div className="ticker-track">
          <div className="cmt">
            <b>@lucas_ttk</b> : allez la team feu 🔥🔥
          </div>
          <div className="cmt">
            <b>@marie.lv</b> : 2 !!! l&apos;eau gagne 💧
          </div>
          <div className="cmt">
            <b>@noah___</b> : trop stylé ce jeu
          </div>
          <div className="cmt">
            <b>@sofia_g</b> : 1 pour le feu allez
          </div>
          <div className="cmt">
            <b>@lucas_ttk</b> : allez la team feu 🔥🔥
          </div>
        </div>
      </div>
    </div>
  );
}
