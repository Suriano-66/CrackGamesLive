// Logique de l'application "CrackGames Studio".
// Réutilise le moteur d'édition (marbleEditor3D) et le moteur de course
// (marbleRaceEngine) du jeu, et publie les niveaux dans la base via l'API du site.
import { createMarbleEditor3D } from "./engine/marbleEditor3D.js";
import { createMarbleRace3D } from "./engine/marbleRaceEngine.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
// Pont Electron (préchargé). En dehors d'Electron (tests), un stub peut être injecté.
const bridge = window.studio;

const state = {
  cfg: { baseUrl: "", apiKey: "" },
  levels: [],
  currentId: null,
  name: "",
  settings: { camera: "auto" },
  platforms: [],
  dirty: false,
  selected: null,
  mode: "translate",
  snap: false,
  editor: null,
  engine: null,
  engineTimer: null,
  testing: false,
  panelEditing: false,
};

// ---------------- utils ----------------
let toastT = null;
function toast(msg, kind) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast " + (kind || "");
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 2600);
}
async function apiCall(method, path, body) {
  if (!bridge || !bridge.api) return { ok: false, status: 0, error: "Pont Electron indisponible." };
  return bridge.api(method, path, body);
}

// ---------------- config / connexion ----------------
async function loadCfg() {
  if (bridge && bridge.getConfig) state.cfg = (await bridge.getConfig()) || state.cfg;
  $("#cfgUrl").value = state.cfg.baseUrl || "";
  $("#cfgKey").value = state.cfg.apiKey || "";
}
function setConn(ok) {
  const c = $("#conn");
  c.className = "conn " + (ok ? "on" : "off");
  c.textContent = ok ? "● connecté" : "● hors ligne";
}
async function testConn(withToast) {
  const r = await apiCall("GET", "/api/admin/levels");
  setConn(!!r.ok);
  if (withToast) toast(r.ok ? "Connecté ✓" : "Échec : " + (r.error || "HTTP " + r.status), r.ok ? "ok" : "err");
  return r;
}

// ---------------- niveaux ----------------
function parseData(dataStr) {
  try {
    const d = JSON.parse(dataStr || "{}");
    return {
      platforms: Array.isArray(d.platforms) ? d.platforms : [],
      settings: d.settings && typeof d.settings === "object" ? d.settings : {},
    };
  } catch {
    return { platforms: [], settings: {} };
  }
}
async function refreshLevels() {
  const r = await apiCall("GET", "/api/admin/levels");
  if (!r.ok) {
    setConn(false);
    $("#levelList").innerHTML = `<div class="muted small">Hors ligne. Vérifie la config (⚙).</div>`;
    return;
  }
  setConn(true);
  state.levels = (r.data && r.data.levels) || [];
  renderList();
}
function renderList() {
  const box = $("#levelList");
  if (!state.levels.length) {
    box.innerHTML = `<div class="muted small">Aucun niveau. Crée-en un ci-dessus.</div>`;
    return;
  }
  box.innerHTML = "";
  for (const lvl of state.levels) {
    const el = document.createElement("div");
    el.className = "lvl-item" + (lvl.id === state.currentId ? " sel" : "");
    el.innerHTML =
      `<span class="nm">${escapeHtml(lvl.name)}</span>` +
      (lvl.active ? `<span class="badge">● live</span>` : "") +
      `<button class="del" title="Supprimer">✕</button>`;
    el.querySelector(".nm").addEventListener("click", () => loadLevelObj(lvl));
    el.addEventListener("click", (e) => {
      if (e.target.classList.contains("del")) return;
      loadLevelObj(lvl);
    });
    el.querySelector(".del").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteLevel(lvl.id, lvl.name);
    });
    box.appendChild(el);
  }
}
function loadLevelObj(lvl) {
  if (state.testing) stopTest();
  const { platforms, settings } = parseData(lvl.data);
  state.currentId = lvl.id;
  state.name = lvl.name;
  state.settings = Object.assign({ camera: "auto" }, settings);
  state.platforms = platforms;
  state.dirty = false;
  state.editor?.setPlatforms(platforms);
  applyLoaded(lvl);
}
function applyLoaded(lvl) {
  $("#curName").textContent = state.name;
  $("#activePill").hidden = !(lvl && lvl.active);
  $("#camSel").value = state.settings.camera || "auto";
  markClean();
  $("#btnSave").disabled = !state.currentId;
  $("#btnActivate").disabled = !state.currentId || (lvl && lvl.active);
  $("#btnTest").disabled = false;
  updateCounts();
  renderList();
}
async function createLevel() {
  const name = $("#newName").value.trim();
  if (!name) {
    toast("Donne un nom au circuit.", "err");
    return;
  }
  const r = await apiCall("POST", "/api/admin/levels", { name, gameType: "marble-race" });
  if (r.ok && r.data && r.data.level) {
    $("#newName").value = "";
    state.levels.unshift(r.data.level);
    loadLevelObj(r.data.level);
    toast("Niveau créé ✓", "ok");
  } else {
    toast("Création impossible : " + (r.error || "HTTP " + r.status), "err");
  }
}
async function deleteLevel(id, name) {
  if (!window.confirm(`Supprimer « ${name} » définitivement ?`)) return;
  const r = await apiCall("DELETE", "/api/admin/levels/" + id);
  if (r.ok) {
    if (state.currentId === id) {
      state.currentId = null;
      state.name = "";
      state.platforms = [];
      state.editor?.setPlatforms([]);
      $("#curName").textContent = "— aucun niveau —";
      $("#activePill").hidden = true;
      $("#btnSave").disabled = $("#btnActivate").disabled = $("#btnTest").disabled = true;
    }
    await refreshLevels();
    toast("Niveau supprimé.", "ok");
  } else toast("Suppression impossible.", "err");
}
async function save() {
  if (!state.currentId) return;
  const r = await apiCall("PATCH", "/api/admin/levels/" + state.currentId, {
    name: state.name,
    platforms: state.platforms,
    settings: state.settings,
  });
  if (r.ok) {
    markClean();
    toast("Enregistré ✓", "ok");
    const lvl = state.levels.find((l) => l.id === state.currentId);
    if (lvl) lvl.data = JSON.stringify({ platforms: state.platforms, settings: state.settings });
  } else toast("Échec de l'enregistrement : " + (r.error || "HTTP " + r.status), "err");
}
async function activate() {
  if (!state.currentId) return;
  const r = await apiCall("PATCH", "/api/admin/levels/" + state.currentId, {
    name: state.name,
    platforms: state.platforms,
    settings: state.settings,
    active: true,
  });
  if (r.ok) {
    markClean();
    toast("Activé en live ✓", "ok");
    await refreshLevels();
    const lvl = state.levels.find((l) => l.id === state.currentId);
    applyLoaded(lvl);
  } else toast("Activation impossible.", "err");
}

// ---------------- édition ----------------
function initEditor() {
  state.editor = createMarbleEditor3D($("#edCanvas"), {
    platforms: state.platforms,
    canEdit: true,
    onChange: (pls) => {
      state.platforms = pls;
      markDirty();
      updateCounts();
    },
    onSelect: (sel) => {
      state.selected = sel;
      $("#btnDup").disabled = !sel;
      $("#btnDel").disabled = !sel;
      if (!state.panelEditing) renderPanel(sel);
    },
  });
  state.editor.setMode(state.mode);
}
function markDirty() {
  state.dirty = true;
  $("#dirty").hidden = false;
}
function markClean() {
  state.dirty = false;
  $("#dirty").hidden = true;
}
function markActive() {}
function updateCounts() {
  const c = state.platforms.reduce((a, p) => ((a[p.role] = (a[p.role] || 0) + 1), a), {});
  let s = `${state.platforms.length} plateforme${state.platforms.length > 1 ? "s" : ""}`;
  if (!c.start) s += " · ⚠️ pas de départ";
  if (!c.finish) s += " · ⚠️ pas d'arrivée";
  $("#counts").textContent = s;
}

// panneau propriétés
function renderPanel(sel) {
  const panel = $("#panel");
  if (!sel) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  $("#pRole").value = sel.role;
  for (const inp of $$("#panel input[data-k]")) {
    const k = inp.dataset.k,
      i = +inp.dataset.i;
    inp.value = sel[k][i];
  }
  $("#pColor").value = sel.color || defaultColor(sel.role);
}
function defaultColor(role) {
  return role === "start" ? "#2fbf6b" : role === "finish" ? "#ffcf40" : role === "wall" ? "#ff3c5f" : "#3a4670";
}
function panelPatch(patch) {
  if (!state.selected) return;
  state.panelEditing = true;
  state.editor.updateSelected(patch);
  state.panelEditing = false;
}

// ---------------- mode test (aperçu billes) ----------------
const DEMO_NAMES = ["Lucas", "Marie", "Noah", "Sofia", "Léa", "Hugo", "Emma", "Nathan", "Chloé", "Jade"];
function startTest() {
  if (!state.platforms.length) {
    toast("Ajoute des plateformes d'abord.", "err");
    return;
  }
  state.testing = true;
  $("#edCanvas").hidden = true;
  $("#playCanvas").hidden = false;
  $("#panel").hidden = true;
  $("#toolbar").style.opacity = 0.4;
  $("#toolbar").style.pointerEvents = "none";
  $("#playHud").hidden = false;
  $("#btnTest").textContent = "⏸ Éditer";
  const canvas = $("#playCanvas");
  state.engine = createMarbleRace3D(canvas, {
    level: { platforms: state.platforms, settings: state.settings },
    onState: (st) => {
      $("#playHud").textContent = `🎮 ${st.phase} · ${st.players} joueur(s) · ${st.board.length} au classement`;
    },
  });
  let i = 0;
  state.engineTimer = setInterval(() => {
    if (!state.engine) return;
    const idx = Math.floor(Math.random() * DEMO_NAMES.length);
    state.engine.handleEvent({
      type: "gift",
      userId: "demo_" + idx,
      nickname: DEMO_NAMES[idx],
      avatar: "",
      diamonds: [1, 5, 10, 20, 50][Math.floor(Math.random() * 5)],
      count: 1 + (i++ % 2),
    });
  }, 600);
}
function stopTest() {
  state.testing = false;
  clearInterval(state.engineTimer);
  state.engineTimer = null;
  if (state.engine) {
    state.engine.dispose();
    state.engine = null;
  }
  $("#playCanvas").hidden = true;
  $("#edCanvas").hidden = false;
  $("#playHud").hidden = true;
  $("#toolbar").style.opacity = 1;
  $("#toolbar").style.pointerEvents = "auto";
  $("#btnTest").textContent = "▶ Tester";
  state.editor?.resize();
}
function toggleTest() {
  state.testing ? stopTest() : startTest();
}

// ---------------- helpers ----------------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ---------------- câblage ----------------
function wire() {
  // config
  $("#btnConfig").addEventListener("click", () => ($("#cfgModal").hidden = false));
  $("#cfgTest").addEventListener("click", async () => {
    await bridge.setConfig({ baseUrl: $("#cfgUrl").value.trim(), apiKey: $("#cfgKey").value.trim() });
    const r = await testConn(false);
    const m = $("#cfgMsg");
    m.className = "cfg-msg " + (r.ok ? "ok" : "err");
    m.textContent = r.ok ? "Connexion réussie ✓" : "Échec : " + (r.error || "HTTP " + r.status);
  });
  $("#cfgSave").addEventListener("click", async () => {
    state.cfg = await bridge.setConfig({ baseUrl: $("#cfgUrl").value.trim(), apiKey: $("#cfgKey").value.trim() });
    $("#cfgModal").hidden = true;
    await refreshLevels();
  });

  // niveaux
  $("#btnRefresh").addEventListener("click", refreshLevels);
  $("#btnNew").addEventListener("click", createLevel);
  $("#newName").addEventListener("keydown", (e) => e.key === "Enter" && createLevel());
  $("#btnSave").addEventListener("click", save);
  $("#btnActivate").addEventListener("click", activate);
  $("#btnTest").addEventListener("click", toggleTest);

  // outils
  $$("[data-add]").forEach((b) => b.addEventListener("click", () => state.editor?.addPlatform(b.dataset.add)));
  $$(".tbtn.mode").forEach((b) =>
    b.addEventListener("click", () => {
      setModeUI(b.dataset.mode);
      state.editor?.setMode(b.dataset.mode);
    }),
  );
  $("#btnSnap").addEventListener("click", () => {
    state.snap = !state.snap;
    $("#btnSnap").classList.toggle("active", state.snap);
    state.editor?.setSnap(state.snap);
  });
  $("#btnDup").addEventListener("click", () => state.editor?.duplicateSelected());
  $("#btnDel").addEventListener("click", () => state.editor?.deleteSelected());
  $("#btnFrame").addEventListener("click", () => state.editor?.frameAll());
  $("#btnDeselect").addEventListener("click", () => state.editor?.select(null));

  // panneau
  $("#pRole").addEventListener("change", (e) => panelPatch({ role: e.target.value }));
  $$("#panel input[data-k]").forEach((inp) =>
    inp.addEventListener("input", () => {
      if (!state.selected) return;
      const k = inp.dataset.k,
        i = +inp.dataset.i;
      const arr = state.selected[k].slice();
      arr[i] = parseFloat(inp.value) || 0;
      panelPatch({ [k]: arr });
    }),
  );
  $("#pColor").addEventListener("input", (e) => panelPatch({ color: e.target.value }));
  $("#pColorAuto").addEventListener("click", () => panelPatch({ color: "" }));

  // réglages
  $("#camSel").addEventListener("change", (e) => {
    state.settings = Object.assign({}, state.settings, { camera: e.target.value });
    markDirty();
  });

  // sync du bouton d'outil actif quand on utilise les raccourcis clavier
  window.addEventListener("keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag && /input|textarea|select/i.test(tag)) return;
    if (e.key === "w" || e.key === "W") setModeUI("translate");
    else if (e.key === "e" || e.key === "E") setModeUI("rotate");
    else if (e.key === "r" || e.key === "R") setModeUI("scale");
    else if ((e.key === "s" || e.key === "S") && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save();
    }
  });
}
function setModeUI(mode) {
  state.mode = mode;
  $$(".tbtn.mode").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
}

// ---------------- démarrage ----------------
async function boot() {
  wire();
  initEditor();
  await loadCfg();
  if (state.cfg.baseUrl && state.cfg.apiKey) {
    await refreshLevels();
  } else {
    $("#cfgModal").hidden = false;
    $("#cfgMsg").textContent = "Renseigne l'URL du site et la clé studio pour commencer.";
  }
  window.__studioReady = true;
}
boot();

// exposé pour les tests automatisés
window.__studio = { state, apiCall };
