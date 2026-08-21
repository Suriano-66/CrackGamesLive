"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TikTokSettings({
  initial,
}: {
  initial: string | null;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/overlay/tiktok", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Impossible d'enregistrer.");
      return;
    }
    setUsername(data.username ?? "");
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  const clean = username.replace(/^@+/, "");

  return (
    <form onSubmit={save}>
      {error && <div className="form-error">{error}</div>}
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="ttk">Ton pseudo TikTok</label>
        <input
          id="ttk"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@ton_pseudo"
          autoComplete="off"
        />
      </div>
      <button className="btn btn-primary" type="submit" disabled={saving}>
        {saving ? "Enregistrement…" : saved ? "✓ Enregistré" : "Enregistrer"}
      </button>

      {clean && (
        <div className="cmd-hint">
          <p>
            Quand tu passes en live, lance le connecteur TikTok dans un terminal :
          </p>
          <code>npm run tiktok -- @{clean}</code>
          <p className="muted">
            Laisse ce terminal ouvert pendant ton live : il envoie les cadeaux au
            jeu en temps réel.
          </p>
        </div>
      )}
    </form>
  );
}
