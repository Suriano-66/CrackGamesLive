"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Game = { id: string; slug: string; title: string; emoji: string };

export default function StreamLinks({
  token,
  games,
}: {
  token: string;
  games: Game[];
}) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // On construit l'URL depuis l'origine réelle du navigateur (robuste).
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  function linkFor(slug: string) {
    return `${origin}/overlay/${token}/${slug}`;
  }

  async function copy(slug: string) {
    const url = linkFor(slug);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Repli si l'API clipboard est bloquée.
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(slug);
    setTimeout(() => setCopied((c) => (c === slug ? null : c)), 1800);
  }

  async function regenerate() {
    if (
      !window.confirm(
        "Régénérer tes liens ? Les anciens liens cesseront de fonctionner dans OBS et devront être remplacés.",
      )
    )
      return;
    setResetting(true);
    const res = await fetch("/api/overlay/token", { method: "POST" });
    setResetting(false);
    if (res.ok) {
      router.refresh();
    } else {
      alert("Impossible de régénérer les liens.");
    }
  }

  return (
    <div className="links">
      {games.map((g) => (
        <div className="link-row" key={g.id}>
          <div className="link-game">
            {g.emoji} {g.title}
          </div>
          <input
            className="link-input"
            readOnly
            value={linkFor(g.slug)}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            className={`mini-btn ${copied === g.slug ? "on" : ""}`}
            onClick={() => copy(g.slug)}
          >
            {copied === g.slug ? "✓ Copié" : "Copier"}
          </button>
        </div>
      ))}

      <div className="links-foot">
        <p>
          Colle un de ces liens dans OBS via <b>+ → Source navigateur</b>. Garde
          ces liens secrets : ils donnent accès à tes overlays.
        </p>
        <button
          className="mini-btn off"
          onClick={regenerate}
          disabled={resetting}
        >
          {resetting ? "Régénération…" : "Régénérer mes liens"}
        </button>
      </div>
    </div>
  );
}
