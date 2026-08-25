"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MarbleRace3D from "@/components/games/MarbleRace3D";
import { ROLES } from "@/lib/gameTypes";

type Platform = {
  id: string;
  role: string;
  color?: string;
  pos: number[];
  size: number[];
  rot: number[];
};

type Controller = {
  addPlatform: (r: string) => string;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  setMode: (m: string) => void;
  setSnap: (b: boolean) => void;
  updateSelected: (p: Record<string, unknown>) => void;
  frameAll: () => void;
  focusSelected: () => void;
  select: (id: string | null) => void;
  setPlatforms: (a: unknown[]) => void;
  getPlatforms: () => Platform[];
  resize: () => void;
  dispose: () => void;
};

const MODES = [
  { m: "translate", label: "Déplacer", icon: "✥", key: "W" },
  { m: "rotate", label: "Tourner", icon: "⟳", key: "E" },
  { m: "scale", label: "Étirer", icon: "⤢", key: "R" },
];

export default function LevelEditor({
  canEdit,
  id,
  initialName,
  active,
  initialPlatforms,
  initialSettings,
}: {
  canEdit: boolean;
  id: string;
  gameType: string;
  initialName: string;
  active: boolean;
  initialPlatforms: Platform[];
  initialSettings: Record<string, unknown>;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [settings, setSettings] = useState<Record<string, unknown>>(initialSettings || {});
  const camera = (settings.camera as string) || "auto";

  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms);
  const platformsRef = useRef<Platform[]>(initialPlatforms);
  const [selected, setSelected] = useState<Platform | null>(null);
  const [mode, setModeState] = useState("translate");
  const [snap, setSnapState] = useState(false);
  const [testing, setTesting] = useState(false);
  const [help, setHelp] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isActive, setIsActive] = useState(active);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctlRef = useRef<Controller | null>(null);

  // Crée (ou recrée) l'éditeur 3D quand on (re)passe en mode édition.
  useEffect(() => {
    if (testing) return;
    let alive = true;
    let ctl: Controller | null = null;
    (async () => {
      const mod = await import("@/components/games/marbleEditor3D.js");
      if (!alive || !canvasRef.current) return;
      ctl = mod.createMarbleEditor3D(canvasRef.current, {
        platforms: platformsRef.current,
        canEdit,
        onChange: (pls: Platform[]) => {
          platformsRef.current = pls;
          setPlatforms(pls);
          setSaved(false);
        },
        onSelect: (sel: Platform | null) => setSelected(sel),
      }) as Controller;
      ctlRef.current = ctl;
      ctl.setMode(mode);
      ctl.setSnap(snap);
    })();
    return () => {
      alive = false;
      ctl?.dispose();
      ctlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testing, canEdit]);

  function setCamera(v: string) {
    setSettings((s) => ({ ...s, camera: v }));
    setSaved(false);
  }
  function chooseMode(m: string) {
    setModeState(m);
    ctlRef.current?.setMode(m);
  }
  function toggleSnap() {
    const v = !snap;
    setSnapState(v);
    ctlRef.current?.setSnap(v);
  }
  function add(role: string) {
    ctlRef.current?.addPlatform(role);
  }
  function patchSel(patch: Record<string, unknown>) {
    ctlRef.current?.updateSelected(patch);
  }
  function setVec(kind: "pos" | "size" | "rot", i: number, value: number) {
    if (!selected) return;
    const arr = [...selected[kind]];
    arr[i] = value;
    patchSel({ [kind]: arr });
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/admin/levels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, platforms: platformsRef.current, settings }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } else {
      alert("Enregistrement impossible.");
    }
  }
  async function activate() {
    const res = await fetch(`/api/admin/levels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, platforms: platformsRef.current, settings, active: true }),
    });
    if (res.ok) {
      setIsActive(true);
      router.refresh();
    } else alert("Activation impossible.");
  }

  const counts = platforms.reduce<Record<string, number>>((a, p) => {
    a[p.role] = (a[p.role] || 0) + 1;
    return a;
  }, {});
  const hasStart = (counts.start || 0) > 0;
  const hasFinish = (counts.finish || 0) > 0;

  return (
    <>
      <div className="lvl-topbar">
        <Link className="mini-btn" href="/admin/levels">
          ← Niveaux
        </Link>
        {canEdit ? (
          <input
            className="lvl-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
          />
        ) : (
          <span className="lvl-name-ro">{name}</span>
        )}
        {isActive && <span className="pill-status active">● Actif</span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className={`mini-btn${testing ? " on" : ""}`} onClick={() => setTesting((t) => !t)}>
            {testing ? "⏸ Éditer" : "▶ Tester"}
          </button>
          {canEdit && !isActive && (
            <button className="mini-btn on" onClick={activate}>
              Activer en live
            </button>
          )}
          {canEdit && (
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Enregistrement…" : saved ? "✓ Enregistré" : "Enregistrer"}
            </button>
          )}
        </div>
      </div>

      <div className="lvl-settings">
        <span className="lvl-set-label">🎥 Caméra en jeu :</span>
        <select value={camera} disabled={!canEdit} onChange={(e) => setCamera(e.target.value)}>
          <option value="auto">Auto (change d&apos;angle)</option>
          <option value="chase">Derrière (chasse)</option>
          <option value="front">De face</option>
          <option value="side">Côté</option>
          <option value="top">Vue du haut</option>
        </select>
        <span className="lvl-set-hint">
          {platforms.length} plateforme{platforms.length > 1 ? "s" : ""}
          {!hasStart && <span className="lvl-warn"> · ⚠️ pas de départ</span>}
          {!hasFinish && <span className="lvl-warn"> · ⚠️ pas d&apos;arrivée</span>}
        </span>
      </div>

      {testing ? (
        <div className="ed-test">
          <div className="phone-frame">
            <MarbleRace3D demo level={{ platforms, settings }} />
          </div>
          <p className="ed-hint" style={{ textAlign: "center" }}>
            Aperçu en direct — les billes apparaissent sur la plateforme de départ. Reviens sur
            « Éditer » pour ajuster.
          </p>
        </div>
      ) : (
        <>
          {canEdit && (
            <div className="ed-toolbar">
              <div className="ed-group">
                <span className="ed-group-h">Ajouter</span>
                {ROLES.map((r) => (
                  <button key={r.role} className="ed-btn add" onClick={() => add(r.role)}>
                    <span aria-hidden>{r.icon}</span> {r.label}
                  </button>
                ))}
              </div>
              <div className="ed-group">
                <span className="ed-group-h">Outil</span>
                {MODES.map((mm) => (
                  <button
                    key={mm.m}
                    className={`ed-btn${mode === mm.m ? " active" : ""}`}
                    onClick={() => chooseMode(mm.m)}
                    title={`${mm.label} (${mm.key})`}
                  >
                    <span aria-hidden>{mm.icon}</span> {mm.label}
                  </button>
                ))}
                <button
                  className={`ed-btn${snap ? " active" : ""}`}
                  onClick={toggleSnap}
                  title="Aligner sur la grille"
                >
                  🧲 Aimant
                </button>
              </div>
              <div className="ed-group">
                <button className="ed-btn" onClick={() => ctlRef.current?.duplicateSelected()} disabled={!selected}>
                  ⧉ Dupliquer
                </button>
                <button className="ed-btn danger" onClick={() => ctlRef.current?.deleteSelected()} disabled={!selected}>
                  ✕ Supprimer
                </button>
                <button className="ed-btn" onClick={() => ctlRef.current?.frameAll()}>
                  ⛶ Tout voir
                </button>
                <button className={`ed-btn${help ? " active" : ""}`} onClick={() => setHelp((h) => !h)}>
                  ? Aide
                </button>
              </div>
            </div>
          )}

          {help && (
            <div className="ed-help">
              <b>Comment ça marche :</b> clique une plateforme pour la sélectionner, puis tire les
              flèches du repère pour la <b>déplacer</b> (X rouge, Y vert, Z bleu). Passe en{" "}
              <b>Tourner</b> pour l&apos;incliner (faire un virage / une pente) ou <b>Étirer</b> pour
              l&apos;allonger. Molette = zoom, clic droit maintenu = tourner autour. Raccourcis :
              W / E / R (outils), F (centrer), D (dupliquer), Suppr (supprimer). Place une plateforme{" "}
              <b>Départ</b> (les billes y apparaissent) et une <b>Arrivée</b>.
            </div>
          )}

          <div className="ed-stage">
            <canvas ref={canvasRef} className="ed-canvas" />

            {selected ? (
              <div className="ed-panel">
                <div className="ed-panel-h">
                  Plateforme sélectionnée
                  {canEdit && (
                    <button className="ed-x" onClick={() => ctlRef.current?.select(null)} title="Désélectionner">
                      ✕
                    </button>
                  )}
                </div>

                <label className="ed-row">
                  <span>Type</span>
                  <select
                    value={selected.role}
                    disabled={!canEdit}
                    onChange={(e) => patchSel({ role: e.target.value })}
                  >
                    {ROLES.map((r) => (
                      <option key={r.role} value={r.role}>
                        {r.icon} {r.label}
                      </option>
                    ))}
                  </select>
                </label>

                <VecRow
                  label="Position"
                  names={["X", "Y", "Z"]}
                  values={selected.pos}
                  disabled={!canEdit}
                  step={0.5}
                  onChange={(i, v) => setVec("pos", i, v)}
                />
                <VecRow
                  label="Taille"
                  names={["L", "H", "P"]}
                  values={selected.size}
                  disabled={!canEdit}
                  step={0.5}
                  min={0.2}
                  onChange={(i, v) => setVec("size", i, v)}
                />
                <VecRow
                  label="Rotation °"
                  names={["X", "Y", "Z"]}
                  values={selected.rot}
                  disabled={!canEdit}
                  step={1}
                  onChange={(i, v) => setVec("rot", i, v)}
                />

                <label className="ed-row">
                  <span>Couleur</span>
                  <span className="ed-color">
                    <input
                      type="color"
                      value={selected.color || defaultColor(selected.role)}
                      disabled={!canEdit}
                      onChange={(e) => patchSel({ color: e.target.value })}
                    />
                    {selected.color && canEdit && (
                      <button className="ed-mini" onClick={() => patchSel({ color: "" })}>
                        auto
                      </button>
                    )}
                  </span>
                </label>

                {canEdit && (
                  <div className="ed-panel-actions">
                    <button className="ed-btn" onClick={() => ctlRef.current?.duplicateSelected()}>
                      ⧉ Dupliquer
                    </button>
                    <button className="ed-btn danger" onClick={() => ctlRef.current?.deleteSelected()}>
                      ✕ Supprimer
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="ed-panel ed-panel-empty">
                <div className="ed-empty-ic">🖱️</div>
                Clique une plateforme pour la modifier, ou ajoute-en une avec la barre du haut.
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function defaultColor(role: string) {
  return role === "start"
    ? "#2fbf6b"
    : role === "finish"
      ? "#ffcf40"
      : role === "wall"
        ? "#ff3c5f"
        : "#3a4670";
}

function VecRow({
  label,
  names,
  values,
  onChange,
  disabled,
  step = 1,
  min,
}: {
  label: string;
  names: string[];
  values: number[];
  onChange: (i: number, v: number) => void;
  disabled?: boolean;
  step?: number;
  min?: number;
}) {
  return (
    <div className="ed-row ed-vec">
      <span>{label}</span>
      <div className="ed-xyz">
        {names.map((nm, i) => (
          <label key={nm} className={`ed-ax ax-${nm.toLowerCase()}`}>
            <em>{nm}</em>
            <input
              type="number"
              step={step}
              min={min}
              value={Number.isFinite(values[i]) ? values[i] : 0}
              disabled={disabled}
              onChange={(e) => onChange(i, parseFloat(e.target.value) || 0)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
