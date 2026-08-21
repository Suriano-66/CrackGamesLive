"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AccessControl({
  userId,
  manualAccess,
  hasStripe,
}: {
  userId: string;
  manualAccess: boolean;
  hasStripe: boolean;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState("creator");
  const [duration, setDuration] = useState("1m");
  const [busy, setBusy] = useState(false);

  async function call(body: object, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    const res = await fetch("/api/admin/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      alert(data.error ?? "Opération impossible.");
      return;
    }
    router.refresh();
  }

  if (manualAccess) {
    return (
      <div className="access-ctl">
        <span className="gift-tag">🎁 Offert</span>
        <button
          className="mini-btn off"
          disabled={busy}
          onClick={() =>
            call({ plan: null }, "Révoquer l'accès offert à cet utilisateur ?")
          }
        >
          Révoquer
        </button>
      </div>
    );
  }

  if (hasStripe) {
    return <span className="pill-status active">Stripe</span>;
  }

  return (
    <div className="access-ctl">
      <select
        className="role-select"
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
        disabled={busy}
      >
        <option value="starter">Starter</option>
        <option value="creator">Creator</option>
        <option value="pro">Pro</option>
      </select>
      <select
        className="role-select"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        disabled={busy}
      >
        <option value="1m">1 mois</option>
        <option value="3m">3 mois</option>
        <option value="1y">1 an</option>
        <option value="unlimited">Illimité</option>
      </select>
      <button
        className="mini-btn on"
        disabled={busy}
        onClick={() => call({ plan, duration })}
      >
        Offrir
      </button>
    </div>
  );
}
