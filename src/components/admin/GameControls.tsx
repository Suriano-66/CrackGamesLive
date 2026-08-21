"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GameToggle({
  id,
  enabled,
}: {
  id: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setBusy(true);
    const res = await fetch("/api/admin/games", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled: next }),
    });
    setBusy(false);
    if (res.ok) {
      setOn(next);
      router.refresh();
    } else {
      alert("Impossible de mettre à jour le jeu.");
    }
  }

  return (
    <button
      className={`mini-btn ${on ? "on" : "off"}`}
      onClick={toggle}
      disabled={busy}
    >
      {on ? "● Activé" : "○ Désactivé"}
    </button>
  );
}

export function AddGameForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎮");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/admin/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, emoji, description }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Impossible d'ajouter le jeu.");
      return;
    }
    setTitle("");
    setEmoji("🎮");
    setDescription("");
    router.refresh();
  }

  return (
    <div className="add-game">
      <h3>Ajouter un jeu</h3>
      {error && <div className="admin-alert">{error}</div>}
      <form onSubmit={onSubmit}>
        <div className="add-row">
          <div className="field emoji">
            <label htmlFor="g-emoji">Emoji</label>
            <input
              id="g-emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={8}
            />
          </div>
          <div className="field grow">
            <label htmlFor="g-title">Titre</label>
            <input
              id="g-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Quiz express"
              required
            />
          </div>
          <div className="field grow">
            <label htmlFor="g-desc">Description</label>
            <input
              id="g-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Courte description"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Ajout…" : "Ajouter"}
          </button>
        </div>
      </form>
    </div>
  );
}
