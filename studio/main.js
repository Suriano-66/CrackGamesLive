// Processus principal Electron du "CrackGames Studio".
// - Ouvre la fenêtre de l'app (renderer).
// - Stocke la config (URL du site + clé studio) dans le dossier userData.
// - Fait les appels à l'API du site DEPUIS le processus principal (Node),
//   ce qui évite tout souci de CORS et garde la clé hors du renderer.
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

let win = null;

function configPath() {
  return path.join(app.getPath("userData"), "studio-config.json");
}
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), "utf8"));
  } catch {
    return { baseUrl: "http://localhost:3000", apiKey: "" };
  }
}
function saveConfig(cfg) {
  const cur = loadConfig();
  const next = { ...cur, ...cfg };
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#0c111c",
    title: "CrackGames Studio",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  // liens externes → navigateur système
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ----- IPC : config -----
ipcMain.handle("cfg:get", () => loadConfig());
ipcMain.handle("cfg:set", (_e, cfg) => saveConfig(cfg || {}));

// ----- IPC : appels API vers le site -----
ipcMain.handle("api:request", async (_e, { method, path: apiPath, body }) => {
  const cfg = loadConfig();
  if (!cfg.baseUrl) return { ok: false, status: 0, error: "URL du site non configurée." };
  const url = cfg.baseUrl.replace(/\/+$/, "") + apiPath;
  try {
    const res = await fetch(url, {
      method: method || "GET",
      headers: {
        "content-type": "application/json",
        "x-studio-key": cfg.apiKey || "",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    const txt = await res.text();
    try {
      data = txt ? JSON.parse(txt) : null;
    } catch {
      data = { raw: txt };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: String((err && err.message) || err) };
  }
});
