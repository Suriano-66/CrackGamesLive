// Éditeur 3D "façon Roblox" pour La grande course.
// On place des PLATEFORMES (boîtes) dans l'espace et on les déplace / tourne /
// étire sur les axes X, Y, Z avec un gizmo (TransformControls). Caméra libre
// (OrbitControls). Sélection au clic. Renvoie les plateformes à React via
// onChange, et la plateforme sélectionnée via onSelect.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { creerObjetModele, estModele, modeleDef, appliquerAnim, estAnimee } from "./assets.js";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const ROLE_COLORS = { track: 0x3a4670, start: 0x2fbf6b, finish: 0xffcf40, wall: 0xff3c5f };
const ROLE_SIZE = {
  track: [16, 1, 18],
  start: [16, 1, 14],
  finish: [20, 1, 16],
  wall: [1, 4, 18],
};

function round(n) {
  return Math.round(n * 100) / 100;
}
function clonePlat(p) {
  return {
    id: p.id,
    role: p.role || "track",
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
function genId(role) {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return role + "_" + crypto.randomUUID().slice(0, 8);
  } catch {}
  return role + "_" + Math.random().toString(36).slice(2, 10);
}

export function createMarbleEditor3D(canvas, opts = {}) {
  const onChange = opts.onChange || (() => {});
  const onSelect = opts.onSelect || (() => {});
  const canEdit = opts.canEdit !== false;
  // Le Studio gère lui-même le clavier : sinon suppressions et duplications
  // court-circuiteraient la pile d'annulation.
  const handleKeys = opts.handleKeys === true;
  let apercuAnim = opts.apercuAnim !== false; // aperçu des animations
  const t0Anim = performance.now();
  const assetsBase = opts.assetsBase || "../assets/models/";
  let disposed = false;
  let platforms = (opts.platforms || []).map(clonePlat);

  // ----- Rendu -----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c111c);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 5000);
  camera.position.set(46, 52, -58);

  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x20263a, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.35);
  sun.position.set(-40, 90, -30);
  scene.add(sun);
  const sun2 = new THREE.DirectionalLight(0x88a0ff, 0.5);
  sun2.position.set(50, 40, 60);
  scene.add(sun2);

  // Grille + axes (repère XYZ visible)
  const grid = new THREE.GridHelper(600, 120, 0x3a4670, 0x1b2233);
  grid.position.y = 0;
  scene.add(grid);
  const axes = new THREE.AxesHelper(12);
  scene.add(axes);

  // ----- Contrôles caméra -----
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.12;
  orbit.maxPolarAngle = Math.PI * 0.495; // ne passe pas sous le sol
  orbit.target.set(0, 8, 30);

  // ----- Gizmo de transformation -----
  const transform = new TransformControls(camera, renderer.domElement);
  transform.setSize(0.9);
  transform.setTranslationSnap(null);
  scene.add(transform.getHelper());
  transform.addEventListener("dragging-changed", (e) => {
    orbit.enabled = !e.value;
    if (!e.value) commit(); // fin de manipulation → on persiste
  });
  transform.addEventListener("objectChange", () => {
    if (selMesh) {
      syncFromMesh(selMesh);
      boxHelper.setFromObject(selMesh);
      onSelect(readMesh(selMesh));
    }
  });

  // ----- Plateformes (boîtes) -----
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const matCache = new Map();
  function matFor(role, color) {
    const key = color || "role:" + (role || "track");
    if (matCache.has(key)) return matCache.get(key);
    const base = color ? new THREE.Color(color) : new THREE.Color(ROLE_COLORS[role] ?? ROLE_COLORS.track);
    const m = new THREE.MeshStandardMaterial({
      color: base,
      roughness: role === "wall" ? 0.5 : 0.85,
      metalness: role === "wall" ? 0.2 : 0.05,
      emissive: base.clone().multiplyScalar(0.06),
    });
    matCache.set(key, m);
    return m;
  }
  const meshes = new Map(); // id -> mesh
  let selMesh = null;
  const boxHelper = new THREE.BoxHelper(new THREE.Object3D(), 0xffe14a);
  boxHelper.visible = false;
  scene.add(boxHelper);

  function addMesh(pl) {
    // Une pièce « modèle » affiche un fichier .glb ; tout le reste est une
    // boîte. Le groupe renvoyé est utilisable immédiatement (volume témoin
    // affiché le temps du chargement), donc rien n'est asynchrone ici.
    const mesh = estModele(pl)
      ? creerObjetModele(pl, { base: assetsBase })
      : new THREE.Mesh(unit, matFor(pl.role, pl.color));
    mesh.scale.set(Math.max(0.2, pl.size[0]), Math.max(0.2, pl.size[1]), Math.max(0.2, pl.size[2]));
    mesh.position.set(pl.pos[0], pl.pos[1], pl.pos[2]);
    mesh.rotation.set((pl.rot[0] || 0) * D2R, (pl.rot[1] || 0) * D2R, (pl.rot[2] || 0) * D2R, "XYZ");
    mesh.userData = { id: pl.id, role: pl.role, color: pl.color, model: pl.model, solid: !!pl.solid, locked: !!pl.locked, anim: pl.anim, name: pl.name };
    mesh.visible = !pl.hidden;
    scene.add(mesh);
    meshes.set(pl.id, mesh);
    return mesh;
  }
  function rebuildAll() {
    for (const m of meshes.values()) scene.remove(m);
    meshes.clear();
    for (const pl of platforms) addMesh(pl);
  }
  rebuildAll();

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
    const i = platforms.findIndex((p) => p.id === d.id);
    if (i >= 0) platforms[i] = d;
  }
  function getPlatforms() {
    return platforms.map(clonePlat);
  }
  function commit() {
    onChange(getPlatforms());
  }

  // ----- Sélection -----
  function select(id) {
    const mesh = id ? meshes.get(id) : null;
    selMesh = mesh || null;
    if (selMesh && canEdit) {
      transform.attach(selMesh);
      boxHelper.setFromObject(selMesh);
      boxHelper.visible = true;
    } else {
      transform.detach();
      boxHelper.visible = false;
    }
    onSelect(selMesh ? readMesh(selMesh) : null);
  }

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downX = 0,
    downY = 0;
  renderer.domElement.addEventListener("pointerdown", (e) => {
    downX = e.clientX;
    downY = e.clientY;
  });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!canEdit) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return; // rotation caméra
    if (transform.dragging || transform.axis) return; // clic sur le gizmo
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    // recursive = true : un modèle est un groupe, le rayon touche ses sous-objets
    const selectionnables = [...meshes.values()].filter((m) => m.visible && !m.userData.locked);
    const hits = ray.intersectObjects(selectionnables, true);
    if (hits.length) {
      let obj = hits[0].object;
      while (obj && obj.userData.id === undefined) obj = obj.parent;
      if (obj && obj.userData.id !== undefined) select(obj.userData.id);
      else select(null);
    } else select(null);
  });

  // ----- Opérations -----
  // Pose un modèle 3D de la bibliothèque au centre de la vue.
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
    };
    platforms.push(pl);
    addMesh(pl);
    select(pl.id);
    commit();
    return pl.id;
  }
  function addPlatform(role) {
    role = role || "track";
    const t = orbit.target;
    const size = ROLE_SIZE[role] || ROLE_SIZE.track;
    const pl = {
      id: genId(role),
      role,
      pos: [round(t.x), round(t.y + 1.5), round(t.z)],
      size: [size[0], size[1], size[2]],
      rot: [0, 0, 0],
      color: undefined,
    };
    platforms.push(pl);
    addMesh(pl);
    select(pl.id);
    commit();
    return pl.id;
  }
  function deleteSelected() {
    if (!selMesh) return;
    const id = selMesh.userData.id;
    transform.detach();
    scene.remove(selMesh);
    meshes.delete(id);
    platforms = platforms.filter((p) => p.id !== id);
    selMesh = null;
    boxHelper.visible = false;
    onSelect(null);
    commit();
  }
  function duplicateSelected() {
    if (!selMesh) return;
    const d = readMesh(selMesh);
    const pl = {
      id: genId(d.role),
      role: d.role,
      pos: [d.pos[0] + 4, d.pos[1] + 1, d.pos[2] + 4],
      size: [d.size[0], d.size[1], d.size[2]],
      rot: [d.rot[0], d.rot[1], d.rot[2]],
      color: d.color,
    };
    platforms.push(pl);
    addMesh(pl);
    select(pl.id);
    commit();
    return pl.id;
  }
  function setMode(mode) {
    if (mode === "translate" || mode === "rotate" || mode === "scale") transform.setMode(mode);
  }
  function setSnap(on) {
    if (on) {
      transform.setTranslationSnap(1);
      transform.setRotationSnap(15 * D2R);
      transform.setScaleSnap(0.5);
    } else {
      transform.setTranslationSnap(null);
      transform.setRotationSnap(null);
      transform.setScaleSnap(null);
    }
  }
  // Modif depuis le panneau de propriétés (valeurs numériques).
  function updateSelected(patch) {
    if (!selMesh) return;
    if (patch.pos) selMesh.position.set(patch.pos[0], patch.pos[1], patch.pos[2]);
    if (patch.size)
      selMesh.scale.set(
        Math.max(0.2, patch.size[0]),
        Math.max(0.2, patch.size[1]),
        Math.max(0.2, patch.size[2]),
      );
    if (patch.rot) selMesh.rotation.set(patch.rot[0] * D2R, patch.rot[1] * D2R, patch.rot[2] * D2R);
    if (patch.role) {
      selMesh.userData.role = patch.role;
      selMesh.material = matFor(patch.role, selMesh.userData.color);
    }
    if (patch.solid !== undefined) {
      selMesh.userData.solid = !!patch.solid;
    }
    if (patch.anim !== undefined) {
      selMesh.userData.anim = patch.anim ? { ...patch.anim } : undefined;
      // remise à plat immédiate quand on coupe l'animation
      const inner = selMesh.userData && selMesh.userData.anime;
      if (inner && !estAnimee({ anim: selMesh.userData.anim })) inner.rotation.set(0, 0, 0);
    }
    if (patch.model !== undefined && patch.model !== selMesh.userData.model) {
      // changement de modèle : on reconstruit l'objet en gardant la transformation
      const garde = readMesh(selMesh);
      garde.model = patch.model;
      const id = garde.id;
      scene.remove(selMesh);
      meshes.delete(id);
      const i = platforms.findIndex((x) => x.id === id);
      if (i >= 0) platforms[i] = garde;
      selMesh = addMesh(garde);
      transform.attach(selMesh);
      boxHelper.setFromObject(selMesh);
      onSelect(readMesh(selMesh));
      commit();
      return;
    }
    if (patch.color !== undefined) {
      selMesh.userData.color = patch.color || undefined;
      selMesh.material = matFor(selMesh.userData.role, selMesh.userData.color);
    }
    syncFromMesh(selMesh);
    boxHelper.setFromObject(selMesh);
    onSelect(readMesh(selMesh));
    commit();
  }
  function frameAll() {
    const arr = [...meshes.values()];
    if (!arr.length) {
      orbit.target.set(0, 8, 30);
      return;
    }
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    for (const m of arr) {
      tmp.setFromObject(m);
      box.union(tmp);
    }
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 10);
    orbit.target.copy(center);
    camera.position.set(center.x + radius * 0.9, center.y + radius * 0.9, center.z - radius * 1.2);
    orbit.update();
  }
  function focusSelected() {
    if (selMesh) {
      orbit.target.copy(selMesh.position);
      orbit.update();
    }
  }
  // Pilotés par la hiérarchie du Studio (œil et cadenas).
  // Active ou coupe l'aperçu des animations dans l'éditeur.
  function setApercuAnim(on) {
    apercuAnim = !!on;
    if (!apercuAnim) {
      for (const [, m] of meshes) {
        const inner = m.userData && m.userData.anime;
        if (inner) inner.rotation.set(0, 0, 0);
      }
    }
  }
  function setPieceFlags(id, flags) {
    const m = meshes.get(id);
    if (!m) return;
    if (flags.hidden !== undefined) {
      m.visible = !flags.hidden;
      if (flags.hidden && selMesh === m) select(null);
    }
    if (flags.locked !== undefined) {
      m.userData.locked = !!flags.locked;
      if (flags.locked && selMesh === m) select(null);
    }
    if (flags.name !== undefined) m.userData.name = flags.name || undefined;
  }
  function setPlatforms(arr) {
    platforms = (arr || []).map(clonePlat);
    transform.detach();
    selMesh = null;
    boxHelper.visible = false;
    rebuildAll();
    onSelect(null);
  }

  // ----- Raccourcis clavier (façon éditeur) -----
  function onKey(e) {
    if (!canEdit) return;
    const tag = e.target && e.target.tagName;
    if (tag && /input|textarea|select/i.test(tag)) return;
    if (e.key === "w" || e.key === "W") setMode("translate");
    else if (e.key === "e" || e.key === "E") setMode("rotate");
    else if (e.key === "r" || e.key === "R") setMode("scale");
    else if (e.key === "f" || e.key === "F") focusSelected();
    else if ((e.key === "Delete" || e.key === "Backspace") && selMesh) {
      e.preventDefault();
      deleteSelected();
    } else if ((e.key === "d" || e.key === "D") && selMesh) {
      e.preventDefault();
      duplicateSelected();
    }
  }
  if (handleKeys) window.addEventListener("keydown", onKey);

  // ----- Boucle de rendu -----
  let raf = 0;
  function loop() {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    orbit.update();
    // Aperçu des obstacles animés. L'animation ne touche que le groupe
    // INTÉRIEUR : la rotation réglée par l'utilisateur et le gizmo restent
    // intacts. Désactivable pour travailler sur une pièce immobile.
    if (apercuAnim) {
      const t = (performance.now() - t0Anim) / 1000;
      for (const [, m] of meshes) {
        if (m.userData && m.userData.anime && m.userData.anim) {
          appliquerAnim(m, { anim: m.userData.anim }, t);
        }
      }
    }
    if (boxHelper.visible && selMesh) boxHelper.setFromObject(selMesh);
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
    window.removeEventListener("resize", resize);
    if (handleKeys) window.removeEventListener("keydown", onKey);
    transform.detach();
    transform.dispose();
    orbit.dispose();
    renderer.dispose();
  }

  resize();
  window.addEventListener("resize", resize);
  raf = requestAnimationFrame(loop);
  // sélection initiale : rien
  onSelect(null);

  return {
    addPlatform,
    addModel,
    deleteSelected,
    duplicateSelected,
    setMode,
    setSnap,
    updateSelected,
    frameAll,
    focusSelected,
    select,
    setApercuAnim,
    setPieceFlags,
    setPlatforms,
    getPlatforms,
    resize,
    dispose,
  };
}
