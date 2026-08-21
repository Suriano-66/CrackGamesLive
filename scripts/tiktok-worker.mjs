// -----------------------------------------------------------------------------
// Connecteur TikTok Live -> WebSocket
//
// Écoute le live TikTok d'un pseudo et diffuse les cadeaux/commentaires
// normalisés à tous les overlays connectés (le jeu s'y abonne).
//
// Usage :
//   npm run tiktok -- @ton_pseudo
//   (ou)  TIKTOK_USERNAME=@ton_pseudo npm run tiktok
//
// Port WebSocket : 3002 par défaut (variable WS_PORT pour changer).
// -----------------------------------------------------------------------------
import { WebSocketServer } from "ws";
import * as TT from "tiktok-live-connector";

const rawUser = process.argv[2] || process.env.TIKTOK_USERNAME || "";
const username = rawUser.replace(/^@+/, "").trim();
const WS_PORT = parseInt(process.env.WS_PORT || "3002", 10);

if (!username) {
  console.error("❌ Précise un pseudo TikTok : npm run tiktok -- @ton_pseudo");
  process.exit(1);
}

// --- Serveur WebSocket pour les overlays ---
const wss = new WebSocketServer({ port: WS_PORT });
console.log(`🔌 WebSocket prêt sur ws://localhost:${WS_PORT}`);

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

wss.on("connection", () => {
  console.log(`👀 Un overlay est connecté (${wss.clients.size} au total)`);
});

// --- Résolution de la classe de connexion (compatible v1 et v2) ---
const ConnectionClass =
  TT.TikTokLiveConnection ||
  TT.default?.TikTokLiveConnection ||
  TT.WebcastPushConnection ||
  TT.default?.WebcastPushConnection;

if (!ConnectionClass) {
  console.error("❌ Version de tiktok-live-connector non reconnue.");
  process.exit(1);
}

// --- Helpers de normalisation (tolérants aux différences de format) ---
function pick(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return undefined;
}

function normalizeGift(data) {
  const user = data.user || {};
  const gift = data.gift || data.giftDetails || {};
  const uniqueId = pick(user.uniqueId, data.uniqueId, data.userId, "anon");
  const nickname = pick(user.nickname, data.nickname, uniqueId);
  const avatar = pick(
    user.profilePicture?.urls?.[0],
    user.profilePicture?.url?.[0],
    user.profilePictureUrl,
    data.profilePictureUrl,
    Array.isArray(data.profilePictureUrls) ? data.profilePictureUrls[0] : undefined,
    "",
  );
  const diamonds = Number(
    pick(gift.diamondCount, data.diamondCount, gift.diamond_count, 1),
  );
  const count = Number(pick(data.repeatCount, data.repeat_count, gift.repeatCount, 1));
  const giftName = pick(gift.name, data.giftName, gift.giftName, "cadeau");
  const giftType = pick(gift.type, data.giftType, gift.giftType);
  const repeatEnd = pick(data.repeatEnd, data.repeat_end);
  return { uniqueId, nickname, avatar, diamonds, count, giftName, giftType, repeatEnd };
}

// --- Connexion TikTok ---
const conn = new ConnectionClass(username);

function on(event, handler) {
  try {
    conn.on(event, handler);
  } catch {
    /* certains events peuvent ne pas exister selon la version */
  }
}

on("connected", (state) => {
  console.log(`✅ Connecté au live de @${username}` + (state?.roomId ? ` (room ${state.roomId})` : ""));
  broadcast({ type: "connected" });
});

on("disconnected", () => {
  console.log("⚠️  Déconnecté du live.");
  broadcast({ type: "disconnected" });
});

on("streamEnd", () => {
  console.log("🏁 Le live est terminé.");
  broadcast({ type: "disconnected" });
});

on("gift", (data) => {
  const g = normalizeGift(data);
  // Cadeaux "streakables" : on ne compte qu'à la fin de la série.
  if (g.giftType === 1 && g.repeatEnd === false) return;
  console.log(`🎁 ${g.nickname} offre ${g.giftName} x${g.count} (${g.diamonds}💎)`);
  broadcast({
    type: "gift",
    userId: g.uniqueId,
    nickname: g.nickname,
    avatar: g.avatar,
    giftName: g.giftName,
    diamonds: g.diamonds,
    count: g.count,
  });
});

on("chat", (data) => {
  const user = data.user || {};
  broadcast({
    type: "chat",
    userId: pick(user.uniqueId, data.uniqueId, "anon"),
    nickname: pick(user.nickname, data.nickname, "viewer"),
    avatar: pick(user.profilePicture?.urls?.[0], data.profilePictureUrl, ""),
    comment: pick(data.comment, ""),
  });
});

async function start() {
  try {
    console.log(`⏳ Connexion au live de @${username}…`);
    await conn.connect();
  } catch (err) {
    console.error(
      `❌ Connexion impossible : ${err?.message || err}. ` +
        `Vérifie que @${username} est bien EN LIVE, puis relance.`,
    );
    // Nouvelle tentative dans 15s (au cas où le live démarre bientôt).
    setTimeout(start, 15000);
  }
}

start();

process.on("SIGINT", () => {
  console.log("\n👋 Arrêt du connecteur.");
  try {
    conn.disconnect?.();
  } catch {
    /* noop */
  }
  wss.close();
  process.exit(0);
});
