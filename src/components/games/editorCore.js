// ══════════════════════════════════════════════════════════════════════════
//  Cœur commun des éditeurs 3D du Studio.
//  Les deux jeux (course de billes / Rouge vs Bleu) partageaient 95 % de ce
//  fichier en double : toute correction devait être faite deux fois, et une
//  seule oubliée suffisait à créer un écart de comportement entre les deux
//  éditeurs. Ils délèguent désormais ici, et n'apportent plus que leur
//  « profil » (rôles, couleurs, tailles, caméra de départ).
//
//  Ce que le cœur fournit, en plus de l'ancien comportement :
//   • onDragStart : prévient AVANT une manipulation au gizmo, pour que le
//     Studio empile un point d'annulation — sans ça Ctrl+Z ne pouvait pas
//     annuler un déplacement à la souris.
//   • sélection multiple (Ctrl+clic) et transformation de groupe via un pivot.
//   • aimantation entre pièces : les faces / arêtes / centres proches se
//     collent, ce qui aligne deux pièces au contact sans réglage manuel.
//   • navigation clavier ZQSD + Espace / Maj (vol libre) dans la vue.
//   • pas de déplacement, de rotation et d'échelle réglables.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { creerObjetModele, estModele, modeleDef, appliquerAnim, estAnimee, angleAnim, offsetAnim, vecteurAxe } from "./assets.js";

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;

export function round(n) {
  return Math.round(n * 100) / 100;
}

export function genId(role) {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return role + "_" + crypto.randomUUID().slice(0, 8);
  } catch {}
  return role + "_" + Math.random().toString(36).slice(2, 10);
}

export function clonePiece(p, roleDefaut) {
  return {
    id: p.id,
    role: p.role || roleDefaut,
    pos: [p.pos[0], p.pos[1], p.pos[2]],
    size: [p.size[0], p.size[1], p.size[2]],
    rot: [p.rot ? p.rot[0] : 0, p.rot ? p.rot[1] : 0, p.rot ? p.rot[2] : 0],
    color: p.color || undefined,
    model: p.model || undefined,
    solid: !!p.solid,
    name: p.name || undefined,
    hidden: !!p.hidden,
    locked: !!p.locked,
    anim: p.anim ? { ...p.anim } : undefined,
  };
}

function lumieresParDefaut(scene) {
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x20263a, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.35);
  sun.position.set(-40, 90, -30);
  scene.add(sun);
  const sun2 = new THREE.DirectionalLight(0x88a0ff, 0.5);
  sun2.position.set(50, 40, 60);
  scene.add(sun2);
}

const AXES = ["x", "y", "z"];

// Ramène un angle dans [-180, 180] : sans ça, tourner un peu au-delà d'un
// demi-tour afficherait « -359° » au lieu de « 1° ».
export function normaliserAngle(deg) {
  return (((deg + 180) % 360) + 360) % 360 - 180;
}

// Étiquette flottante (pseudo d'un collègue) dessinée dans un canvas puis
// posée en sprite : toujours face à la caméra, aucune dépendance.
function creerEtiquette(texte, couleur) {
  const c = document.createElement("canvas");
  let ctx = c.getContext("2d");
  const police = "600 34px system-ui, Segoe UI, sans-serif";
  ctx.font = police;
  const largeur = Math.ceil(ctx.measureText(texte).width) + 40;
  c.width = largeur;
  c.height = 62;
  ctx = c.getContext("2d"); // redimensionner remet le contexte à zéro
  ctx.font = police;
  ctx.textBaseline = "middle";
  ctx.fillStyle = couleur;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(1, 7, largeur - 2, 48, 18);
    ctx.fill();
  } else {
    ctx.fillRect(1, 7, largeur - 2, 48);
  }
  ctx.fillStyle = "#0b0e16";
  ctx.fillText(texte, 20, 32);
  const tex = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  spr.renderOrder = 9;
  spr.userData.ratio = largeur / 62;
  return spr;
}

export function creerEditeur3D(canvas, opts = {}, profil = {}) {
  const onChange = opts.onChange || (() => {});
  const onSelect = opts.onSelect || (() => {});
  // Appelé AVANT toute manipulation destructive au gizmo : c'est le signal
  // qui permet au Studio d'empiler l'état d'avant pour Ctrl+Z.
  const onDragStart = opts.onDragStart || (() => {});
  const canEdit = opts.canEdit !== false;
  const handleKeys = opts.handleKeys === true;
  let apercuAnim = opts.apercuAnim !== false;
  const t0Anim = performance.now();
  const assetsBase = opts.assetsBase || "../assets/models/";

  const roleDefaut = profil.roleDefaut || "track";
  const COULEURS = profil.couleurs || {};
  const TAILLES = profil.tailles || {};
  const ANIM_DEFAUTS = profil.animDefauts || {}; // anim par défaut selon le rôle
  const UNIQUES = profil.uniques instanceof Set ? profil.uniques : new Set(profil.uniques || []);
  const DECALAGE_DUP = profil.decalageDup || [4, 0, 4];
  const CADRAGE = profil.cadrage || [0.9, 0.9, -1.2];

  let disposed = false;
  let pieces = (opts.platforms || []).map((p) => clonePiece(p, roleDefaut));

  // Le Studio réutilise le MÊME <canvas> quand on change de jeu : sans registre,
  // les écouteurs de l'éditeur précédent restaient branchés et continuaient de
  // travailler sur une scène morte. On les retire tous à dispose().
  const ecouteurs = [];
  function ecouter(cible, type, fn, opt) {
    cible.addEventListener(type, fn, opt);
    ecouteurs.push([cible, type, fn, opt]);
  }

  // ───────────────────────── Rendu ─────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(profil.fond ?? 0x0c111c);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 5000);
  const dep = profil.cameraDepart || [46, 52, -58];
  camera.position.set(dep[0], dep[1], dep[2]);
  (profil.lumieres || lumieresParDefaut)(scene);

  const grid = new THREE.GridHelper(600, 120, 0x3a4670, 0x1b2233);
  scene.add(grid);
  scene.add(new THREE.AxesHelper(12));

  // ───────────────────────── Contrôles ─────────────────────────
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.12;
  orbit.maxPolarAngle = Math.PI * 0.495; // ne passe pas sous le sol
  const cib = profil.cible || [0, 8, 30];
  orbit.target.set(cib[0], cib[1], cib[2]);

  const transform = new TransformControls(camera, renderer.domElement);
  transform.setSize(0.9);
  transform.setTranslationSnap(null);
  scene.add(transform.getHelper());

  // Pivot de groupe : quand plusieurs pièces sont sélectionnées, le gizmo agit
  // sur ce pivot et les pièces lui sont rattachées le temps du glissement.
  const pivot = new THREE.Object3D();
  pivot.name = "__pivot";
  scene.add(pivot);
  let dragMulti = false;

  transform.addEventListener("dragging-changed", (e) => {
    orbit.enabled = !e.value;
    if (e.value) debutDrag();
    else finDrag();
  });
  transform.addEventListener("objectChange", () => pendantDrag());

  // ───────────────────────── Matériaux & pièces ─────────────────────────
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const matCache = new Map();
  function matFor(role, color) {
    const key = (color || "") + "|" + (role || roleDefaut);
    if (matCache.has(key)) return matCache.get(key);
    const base = color ? new THREE.Color(color) : new THREE.Color(COULEURS[role] ?? COULEURS[roleDefaut] ?? 0x3a4670);
    const m = profil.materiau
      ? profil.materiau(base, role)
      : new THREE.MeshStandardMaterial({ color: base, roughness: 0.85, metalness: 0.05, emissive: base.clone().multiplyScalar(0.06) });
    matCache.set(key, m);
    return m;
  }

  const meshes = new Map(); // id -> objet 3D

  function addMesh(pl) {
    // Une pièce « modèle » affiche un fichier .glb ; tout le reste est une
    // boîte. Le groupe renvoyé est utilisable immédiatement (volume témoin le
    // temps du chargement), donc rien n'est asynchrone ici.
    const mesh = estModele(pl) ? creerObjetModele(pl, { base: assetsBase }) : new THREE.Mesh(unit, matFor(pl.role, pl.color));
    mesh.scale.set(Math.max(0.05, pl.size[0]), Math.max(0.05, pl.size[1]), Math.max(0.05, pl.size[2]));
    mesh.position.set(pl.pos[0], pl.pos[1], pl.pos[2]);
    mesh.rotation.set((pl.rot[0] || 0) * D2R, (pl.rot[1] || 0) * D2R, (pl.rot[2] || 0) * D2R, "XYZ");
    mesh.userData = Object.assign({}, mesh.userData, {
      id: pl.id,
      role: pl.role,
      color: pl.color,
      model: pl.model,
      solid: !!pl.solid,
      locked: !!pl.locked,
      anim: pl.anim,
      name: pl.name,
    });
    mesh.visible = !pl.hidden;
    scene.add(mesh);
    meshes.set(pl.id, mesh);
    return mesh;
  }
  function rebuildAll() {
    for (const m of meshes.values()) scene.remove(m);
    meshes.clear();
    for (const pl of pieces) addMesh(pl);
  }

  function readMesh(mesh) {
    return {
      id: mesh.userData.id,
      role: mesh.userData.role,
      color: mesh.userData.color,
      model: mesh.userData.model,
      solid: !!mesh.userData.solid,
      name: mesh.userData.name,
      hidden: !mesh.visible,
      locked: !!mesh.userData.locked,
      anim: mesh.userData.anim ? { ...mesh.userData.anim } : undefined,
      pos: [round(mesh.position.x), round(mesh.position.y), round(mesh.position.z)],
      size: [round(Math.abs(mesh.scale.x)), round(Math.abs(mesh.scale.y)), round(Math.abs(mesh.scale.z))],
      rot: [round(mesh.rotation.x * R2D), round(mesh.rotation.y * R2D), round(mesh.rotation.z * R2D)],
    };
  }
  function syncFromMesh(mesh) {
    const d = readMesh(mesh);
    const i = pieces.findIndex((p) => p.id === d.id);
    if (i >= 0) pieces[i] = d;
  }
  function getPlatforms() {
    return pieces.map((p) => clonePiece(p, roleDefaut));
  }
  function commit() {
    onChange(getPlatforms());
  }

  // ───────────────────────── Sélection (simple et multiple) ─────────────────
  let selIds = [];      // toutes les pièces sélectionnées
  let selMesh = null;   // pièce « principale » (la dernière cliquée)
  let contours = [];    // BoxHelper par pièce sélectionnée
  const groupeContours = new THREE.Group();
  scene.add(groupeContours);

  function reconstruireContours() {
    for (const c of contours) {
      groupeContours.remove(c.helper);
      c.helper.geometry?.dispose?.();
    }
    contours = [];
    const idPrincipal = selMesh ? selMesh.userData.id : null;
    for (const id of selIds) {
      const m = meshes.get(id);
      if (!m) continue;
      const h = new THREE.BoxHelper(m, id === idPrincipal ? 0xffe14a : 0x6ba8ff);
      h.material.depthTest = false;
      h.material.transparent = true;
      h.material.opacity = id === idPrincipal ? 1 : 0.7;
      h.renderOrder = 4;
      groupeContours.add(h);
      contours.push({ id, helper: h, mesh: m });
    }
  }
  function majContours() {
    for (const c of contours) {
      if (c.mesh.parent) c.helper.update();
    }
  }
  function lireSelection() {
    if (!selMesh) return null;
    const d = readMesh(selMesh);
    d.multi = selIds.length;              // 1 = sélection simple
    d.selection = [...selIds];
    return d;
  }
  function replacerPivot() {
    const c = new THREE.Vector3();
    let n = 0;
    for (const id of selIds) {
      const m = meshes.get(id);
      if (m) {
        c.add(m.position);
        n++;
      }
    }
    if (n) c.divideScalar(n);
    pivot.position.copy(c);
    pivot.rotation.set(0, 0, 0);
    pivot.scale.set(1, 1, 1);
    pivot.updateMatrixWorld(true);
  }
  function majSelection() {
    selIds = selIds.filter((i) => meshes.has(i));
    if (!selMesh || !meshes.has(selMesh.userData.id)) {
      selMesh = selIds.length ? meshes.get(selIds[selIds.length - 1]) || null : null;
    }
    // Une pièce animée qu'on sélectionne revient à sa pose de base : on édite
    // toujours la vraie transformation, jamais une image de l'animation.
    for (const id of selIds) {
      const m = meshes.get(id);
      if (m && !(m.userData && m.userData.anime)) restoreBaseMesh(id, m);
    }
    transform.detach();
    if (canEdit && selIds.length > 1) {
      replacerPivot();
      transform.attach(pivot);
    } else if (canEdit && selMesh) {
      transform.attach(selMesh);
    }
    reconstruireContours();
    majContours();
    onSelect(lireSelection());
  }
  // additif = Ctrl+clic : ajoute / retire de la sélection au lieu de remplacer.
  function select(id, additif) {
    if (!id) {
      selIds = [];
      selMesh = null;
    } else if (!meshes.has(id)) {
      return;
    } else if (additif && canEdit) {
      const i = selIds.indexOf(id);
      if (i >= 0) selIds.splice(i, 1);
      else selIds.push(id);
      selMesh = selIds.length ? meshes.get(selIds[selIds.length - 1]) || null : null;
    } else {
      selIds = [id];
      selMesh = meshes.get(id) || null;
    }
    majSelection();
  }
  function selectMany(ids) {
    selIds = (ids || []).filter((i) => meshes.has(i));
    selMesh = selIds.length ? meshes.get(selIds[selIds.length - 1]) || null : null;
    majSelection();
  }
  function getSelection() {
    return [...selIds];
  }

  // ───────────────────────── Aimantation entre pièces ───────────────────────
  // Pendant un déplacement, on compare les faces / arêtes / centres de la pièce
  // tirée à ceux des autres : si un écart passe sous le seuil, on colle. C'est
  // ce qui permet d'aligner deux pièces bord à bord sans viser au pixel.
  let aimant = { actif: true, distance: 0.6 };
  let cacheBoites = [];
  const boiteAimant = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
  const aimantHelper = new THREE.Box3Helper(boiteAimant, 0x2fbf6b);
  aimantHelper.visible = false;
  aimantHelper.material.depthTest = false;
  aimantHelper.renderOrder = 5;
  scene.add(aimantHelper);
  const _b3 = new THREE.Box3();

  // ───────────── Valeur affichée pendant un geste (le « 51° ») ─────────────
  // Degrés en rotation, unités en déplacement, dimensions en étirement, dans
  // un cartouche qui suit le gizmo. Sans lui, on tourne une pièce à l'aveugle.
  const onDragInfo = typeof opts.onDragInfo === "function" ? opts.onDragInfo : null;
  let departDrag = null;
  const _ve = new THREE.Vector3();
  const _vd = new THREE.Vector3();
  function versEcran(v3) {
    _ve.copy(v3).project(camera);
    const r = renderer.domElement.getBoundingClientRect();
    return { x: (_ve.x * 0.5 + 0.5) * r.width, y: (-_ve.y * 0.5 + 0.5) * r.height };
  }
  function fmtDelta(n) {
    const v = Math.round(n * 100) / 100;
    return (v > 0 ? "+" : "") + v;
  }
  function infoDrag() {
    if (!onDragInfo || !departDrag) return;
    const cible = dragMulti ? pivot : selMesh;
    if (!cible) return;
    let texte = "";
    if (transform.mode === "translate") {
      const dx = cible.position.x - departDrag.pos.x;
      const dy = cible.position.y - departDrag.pos.y;
      const dz = cible.position.z - departDrag.pos.z;
      const bouts = [];
      if (Math.abs(dx) > 1e-4) bouts.push("X " + fmtDelta(dx));
      if (Math.abs(dy) > 1e-4) bouts.push("Y " + fmtDelta(dy));
      if (Math.abs(dz) > 1e-4) bouts.push("Z " + fmtDelta(dz));
      texte = bouts.length ? bouts.join("   ") : "0";
    } else if (transform.mode === "rotate") {
      // Amplitude par les quaternions (juste quelle que soit la rotation déjà
      // en place), signe donné par l'axe qui a le plus bougé.
      const q = cible.quaternion.clone().multiply(departDrag.quat.clone().invert());
      const ampl = 2 * Math.acos(Math.min(1, Math.abs(q.w))) * R2D;
      let plusGrand = 0;
      for (const a of AXES) {
        const d = normaliserAngle((cible.rotation[a] - departDrag.rot[a]) * R2D);
        if (Math.abs(d) > Math.abs(plusGrand)) plusGrand = d;
      }
      texte = (plusGrand < 0 ? "−" : "") + Math.round(ampl * 10) / 10 + "°";
    } else {
      texte = `${round(Math.abs(cible.scale.x))} × ${round(Math.abs(cible.scale.y))} × ${round(Math.abs(cible.scale.z))}`;
    }
    const p = versEcran(cible.getWorldPosition(_vd));
    onDragInfo({ texte, x: p.x, y: p.y, mode: transform.mode });
  }

  function construireCacheAimant() {
    cacheBoites = [];
    if (!aimant.actif) return;
    const dedans = new Set(selIds);
    for (const [id, m] of meshes) {
      if (dedans.has(id) || !m.visible) continue;
      const b = new THREE.Box3().setFromObject(m);
      if (Number.isFinite(b.min.x) && Number.isFinite(b.max.x)) cacheBoites.push({ id, box: b });
    }
  }
  function troisValeurs(b, a) {
    return [b.min[a], (b.min[a] + b.max[a]) / 2, b.max[a]];
  }
  function appliquerAimant(mesh) {
    if (!aimant.actif || !cacheBoites.length) return;
    mesh.updateMatrixWorld(true);
    const b = _b3.setFromObject(mesh);
    if (!Number.isFinite(b.min.x)) return;
    const seuil = Math.max(0.01, aimant.distance);
    const meilleur = { x: seuil, y: seuil, z: seuil };
    const delta = { x: 0, y: 0, z: 0 };
    let cible = null;
    for (const c of cacheBoites) {
      // On ignore les pièces trop loin : inutile de comparer toute la scène.
      if (c.box.min.x - b.max.x > seuil || b.min.x - c.box.max.x > seuil) continue;
      for (const a of AXES) {
        const src = troisValeurs(b, a);
        const dst = troisValeurs(c.box, a);
        for (const s of src) {
          for (const t of dst) {
            const d = t - s;
            if (Math.abs(d) < meilleur[a]) {
              meilleur[a] = Math.abs(d);
              delta[a] = d;
              cible = c;
            }
          }
        }
      }
    }
    if (delta.x || delta.y || delta.z) {
      mesh.position.set(round(mesh.position.x + delta.x), round(mesh.position.y + delta.y), round(mesh.position.z + delta.z));
      mesh.updateMatrixWorld(true);
      if (cible) {
        boiteAimant.copy(cible.box);
        aimantHelper.visible = true;
      }
    } else {
      aimantHelper.visible = false;
    }
  }
  function cacherAimant() {
    aimantHelper.visible = false;
    cacheBoites = [];
  }

  // ───────────────────────── Glissement au gizmo ────────────────────────────
  function libelleMode() {
    return transform.mode === "rotate" ? "tourner" : transform.mode === "scale" ? "étirer" : "déplacer";
  }
  function debutDrag() {
    // AVANT le mouvement : le Studio empile l'état d'origine pour Ctrl+Z.
    onDragStart(libelleMode() + (selIds.length > 1 ? " (" + selIds.length + " pièces)" : ""));
    construireCacheAimant();
    dragMulti = selIds.length > 1;
    const ancre = dragMulti ? pivot : selMesh;
    departDrag = ancre
      ? { pos: ancre.position.clone(), rot: ancre.rotation.clone(), quat: ancre.quaternion.clone(), scale: ancre.scale.clone() }
      : null;
    if (dragMulti) {
      replacerPivot();
      for (const id of selIds) {
        const m = meshes.get(id);
        if (m) pivot.attach(m); // attach() conserve la position dans le monde
      }
    }
  }
  function pendantDrag() {
    if (!dragMulti && selMesh) {
      if (transform.mode === "translate") appliquerAimant(selMesh);
      syncFromMesh(selMesh);
      onSelect(lireSelection());
    }
    majContours();
    infoDrag();
  }
  function finDrag() {
    if (dragMulti) {
      for (const id of selIds) {
        const m = meshes.get(id);
        if (m) scene.attach(m); // retour à la scène, transformation conservée
      }
      pivot.position.set(0, 0, 0);
      pivot.rotation.set(0, 0, 0);
      pivot.scale.set(1, 1, 1);
      for (const id of selIds) {
        const m = meshes.get(id);
        if (m) {
          m.position.set(round(m.position.x), round(m.position.y), round(m.position.z));
          syncFromMesh(m);
        }
      }
      dragMulti = false;
      replacerPivot();
    }
    cacherAimant();
    majContours();
    departDrag = null;
    if (onDragInfo) onDragInfo(null);
    commit();
    onSelect(lireSelection());
  }

  // ───────────────────────── Clic dans la vue ───────────────────────────────
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downX = 0;
  let downY = 0;
  let boutonDroit = false;

  ecouter(renderer.domElement, "pointerdown", (e) => {
    downX = e.clientX;
    downY = e.clientY;
    if (e.button === 2) boutonDroit = true;
  });
  ecouter(renderer.domElement, "contextmenu", (e) => e.preventDefault());
  ecouter(window, "pointerup", (e) => {
    if (e.button === 2) boutonDroit = false;
  });
  ecouter(renderer.domElement, "pointerup", (e) => {
    if (!canEdit || e.button !== 0) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return; // rotation caméra
    if (transform.dragging || transform.axis) return; // clic sur le gizmo
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    // recursive = true : un modèle est un groupe, le rayon touche ses sous-objets
    const selectionnables = [...meshes.values()].filter((m) => m.visible && !m.userData.locked);
    const hits = ray.intersectObjects(selectionnables, true);
    const additif = e.ctrlKey || e.metaKey || e.shiftKey;
    if (hits.length) {
      let obj = hits[0].object;
      while (obj && obj.userData.id === undefined) obj = obj.parent;
      if (obj && obj.userData.id !== undefined) select(obj.userData.id, additif);
      else if (!additif) select(null);
    } else if (!additif) select(null);
  });

  // ───────────────────────── Opérations ─────────────────────────────────────
  function addModel(modelId) {
    const def = modeleDef(modelId);
    const t = orbit.target;
    const pl = {
      id: genId("modele"),
      role: "modele",
      model: def.id,
      pos: [round(t.x), round(t.y), round(t.z)],
      size: [1, 1, 1],
      rot: [0, 0, 0],
      solid: false,
      color: undefined,
      // Un obstacle du catalogue peut arriver avec son animation déjà réglée.
      anim: def.anim ? { ...def.anim } : undefined,
    };
    if (def.solideParDefaut) pl.solid = true;
    pieces.push(pl);
    addMesh(pl);
    select(pl.id);
    commit();
    return pl.id;
  }
  function addPlatform(role) {
    role = role || roleDefaut;
    if (UNIQUES.has(role)) {
      const existant = pieces.find((p) => p.role === role);
      if (existant) {
        select(existant.id);
        return existant.id;
      }
    }
    const t = orbit.target;
    const size = TAILLES[role] || TAILLES[roleDefaut] || [4, 1, 4];
    const dy = profil.hauteurAjout ? profil.hauteurAjout(size) : 1.5;
    const pl = {
      id: genId(role),
      role,
      pos: [round(t.x), round(t.y + dy), round(t.z)],
      size: [size[0], size[1], size[2]],
      rot: [0, 0, 0],
      color: undefined,
    };
    // Un obstacle mobile arrive déjà animé (réglable ensuite dans le panneau).
    if (ANIM_DEFAUTS[role]) pl.anim = { ...ANIM_DEFAUTS[role] };
    pieces.push(pl);
    addMesh(pl);
    select(pl.id);
    commit();
    return pl.id;
  }
  function deleteSelected() {
    if (!selIds.length) return;
    transform.detach();
    const set = new Set(selIds);
    for (const id of set) {
      const m = meshes.get(id);
      if (m) {
        scene.remove(m);
        meshes.delete(id);
      }
    }
    pieces = pieces.filter((p) => !set.has(p.id));
    selIds = [];
    selMesh = null;
    majSelection();
    commit();
  }
  function duplicateSelected() {
    if (!selIds.length) return;
    const nouveaux = [];
    for (const id of selIds) {
      const m = meshes.get(id);
      if (!m) continue;
      const d = readMesh(m);
      if (UNIQUES.has(d.role)) continue; // rôle unique : pas de doublon
      // clonePiece conserve modèle, solidité et animation — un obstacle
      // dupliqué reste donc exactement le même obstacle.
      const pl = clonePiece(d, roleDefaut);
      pl.id = genId(d.role);
      pl.pos = [round(d.pos[0] + DECALAGE_DUP[0]), round(d.pos[1] + DECALAGE_DUP[1]), round(d.pos[2] + DECALAGE_DUP[2])];
      pieces.push(pl);
      addMesh(pl);
      nouveaux.push(pl.id);
    }
    if (!nouveaux.length) return;
    selectMany(nouveaux);
    commit();
    return nouveaux[nouveaux.length - 1];
  }

  function appliquerPatch(mesh, patch) {
    if (patch.pos) mesh.position.set(patch.pos[0], patch.pos[1], patch.pos[2]);
    if (patch.size) mesh.scale.set(Math.max(0.05, patch.size[0]), Math.max(0.05, patch.size[1]), Math.max(0.05, patch.size[2]));
    if (patch.rot) mesh.rotation.set(patch.rot[0] * D2R, patch.rot[1] * D2R, patch.rot[2] * D2R);
    if (patch.role && mesh.userData.role !== "modele") {
      const doublon = UNIQUES.has(patch.role) && pieces.some((p) => p.role === patch.role && p.id !== mesh.userData.id);
      if (!doublon) {
        mesh.userData.role = patch.role;
        if (mesh.isMesh) mesh.material = matFor(patch.role, mesh.userData.color);
      }
    }
    if (patch.solid !== undefined) mesh.userData.solid = !!patch.solid;
    if (patch.anim !== undefined) {
      mesh.userData.anim = patch.anim ? { ...patch.anim } : undefined;
      const interne = mesh.userData.anime;
      if (interne && !estAnimee({ anim: mesh.userData.anim })) interne.rotation.set(0, 0, 0);
    }
    if (patch.color !== undefined && mesh.isMesh) {
      mesh.userData.color = patch.color || undefined;
      mesh.material = matFor(mesh.userData.role, mesh.userData.color);
    }
    if (patch.model !== undefined && mesh.userData.model !== undefined && patch.model !== mesh.userData.model) {
      // Changement de modèle : on reconstruit l'objet en gardant la transformation.
      const garde = readMesh(mesh);
      garde.model = patch.model;
      scene.remove(mesh);
      meshes.delete(garde.id);
      const i = pieces.findIndex((x) => x.id === garde.id);
      const neuf = addMesh(garde);
      if (i >= 0) pieces[i] = garde;
      else pieces.push(garde);
      if (selMesh === mesh) selMesh = neuf;
      return true; // reconstruit
    }
    syncFromMesh(mesh);
    return false;
  }
  // Déplacement relatif de TOUTE la sélection (flèches du clavier).
  function deplacerSelection(dx, dy, dz) {
    if (!selIds.length) return;
    for (const id of selIds) {
      const m = meshes.get(id);
      if (!m) continue;
      m.position.set(round(m.position.x + dx), round(m.position.y + dy), round(m.position.z + dz));
      syncFromMesh(m);
    }
    replacerPivot();
    majContours();
    onSelect(lireSelection());
    commit();
  }
  // Modif depuis le panneau de propriétés. Les valeurs géométriques (position,
  // taille, rotation) sont absolues : elles ne s'appliquent qu'à la pièce
  // principale. Tout le reste (couleur, solidité, animation, modèle) est
  // appliqué à TOUTE la sélection, ce qui rend l'édition de groupe utile.
  function updateSelected(patch) {
    if (!selMesh) return;
    const geo = !!(patch.pos || patch.size || patch.rot);
    const cibles = geo ? [selMesh] : selIds.map((i) => meshes.get(i)).filter(Boolean);
    let reconstruit = false;
    for (const m of cibles) reconstruit = appliquerPatch(m, patch) || reconstruit;
    if (reconstruit) {
      majSelection();
    } else {
      replacerPivot();
      reconstruireContours();
      majContours();
      onSelect(lireSelection());
    }
    commit();
  }

  // ───────────────────────── Pas / aimant / navigation ──────────────────────
  // Le pas de déplacement, de rotation et d'échelle est réglable : 0.1 pour
  // ajuster finement, 1 ou 5 pour bâtir vite.
  // Trois interrupteurs indépendants, comme dans un vrai éditeur : on veut
  // souvent un pas de rotation fixe (1°, 15°) SANS grille de déplacement.
  const pas = { actifT: false, translation: 1, actifR: false, rotation: 15, actifE: false, echelle: 0.5 };
  function appliquerPas() {
    transform.setTranslationSnap(pas.actifT && pas.translation > 0 ? pas.translation : null);
    transform.setRotationSnap(pas.actifR && pas.rotation > 0 ? pas.rotation * D2R : null);
    transform.setScaleSnap(pas.actifE && pas.echelle > 0 ? pas.echelle : null);
  }
  function setSnap(on) {
    pas.actifT = pas.actifR = pas.actifE = !!on;
    appliquerPas();
  }
  function setSnapSteps(p) {
    if (p && typeof p === "object") {
      if (p.translation !== undefined) pas.translation = Math.max(0, Number(p.translation) || 0);
      if (p.rotation !== undefined) pas.rotation = Math.max(0, Number(p.rotation) || 0);
      if (p.echelle !== undefined) pas.echelle = Math.max(0, Number(p.echelle) || 0);
      if (p.actifT !== undefined) pas.actifT = !!p.actifT;
      if (p.actifR !== undefined) pas.actifR = !!p.actifR;
      if (p.actifE !== undefined) pas.actifE = !!p.actifE;
      // Compatibilité avec l'ancien réglage unique.
      if (p.actif !== undefined) pas.actifT = pas.actifR = pas.actifE = !!p.actif;
    }
    appliquerPas();
    return { ...pas };
  }
  function getSnapSteps() {
    return { ...pas };
  }
  function setMagnet(m) {
    if (m && typeof m === "object") {
      if (m.actif !== undefined) aimant.actif = !!m.actif;
      if (m.distance !== undefined) aimant.distance = Math.max(0, Number(m.distance) || 0);
    }
    return { ...aimant };
  }
  function getMagnet() {
    return { ...aimant };
  }

  // Vol libre : Z/Q/S/D + Espace (monter) et Maj (descendre). Les touches sont
  // lues sur e.key, donc elles suivent la disposition du clavier : un clavier
  // AZERTY donne bien Z-Q-S-D là où c'est imprimé.
  const nav = { actif: true, vitesse: 22, avant: "z", arriere: "s", gauche: "q", droite: "d", monter: " ", descendre: "shift" };
  const touches = new Set();
  function estChamp(t) {
    return !!(t && (/input|textarea|select/i.test(t.tagName || "") || t.isContentEditable));
  }
  function roleTouche(k) {
    if (k === nav.avant) return "avant";
    if (k === nav.arriere) return "arriere";
    if (k === nav.gauche) return "gauche";
    if (k === nav.droite) return "droite";
    if (k === nav.monter) return "monter";
    if (k === nav.descendre) return "descendre";
    return null;
  }
  function onVolDown(e) {
    if (!nav.actif || !canEdit || disposed) return;
    if (estChamp(e.target)) return;
    // Ctrl+S ne doit jamais faire reculer la caméra.
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const r = roleTouche((e.key || "").toLowerCase());
    if (!r) return;
    touches.add(r);
    if (e.key === " ") e.preventDefault();
  }
  function onVolUp(e) {
    const r = roleTouche((e.key || "").toLowerCase());
    if (r) touches.delete(r);
  }
  function viderTouches() {
    touches.clear();
  }
  const _dir = new THREE.Vector3();
  const _droite = new THREE.Vector3();
  const _dep = new THREE.Vector3();
  function majVol(dt) {
    if (!nav.actif || !touches.size) return;
    const bouge =
      touches.has("avant") || touches.has("arriere") || touches.has("gauche") || touches.has("droite") || touches.has("monter");
    // Maj est aussi un modificateur (Maj+flèche = pas ×10) : il ne fait
    // descendre que si une autre touche de vol est déjà tenue.
    const descend = touches.has("descendre") && (bouge || boutonDroit);
    if (!bouge && !descend) return;
    _dir.subVectors(orbit.target, camera.position);
    const dist = Math.max(3, _dir.length());
    _dir.normalize();
    _droite.crossVectors(_dir, camera.up).normalize();
    _dep.set(0, 0, 0);
    if (touches.has("avant")) _dep.add(_dir);
    if (touches.has("arriere")) _dep.sub(_dir);
    if (touches.has("droite")) _dep.add(_droite);
    if (touches.has("gauche")) _dep.sub(_droite);
    if (touches.has("monter")) _dep.y += 1;
    if (descend) _dep.y -= 1;
    if (!_dep.lengthSq()) return;
    // La vitesse suit l'éloignement : on traverse vite une grande arène sans
    // devenir incontrôlable quand on travaille de près.
    // Plafonné à 1,6× : on traverse vite une grande arène sans devenir
    // incontrôlable dès qu'on prend du recul.
    _dep.normalize().multiplyScalar(nav.vitesse * Math.min(1.6, Math.max(0.35, dist / 45)) * dt);
    camera.position.add(_dep);
    orbit.target.add(_dep);
  }
  function setNav(n) {
    if (n && typeof n === "object") {
      if (n.actif !== undefined) nav.actif = !!n.actif;
      if (n.vitesse !== undefined) nav.vitesse = Math.max(1, Number(n.vitesse) || 22);
      for (const k of ["avant", "arriere", "gauche", "droite", "monter", "descendre"]) {
        if (typeof n[k] === "string" && n[k]) nav[k] = n[k].toLowerCase();
      }
    }
    if (!nav.actif) viderTouches();
    return { ...nav };
  }
  function getNav() {
    return { ...nav };
  }

  // ───────────────────────── Vue ────────────────────────────────────────────
  function frameAll() {
    const arr = [...meshes.values()];
    if (!arr.length) {
      orbit.target.set(cib[0], cib[1], cib[2]);
      return;
    }
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    for (const m of arr) {
      tmp.setFromObject(m);
      if (Number.isFinite(tmp.min.x)) box.union(tmp);
    }
    if (box.isEmpty()) return;
    const centre = box.getCenter(new THREE.Vector3());
    const taille = box.getSize(new THREE.Vector3());
    const rayon = Math.max(taille.x, taille.y, taille.z, 10);
    orbit.target.copy(centre);
    camera.position.set(centre.x + rayon * CADRAGE[0], centre.y + rayon * CADRAGE[1], centre.z + rayon * CADRAGE[2]);
    orbit.update();
  }
  function focusSelected() {
    if (selIds.length > 1) {
      const c = new THREE.Vector3();
      let n = 0;
      for (const id of selIds) {
        const m = meshes.get(id);
        if (m) {
          c.add(m.position);
          n++;
        }
      }
      if (n) {
        orbit.target.copy(c.divideScalar(n));
        orbit.update();
      }
      return;
    }
    if (selMesh) {
      orbit.target.copy(selMesh.position);
      orbit.update();
    }
  }
  function setApercuAnim(on) {
    apercuAnim = !!on;
    if (!apercuAnim) {
      for (const [id, m] of meshes) {
        const interne = m.userData && m.userData.anime;
        if (interne) interne.rotation.set(0, 0, 0);
        else restoreBaseMesh(id, m); // boîte animée → retour à la pose de base
      }
    }
  }
  function setPieceFlags(id, flags) {
    const m = meshes.get(id);
    if (!m) return;
    if (flags.hidden !== undefined) {
      m.visible = !flags.hidden;
      if (flags.hidden && selIds.includes(id)) select(id, true);
    }
    if (flags.locked !== undefined) {
      m.userData.locked = !!flags.locked;
      if (flags.locked && selIds.includes(id)) select(id, true);
    }
    if (flags.name !== undefined) m.userData.name = flags.name || undefined;
    const p = pieces.find((x) => x.id === id);
    if (p) Object.assign(p, flags);
  }
  // Position de la caméra, pour la partager avec les autres éditeurs (leur
  // fantôme montre alors d'où on regarde la scène).
  function getCamera() {
    return {
      pos: [round(camera.position.x), round(camera.position.y), round(camera.position.z)],
      cible: [round(orbit.target.x), round(orbit.target.y), round(orbit.target.z)],
    };
  }

  function setPlatforms(arr) {
    pieces = (arr || []).map((p) => clonePiece(p, roleDefaut));
    transform.detach();
    selIds = [];
    selMesh = null;
    rebuildAll();
    majSelection();
  }

  // ───────────────────────── Raccourcis internes (hors Studio) ──────────────
  // Le Studio gère lui-même le clavier (pile d'annulation) : ces touches ne
  // servent qu'à l'éditeur intégré au site.
  function onKey(e) {
    if (!canEdit || estChamp(e.target)) return;
    const k = (e.key || "").toLowerCase();
    if (k === "w") setMode("translate");
    else if (k === "e") setMode("rotate");
    else if (k === "r") setMode("scale");
    else if (k === "f") focusSelected();
    else if ((e.key === "Delete" || e.key === "Backspace") && selIds.length) {
      e.preventDefault();
      deleteSelected();
    } else if (k === "d" && !e.ctrlKey && selIds.length && false) {
      // (dupliquer était sur D : la touche sert maintenant au déplacement caméra)
    }
  }
  function setMode(mode) {
    if (mode === "translate" || mode === "rotate" || mode === "scale") transform.setMode(mode);
  }

  ecouter(window, "keydown", onVolDown);
  ecouter(window, "keyup", onVolUp);
  ecouter(window, "blur", viderTouches);
  if (handleKeys) ecouter(window, "keydown", onKey);

  // ─────────── Aperçu des boîtes animées (spinner / plateforme mobile) ───────
  // On anime la VRAIE boîte (sa rotation/position), jamais les données : une
  // pièce désélectionnée n'est jamais relue, et on la remet à sa pose de base
  // dès qu'on la sélectionne. Comme l'échelle est portée par la boîte, la
  // faire tourner ne la déforme pas.
  const _animQ = new THREE.Quaternion();
  const _animS = new THREE.Quaternion();
  const _animB = new THREE.Quaternion();
  const _animV = new THREE.Vector3();
  const _animE = new THREE.Euler();
  // Animation effective d'une boîte : son anim propre, sinon le défaut du rôle.
  // Renvoie null si la pièce ne doit pas bouger (modèle, ou anim « aucune »).
  function effAnimBox(id) {
    const pl = pieces.find((p) => p.id === id);
    if (!pl || pl.role === "modele") return null;
    const def = ANIM_DEFAUTS[pl.role];
    const a = pl.anim ? Object.assign({}, def || {}, pl.anim) : def || pl.anim || null;
    if (!a || !a.type || a.type === "aucune" || !(Number(a.vitesse) > 0)) return null;
    return a;
  }
  function restoreBaseMesh(id, m) {
    const pl = pieces.find((p) => p.id === id);
    if (!pl) return;
    m.position.set(pl.pos[0], pl.pos[1], pl.pos[2]);
    m.rotation.set((pl.rot[0] || 0) * D2R, (pl.rot[1] || 0) * D2R, (pl.rot[2] || 0) * D2R, "XYZ");
  }
  function animerBoite(m, id, a, t) {
    const pl = pieces.find((p) => p.id === id);
    if (!pl) return;
    const br = pl.rot || [0, 0, 0];
    const bx = pl.pos || [0, 0, 0];
    _animB.setFromEuler(_animE.set((br[0] || 0) * D2R, (br[1] || 0) * D2R, (br[2] || 0) * D2R, "XYZ"));
    const v = vecteurAxe(a.axe);
    if (a.type === "translation") {
      const off = offsetAnim(a, t);
      _animV.set(v[0] * off, v[1] * off, v[2] * off).applyQuaternion(_animB);
      m.position.set(bx[0] + _animV.x, bx[1] + _animV.y, bx[2] + _animV.z);
      m.rotation.set((br[0] || 0) * D2R, (br[1] || 0) * D2R, (br[2] || 0) * D2R, "XYZ");
    } else {
      const ang = angleAnim(a, t);
      _animS.setFromAxisAngle(_animV.set(v[0], v[1], v[2]), ang);
      _animQ.copy(_animB).multiply(_animS);
      m.quaternion.copy(_animQ);
      m.position.set(bx[0], bx[1], bx[2]);
    }
  }

  // ───────────────── Co-édition : ops distantes & présence des pairs ─────────
  // Applique une opération reçue d'un autre éditeur SANS déclencher onChange :
  // aucune rediffusion réseau (sinon boucle infinie d'échos).
  function applyRemote(op) {
    if (!op || typeof op !== "object") return;
    if (op.type === "upsert" && op.piece && op.piece.id) {
      const pl = clonePiece(op.piece, roleDefaut);
      const old = meshes.get(pl.id);
      if (old) {
        scene.remove(old);
        meshes.delete(pl.id);
      }
      const i = pieces.findIndex((p) => p.id === pl.id);
      if (i >= 0) pieces[i] = pl;
      else pieces.push(pl);
      addMesh(pl);
      if (selIds.includes(pl.id)) majSelection();
    } else if (op.type === "remove" && op.id) {
      const m = meshes.get(op.id);
      if (m) {
        scene.remove(m);
        meshes.delete(op.id);
      }
      pieces = pieces.filter((p) => p.id !== op.id);
      if (selIds.includes(op.id)) selIds = selIds.filter((x) => x !== op.id);
      majSelection();
    }
    rebuildPeerContours();
  }

  // Fantômes des autres éditeurs : leurs pièces sélectionnées entourées de LEUR
  // couleur, surmontées de leur pseudo, et — si on la reçoit — un repère montrant
  // d'où ils regardent la scène.
  let peerSel = []; // [{ color, ids:[pieceId], name, camera:{pos,cible} }]
  let peerObjets = [];
  let peerSig = "";
  const peerGroup = new THREE.Group();
  scene.add(peerGroup);
  function viderPeers() {
    for (const c of peerGroup.children.slice()) {
      peerGroup.remove(c);
      c.geometry?.dispose?.();
      if (c.material) {
        c.material.map?.dispose?.();
        c.material.dispose?.();
      }
    }
    peerObjets = [];
  }
  function rebuildPeerContours() {
    viderPeers();
    for (const peer of peerSel) {
      const col = new THREE.Color(peer.color || "#5a9bff");
      const e = { contours: [], etiquette: null, repere: null, ancre: null, camera: peer.camera || null };
      for (const id of peer.ids || []) {
        const m = meshes.get(id);
        if (!m) continue;
        const h = new THREE.BoxHelper(m, col);
        h.material.depthTest = false;
        h.material.transparent = true;
        h.material.opacity = 0.9;
        h.renderOrder = 3;
        peerGroup.add(h);
        e.contours.push(h);
        if (!e.ancre) e.ancre = m;
      }
      if (peer.camera && Array.isArray(peer.camera.pos)) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.9, 2.6, 14),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthTest: false }),
        );
        cone.renderOrder = 3;
        peerGroup.add(cone);
        e.repere = cone;
      }
      if (e.ancre || e.repere) {
        const et = creerEtiquette(peer.name || "Éditeur", peer.color || "#5a9bff");
        peerGroup.add(et);
        e.etiquette = et;
      }
      peerObjets.push(e);
    }
  }
  const _pp = new THREE.Vector3();
  const _pc = new THREE.Vector3();
  function majPeers() {
    if (!peerObjets.length) return;
    for (const e of peerObjets) {
      for (const h of e.contours) if (h.object && h.object.parent) h.update();
      if (e.repere && e.camera && e.camera.pos) {
        e.repere.position.set(e.camera.pos[0], e.camera.pos[1], e.camera.pos[2]);
        if (e.camera.cible) {
          _pc.set(e.camera.cible[0], e.camera.cible[1], e.camera.cible[2]);
          e.repere.lookAt(_pc);
          e.repere.rotateX(-Math.PI / 2); // le cône pointe vers +Y par défaut
        }
        e.repere.scale.setScalar(Math.max(0.5, camera.position.distanceTo(e.repere.position) / 60));
      }
      // L'étiquette suit la pièce sélectionnée, sinon le repère de caméra.
      const suivi = e.ancre && e.ancre.parent ? e.ancre : e.repere;
      if (e.etiquette && suivi) {
        suivi.getWorldPosition(_pp);
        const haut = suivi === e.ancre ? Math.abs(e.ancre.scale.y) * 0.6 + 1.6 : 2.4;
        e.etiquette.position.set(_pp.x, _pp.y + haut, _pp.z);
        const d = camera.position.distanceTo(e.etiquette.position);
        const h = Math.max(0.9, d * 0.035);
        e.etiquette.scale.set(h * e.etiquette.userData.ratio, h, 1);
        e.etiquette.visible = true;
      } else if (e.etiquette) {
        e.etiquette.visible = false;
      }
    }
  }
  function setPeerSelections(list) {
    peerSel = Array.isArray(list) ? list : [];
    // La présence est republiée plusieurs fois par seconde : on ne reconstruit
    // les objets (dont les textures de pseudo) que si la sélection change.
    const sig = JSON.stringify(peerSel.map((p) => [p.color, p.name, p.ids]));
    if (sig !== peerSig) {
      peerSig = sig;
      rebuildPeerContours();
    } else {
      for (let i = 0; i < peerObjets.length && i < peerSel.length; i++) {
        peerObjets[i].camera = peerSel[i].camera || null;
      }
    }
  }

  // ───────────────────────── Boucle de rendu ────────────────────────────────
  let raf = 0;
  let tPrec = performance.now();
  function loop() {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - tPrec) / 1000));
    tPrec = now;
    majVol(dt);
    orbit.update();
    // Aperçu des obstacles animés. L'animation ne touche que le groupe
    // INTÉRIEUR : la rotation réglée par l'utilisateur et le gizmo restent
    // intacts. Désactivable pour travailler sur une pièce immobile.
    if (apercuAnim) {
      const t = (now - t0Anim) / 1000;
      for (const [id, m] of meshes) {
        if (m.userData && m.userData.anime && m.userData.anim) {
          appliquerAnim(m, { anim: m.userData.anim }, t);
          continue;
        }
        // Boîte animée : on ne bouge que les pièces NON sélectionnées (une
        // pièce en cours d'édition reste au repos, à sa pose de base).
        if (selIds.includes(id)) continue;
        const a = effAnimBox(id);
        if (a) animerBoite(m, id, a, t);
      }
    }
    if (contours.length) majContours();
    majPeers();
    renderer.render(scene, camera);
  }
  function resize() {
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / h || 1;
    camera.updateProjectionMatrix();
  }
  function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
    for (const [cible, type, fn, opt] of ecouteurs) cible.removeEventListener(type, fn, opt);
    ecouteurs.length = 0;
    viderPeers();
    transform.detach();
    transform.dispose();
    orbit.dispose();
    renderer.dispose();
  }

  rebuildAll();
  resize();
  ecouter(window, "resize", resize);
  raf = requestAnimationFrame(loop);
  onSelect(null);

  // Accès de contrôle : console développeur du Studio et tests automatisés.
  // Même rôle que le getDebug() des moteurs de jeu.
  function getDebug() {
    return { camera, orbit, scene, transform, pivot, meshes, pieces, aimant, pas, nav, selIds, touches, construireCacheAimant, appliquerAimant };
  }

  return {
    getDebug,
    getCamera,
    addPlatform,
    addModel,
    deleteSelected,
    duplicateSelected,
    setMode,
    setSnap,
    setSnapSteps,
    getSnapSteps,
    setMagnet,
    getMagnet,
    setNav,
    getNav,
    updateSelected,
    deplacerSelection,
    frameAll,
    focusSelected,
    select,
    selectMany,
    getSelection,
    setApercuAnim,
    setPieceFlags,
    setPlatforms,
    getPlatforms,
    applyRemote,
    setPeerSelections,
    resize,
    dispose,
  };
}
