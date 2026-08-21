"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  async function openPortal() {
    setLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      window.location.href = data.url;
    } else {
      setLoading(false);
      alert(data.error ?? "Impossible d'ouvrir le portail de facturation.");
    }
  }
  return (
    <button className="btn btn-ghost" onClick={openPortal} disabled={loading}>
      {loading ? "Ouverture…" : "Gérer ma facturation"}
    </button>
  );
}

export function LogoutButton() {
  return (
    <button
      className="btn btn-link"
      onClick={() => signOut({ callbackUrl: "/" })}
    >
      Se déconnecter
    </button>
  );
}
