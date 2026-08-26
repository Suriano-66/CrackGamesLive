// Pont sécurisé entre le renderer et le processus principal.
// Le renderer n'a pas accès à Node ; il passe par window.studio.*
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("studio", {
  getConfig: () => ipcRenderer.invoke("cfg:get"),
  setConfig: (cfg) => ipcRenderer.invoke("cfg:set", cfg),
  api: (method, path, body) => ipcRenderer.invoke("api:request", { method, path, body }),
  isDesktop: true,
});
