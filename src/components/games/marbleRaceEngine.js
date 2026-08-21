// Moteur 3D de "La grande course" — Three.js + cannon-es.
// Circuit sinueux : virages bankés, tremplins, un looping, skybox.
// Module autonome (importé par le composant React ET testable en standalone).
import * as THREE from "three";
import * as CANNON from "cannon-es";

// ----- Paramètres -----
const ROAD_W = 9; // largeur de la route
const TILE = 4.2; // longueur d'une tuile
const MARBLE_R = 0.42; // billes plus petites
const MAX_LIVE = 150;
const MAX_BALLS = 100;
const RACE_MAX_MS = 90000;
const INTERMISSION_MS = 8000;
const CAM_SWITCH_MS = 5500;
const DESCENT = 0.26; // pente de descente (radians)

function marblesForGift(diamonds, count) {
  const v = Math.max(0, diamonds) * Math.max(1, count || 1);
  if (v < 5) return 1;
  if (v < 20) return 2;
  if (v < 50) return 3;
  if (v < 100) return 5;
  if (v < 300) return 7;
  return 10;
}
function hashHue(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function createMarbleRace3D(canvas, opts = {}) {
  const onState = opts.onState || (() => {});
  let disposed = false;

  // ----- Rendu -----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 3000);
  camera.position.set(0, 30, -30);

  scene.add(new THREE.HemisphereLight(0xbcd6ff, 0x1a2030, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-40, 80, -20);
  scene.add(sun);

  // ----- Skybox (procédurale : dégradé + étoiles) -----
  function buildSky() {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 1024;
    const g = c.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 0, 1024);
    grd.addColorStop(0, "#0a1030");
    grd.addColorStop(0.45, "#241a4a");
    grd.addColorStop(0.75, "#5b2a63");
    grd.addColorStop(1, "#0b0f1a");
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 620;
      const r = Math.random() * 1.4 + 0.2;
      g.globalAlpha = 0.4 + Math.random() * 0.6;
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(x, y, r, 0, 7);
      g.fill();
    }
    g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1400, 40, 20),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }),
    );
    scene.add(sky);
    scene.fog = new THREE.Fog(0x241a4a, 120, 460);
  }
  buildSky();

  // ----- Physique -----
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -34, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = false;
  const matGround = new CANNON.Material("ground");
  const matBall = new CANNON.Material("ball");
  world.addContactMaterial(
    new CANNON.ContactMaterial(matGround, matBall, { friction: 0.06, restitution: 0.2 }),
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(matBall, matBall, { friction: 0.02, restitution: 0.3 }),
  );

  const S = {
    players: new Map(),
    marbles: [],
    spawnQueue: [],
    trackMeshes: [],
    trackBodies: [],
    nodes: [],
    startNode: new THREE.Vector3(0, 40, 0),
    startDir: new THREE.Vector3(0, 0, 1),
    finishY: 0,
    phase: "filling",
    phaseStart: 0,
    raceStart: 0,
    finishOrder: [],
    camMode: 0,
    camModeStart: 0,
    lastNudge: 0,
    lastState: 0,
    seed: 1,
    winner: null,
    connected: false,
    camLook: new THREE.Vector3(0, 0, 0),
    camVel: new THREE.Vector3(0, 0, 1),
  };

  function rnd() {
    S.seed = (S.seed * 1103515245 + 12345) & 0x7fffffff;
    return S.seed / 0x7fffffff;
  }

  // ----- Génération du tracé (turtle + features) -----
  function dirFromYawPitch(yaw, pitch) {
    return new THREE.Vector3(
      Math.cos(pitch) * Math.sin(yaw),
      Math.sin(pitch),
      Math.cos(pitch) * Math.cos(yaw),
    ).normalize();
  }
  const GUP = new THREE.Vector3(0, 1, 0);
  function bankedUp(forward, bank) {
    // up perpendiculaire au forward, incliné (roll) de `bank`
    let up = GUP.clone().addScaledVector(forward, -GUP.dot(forward)).normalize();
    if (bank) {
      const q = new THREE.Quaternion().setFromAxisAngle(forward, bank);
      up.applyQuaternion(q);
    }
    return up;
  }

  function genPath() {
    const nodes = [];
    let pos = new THREE.Vector3(0, 46, 0);
    let yaw = 0;
    nodes.push({ p: pos.clone(), u: GUP.clone(), loop: false });

    function segment(len, yawDelta, bank, loop) {
      const steps = Math.max(1, Math.round(len / TILE));
      const dyaw = yawDelta / steps;
      for (let i = 0; i < steps; i++) {
        yaw += dyaw;
        const f = dirFromYawPitch(yaw, -DESCENT);
        pos = pos.clone().addScaledVector(f, TILE);
        nodes.push({ p: pos.clone(), u: bankedUp(f, bank), loop: !!loop });
      }
    }

    function jump(len) {
      // tremplin : monte puis redescend (bosse), sans trou
      const steps = Math.max(3, Math.round(len / TILE));
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const pitch = Math.sin(t * Math.PI) * 0.5 - DESCENT * 0.4; // haut au milieu
        const f = dirFromYawPitch(yaw, pitch);
        pos = pos.clone().addScaledVector(f, TILE);
        nodes.push({ p: pos.clone(), u: bankedUp(f, 0), loop: false });
      }
    }

    function loopFeature(radius) {
      // looping vertical dans le plan (h horizontal, u vertical)
      const h = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      const u = GUP.clone();
      const center = pos.clone().addScaledVector(u, radius);
      const N = 26;
      for (let i = 1; i <= N; i++) {
        const th = (i / N) * Math.PI * 2;
        const p = center
          .clone()
          .addScaledVector(u, -Math.cos(th) * radius)
          .addScaledVector(h, Math.sin(th) * radius);
        // normale de route pointe vers le centre
        const up = u
          .clone()
          .multiplyScalar(Math.cos(th))
          .addScaledVector(h, -Math.sin(th))
          .normalize();
        nodes.push({ p: p.clone(), u: up, loop: true });
        pos = p.clone();
      }
      // reprend tout droit après la boucle
    }

    // Séquence du circuit (assez long)
    segment(34, 0, 0);
    segment(30, 1.3, 0.5); // virage droite banké
    segment(26, 0, 0);
    jump(20); // tremplin
    segment(26, -1.5, -0.55); // virage gauche banké
    segment(24, 0, 0);
    loopFeature(9); // LOOPING
    segment(24, 0, 0);
    segment(30, 1.4, 0.55); // virage droite
    jump(18);
    segment(28, -1.2, -0.5); // virage gauche
    segment(26, 0, 0);
    segment(28, 1.1, 0.45);
    jump(20);
    segment(40, 0, 0); // ligne d'arrivée
    return nodes;
  }

  // ----- Construction géométrie depuis le tracé -----
  const _right = new THREE.Vector3();
  const _up2 = new THREE.Vector3();
  const _mat = new THREE.Matrix4();
  const _quat = new THREE.Quaternion();
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a3350, roughness: 0.9, metalness: 0.05 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xff3c5f, roughness: 0.5, metalness: 0.2, emissive: 0x3a0a14 });

  function orientedBox(w, h, l, center, forward, up, mat) {
    _right.crossVectors(up, forward).normalize();
    _up2.crossVectors(forward, _right).normalize();
    _mat.makeBasis(_right, _up2, forward.clone().normalize());
    _quat.setFromRotationMatrix(_mat);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
    mesh.position.copy(center);
    mesh.quaternion.copy(_quat);
    scene.add(mesh);
    S.trackMeshes.push(mesh);
    const body = new CANNON.Body({ mass: 0, material: matGround });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, l / 2)));
    body.position.set(center.x, center.y, center.z);
    body.quaternion.set(_quat.x, _quat.y, _quat.z, _quat.w);
    world.addBody(body);
    S.trackBodies.push(body);
    return { right: _right.clone(), up: _up2.clone() };
  }

  function clearTrack() {
    for (const m of S.trackMeshes) {
      scene.remove(m);
      m.geometry.dispose();
    }
    for (const b of S.trackBodies) world.removeBody(b);
    S.trackMeshes = [];
    S.trackBodies = [];
  }

  function buildTrack() {
    clearTrack();
    const nodes = genPath();
    S.nodes = nodes;
    S.startNode = nodes[0].p.clone();
    S.startDir = nodes[1].p.clone().sub(nodes[0].p).normalize();
    let minY = Infinity;
    for (const n of nodes) if (n.p.y < minY) minY = n.p.y;
    S.finishY = minY + 1.5;

    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i].p;
      const b = nodes[i + 1].p;
      const forward = b.clone().sub(a);
      const len = forward.length() + 0.6;
      forward.normalize();
      const up = nodes[i].u.clone();
      const center = a.clone().add(b).multiplyScalar(0.5);
      const basis = orientedBox(ROAD_W, 0.8, len, center, forward, up, roadMat);
      // rails
      const railH = nodes[i].loop ? 1.4 : 1.9;
      for (const s of [-1, 1]) {
        const rc = center
          .clone()
          .addScaledVector(basis.right, (s * ROAD_W) / 2)
          .addScaledVector(basis.up, railH / 2);
        orientedBox(0.5, railH, len, rc, forward, up, railMat);
      }
    }
  }

  // ----- Billes -----
  const ballGeo = new THREE.SphereGeometry(MARBLE_R, 14, 14);
  function spawnMarble(p) {
    if (S.marbles.length >= MAX_LIVE) return;
    const off = new THREE.Vector3((rnd() - 0.5) * (ROAD_W - 2), 0, (rnd() - 0.5) * 3);
    const start = S.startNode.clone().add(off).add(new THREE.Vector3(0, 3 + rnd() * 2, 0));
    const body = new CANNON.Body({
      mass: 1,
      material: matBall,
      shape: new CANNON.Sphere(MARBLE_R),
      linearDamping: 0.01,
      angularDamping: 0.15,
    });
    body.position.set(start.x, start.y, start.z);
    body.velocity.set(S.startDir.x * 4, 0, S.startDir.z * 4);
    world.addBody(body);
    const col = new THREE.Color(p.color);
    const mesh = new THREE.Mesh(
      ballGeo,
      new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.2,
        metalness: 0.4,
        emissive: col.clone().multiplyScalar(0.18),
      }),
    );
    scene.add(mesh);
    S.marbles.push({ body, mesh, playerId: p.id, finished: false });
  }
  function queueSpawns(p, n) {
    for (let i = 0; i < n; i++) S.spawnQueue.push(p);
  }

  // ----- Avatars -----
  const avatarCache = new Map();
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function avatarTexture(p) {
    if (avatarCache.has(p.id)) return avatarCache.get(p.id);
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 320;
    const g = c.getContext("2d");
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(128, 104, 92, 0, 7);
    g.fill();
    if (p.img && p.img.complete && p.img.naturalWidth > 0) {
      g.save();
      g.beginPath();
      g.arc(128, 104, 88, 0, 7);
      g.clip();
      try {
        g.drawImage(p.img, 40, 16, 176, 176);
      } catch {}
      g.restore();
    } else {
      g.fillStyle = "#fff";
      g.font = "700 104px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText((p.name[0] || "?").toUpperCase(), 128, 112);
    }
    g.lineWidth = 8;
    g.strokeStyle = "rgba(255,255,255,.9)";
    g.beginPath();
    g.arc(128, 104, 92, 0, 7);
    g.stroke();
    const name = p.name.length > 12 ? p.name.slice(0, 12) : p.name;
    g.font = "700 38px sans-serif";
    const tw = g.measureText(name).width;
    g.fillStyle = "rgba(8,10,16,.82)";
    roundRect(g, 128 - tw / 2 - 14, 222, tw + 28, 54, 14);
    g.fill();
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(name, 128, 249);
    if (p.full) g.fillText("⚠️", 128 + tw / 2 + 30, 249);
    const tex = new THREE.CanvasTexture(c);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
    );
    sprite.scale.set(2.6, 3.25, 1);
    const entry = { sprite, tex, full: p.full, hasImg: !!(p.img && p.img.complete) };
    avatarCache.set(p.id, entry);
    scene.add(sprite);
    return entry;
  }

  // ----- Joueurs / cadeaux -----
  function ensurePlayer(id, name, avatar) {
    let p = S.players.get(id);
    if (!p) {
      const hue = Math.round((S.players.size * 137.508 + (hashHue(id) % 40)) % 360);
      p = { id, name: name || "Viewer", color: `hsl(${hue}, 85%, 60%)`, ballCount: 0, full: false, finishRank: null, img: null };
      if (avatar) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = avatar;
        p.img = img;
      }
      S.players.set(id, p);
    }
    return p;
  }
  function handleGift(userId, nickname, avatar, diamonds, count) {
    const p = ensurePlayer(userId, nickname, avatar);
    if (p.ballCount >= MAX_BALLS) {
      p.full = true;
      return;
    }
    const before = p.ballCount;
    p.ballCount = Math.min(MAX_BALLS, p.ballCount + marblesForGift(diamonds, count));
    if (p.ballCount >= MAX_BALLS) p.full = true;
    const gained = p.ballCount - before;
    if (S.phase !== "intermission" && gained > 0) queueSpawns(p, gained);
  }

  function removeAllMarbles() {
    for (const m of S.marbles) {
      world.removeBody(m.body);
      scene.remove(m.mesh);
      m.mesh.material.dispose();
    }
    S.marbles = [];
  }
  function startRace(now) {
    S.seed = Math.floor((now % 100000) + S.players.size * 7 + 3);
    S.finishOrder = [];
    S.winner = null;
    S.spawnQueue = [];
    for (const p of S.players.values()) p.finishRank = null;
    removeAllMarbles();
    buildTrack();
    for (const p of S.players.values()) queueSpawns(p, p.ballCount);
    S.phase = S.players.size === 0 ? "filling" : "racing";
    S.phaseStart = now;
    S.raceStart = now;
    S.camMode = 0;
    S.camModeStart = now;
  }
  function endRace(now) {
    S.phase = "intermission";
    S.phaseStart = now;
    S.winner = S.finishOrder[0] || null;
  }

  // ----- Caméra qui suit le tracé -----
  const _v = new THREE.Vector3();
  const _c = new THREE.Vector3();
  function packInfo() {
    let n = 0;
    _c.set(0, 0, 0);
    _v.set(0, 0, 0);
    let lead = null,
      leadProg = -Infinity,
      last = null,
      lastProg = Infinity;
    for (const m of S.marbles) {
      if (m.finished) continue;
      _c.add(m.body.position);
      _v.x += m.body.velocity.x;
      _v.y += m.body.velocity.y;
      _v.z += m.body.velocity.z;
      n++;
      const prog = -m.body.position.y;
      if (prog > leadProg) {
        leadProg = prog;
        lead = m;
      }
      if (prog < lastProg) {
        lastProg = prog;
        last = m;
      }
    }
    if (!n) return null;
    _c.multiplyScalar(1 / n);
    return { c: _c.clone(), v: _v.clone(), lead, last, n };
  }
  const _down = new THREE.Vector3(0, 1, 0);
  function updateCamera(now) {
    let camPos = new THREE.Vector3(0, 70, -40);
    let look = new THREE.Vector3(0, 40, 6);
    const info = packInfo();
    if (info && (S.phase === "racing" || S.phase === "intermission")) {
      // Direction HORIZONTALE de progression (évite que la caméra pointe le ciel)
      let dir = info.v.clone();
      dir.y = 0;
      if (dir.lengthSq() < 0.5) dir = S.camVel.clone();
      dir.normalize();
      S.camVel.lerp(dir, 0.05);
      S.camVel.y = 0;
      if (S.camVel.lengthSq() < 0.01) S.camVel.set(0, 0, 1);
      S.camVel.normalize();
      const d = S.camVel;

      if (S.phase === "racing" && now - S.camModeStart > CAM_SWITCH_MS) {
        S.camMode = (S.camMode + 1) % 3;
        S.camModeStart = now;
      }
      // Toujours : derrière + au-dessus, regard vers l'avant ET vers le bas.
      let back, up, ahead, down, center;
      if (S.camMode === 1 && info.lead) {
        center = info.lead.body.position;
        back = 13; up = 11; ahead = 9; down = 5;
      } else if (S.camMode === 2) {
        center = info.c;
        back = 30; up = 38; ahead = 8; down = 12;
      } else {
        center = info.c;
        back = 24; up = 20; ahead = 12; down = 7;
      }
      camPos.copy(center).addScaledVector(d, -back);
      camPos.y = center.y + up;
      look.copy(center).addScaledVector(d, ahead);
      look.y = center.y - down;
    }
    camera.position.lerp(camPos, 0.06);
    S.camLook.lerp(look, 0.08);
    camera.lookAt(S.camLook);
  }

  function emitState(now) {
    const arrived = S.finishOrder.slice();
    const aset = new Set(arrived.map((p) => p.id));
    const racing = [...S.players.values()]
      .filter((p) => !aset.has(p.id))
      .map((p) => {
        let best = Infinity;
        for (const m of S.marbles) if (m.playerId === p.id && m.body.position.y < best) best = m.body.position.y;
        return { p, prog: -best };
      })
      .sort((a, b) => b.prog - a.prog)
      .map((o) => o.p);
    const ordered = [...arrived, ...racing].slice(0, 12).map((p, i) => ({
      rank: i + 1,
      id: p.id,
      name: p.name,
      color: p.color,
      balls: p.ballCount,
      full: p.full,
      avatar: p.img && p.img.complete ? p.img.src : null,
    }));
    let timer = 0;
    if (S.phase === "racing") timer = Math.max(0, Math.ceil((RACE_MAX_MS - (now - S.raceStart)) / 1000));
    onState({
      phase: S.phase,
      timer,
      connected: S.connected,
      players: S.players.size,
      board: ordered,
      winner: S.winner
        ? { name: S.winner.name, color: S.winner.color, avatar: S.winner.img && S.winner.img.complete ? S.winner.img.src : null }
        : null,
    });
  }

  // ----- Boucle -----
  let raf = 0;
  let last = performance.now();
  function frame(now) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (S.phase === "filling") {
      if (S.players.size > 0 && now - S.phaseStart > 2500) startRace(now);
    } else if (S.phase === "racing") {
      const active = S.marbles.filter((m) => !m.finished);
      if ((active.length === 0 && S.marbles.length > 0) || now - S.raceStart > RACE_MAX_MS) endRace(now);
      if (S.marbles.length === 0 && now - S.raceStart > 6000) endRace(now);
    } else if (S.phase === "intermission") {
      if (now - S.phaseStart > INTERMISSION_MS) startRace(now);
    }

    let budget = 3;
    while (budget-- > 0 && S.spawnQueue.length) spawnMarble(S.spawnQueue.shift());

    world.step(1 / 60, dt, 3);

    const doNudge = now - S.lastNudge > 700;
    if (doNudge) S.lastNudge = now;
    for (const m of S.marbles) {
      if (m.finished) continue;
      const bp = m.body.position;
      m.mesh.position.set(bp.x, bp.y, bp.z);
      m.mesh.quaternion.set(m.body.quaternion.x, m.body.quaternion.y, m.body.quaternion.z, m.body.quaternion.w);
      if (bp.y <= S.finishY) {
        m.finished = true;
        const p = S.players.get(m.playerId);
        if (p && p.finishRank == null) {
          p.finishRank = S.finishOrder.length + 1;
          S.finishOrder.push(p);
        }
        world.removeBody(m.body);
        scene.remove(m.mesh);
        continue;
      }
      if (bp.y < S.finishY - 30) {
        m.finished = true;
        world.removeBody(m.body);
        scene.remove(m.mesh);
        continue;
      }
      if (doNudge) {
        const v = m.body.velocity;
        if (Math.hypot(v.x, v.y, v.z) < 0.7) {
          v.x += (rnd() - 0.5) * 4;
          v.z += (rnd() - 0.5) * 4;
          v.y += 1;
        }
      }
    }
    S.marbles = S.marbles.filter((m) => !m.finished);

    // Avatars sur la bille de tête de chaque joueur
    const lead = new Map();
    for (const m of S.marbles) {
      const prev = lead.get(m.playerId);
      if (!prev || m.body.position.y < prev.body.position.y) lead.set(m.playerId, m);
    }
    for (const [, entry] of avatarCache) entry.sprite.visible = false;
    for (const [pid, m] of lead) {
      const p = S.players.get(pid);
      if (!p) continue;
      let a = avatarTexture(p);
      if (a.full !== p.full || (!a.hasImg && p.img && p.img.complete)) {
        avatarCache.delete(pid);
        scene.remove(a.sprite);
        a = avatarTexture(p);
      }
      a.sprite.visible = true;
      a.sprite.position.set(m.body.position.x, m.body.position.y + 1.7, m.body.position.z);
    }

    updateCamera(now);
    renderer.render(scene, camera);

    if (now - S.lastState > 220) {
      S.lastState = now;
      emitState(now);
    }
  }

  // ----- API -----
  function handleEvent(e) {
    if (e && e.type === "gift") handleGift(e.userId, e.nickname, e.avatar, e.diamonds, e.count);
    else if (e && e.type === "connected") S.connected = true;
    else if (e && e.type === "disconnected") S.connected = false;
  }
  function setConnected(v) {
    S.connected = v;
  }
  function resize() {
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    removeAllMarbles();
    clearTrack();
    for (const [, a] of avatarCache) {
      scene.remove(a.sprite);
      a.tex.dispose();
    }
    avatarCache.clear();
    renderer.dispose();
  }

  buildTrack();
  S.phase = "filling";
  S.phaseStart = performance.now();
  resize();
  window.addEventListener("resize", resize);
  raf = requestAnimationFrame(frame);

  return { handleEvent, setConnected, resize, dispose };
}
