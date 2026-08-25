"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Row {
  id: string;
  name: string;
  gameType: string;
  active: boolean;
}

export default function LevelsAdmin({
  canEdit,
  initial,
}: {
  canEdit: boolean;
  initial: Row[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/levels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, gameType: "marble-race" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.level?.id) {
      router.push(`/admin/levels/${data.level.id}`);
    } else {
      alert(data.error ?? "Création impossible.");
    }
  }

  async function activate(id: string) {
    const res = await fetch(`/api/admin/levels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    if (res.ok) router.refresh();
    else alert("Activation impossible.");
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer ce niveau définitivement ?")) return;
    const res = await fetch(`/api/admin/levels/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else alert("Suppression impossible.");
  }

  return (
    <>
      {canEdit && (
        <form className="add-game" onSubmit={create}>
          <h3>Nouveau niveau</h3>
          <div className="add-row">
            <div className="field grow">
              <label htmlFor="lvl-name">Nom du circuit</label>
              <input
                id="lvl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Circuit express"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Création…" : "Créer & éditer"}
            </button>
          </div>
        </form>
      )}

      {initial.length === 0 ? (
        <div className="readonly-note">
          Aucun niveau pour l&apos;instant. {canEdit ? "Crée ton premier circuit ci-dessus." : ""}
        </div>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Jeu</th>
                  <th>État</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {initial.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <b>{l.name}</b>
                    </td>
                    <td style={{ color: "var(--muted)" }}>{l.gameType}</td>
                    <td>
                      {l.active ? (
                        <span className="pill-status active">● Actif (en live)</span>
                      ) : (
                        <span className="pill-status">inactif</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <Link className="mini-btn" href={`/admin/levels/${l.id}`}>
                          {canEdit ? "Éditer" : "Voir"}
                        </Link>
                        {canEdit && !l.active && (
                          <button className="mini-btn on" onClick={() => activate(l.id)}>
                            Activer
                          </button>
                        )}
                        {canEdit && (
                          <button className="mini-btn off" onClick={() => remove(l.id)}>
                            Suppr.
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
