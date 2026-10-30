const { contextBridge, ipcRenderer } = require("electron");

// Jediné, co web od aplikace dostane. Žádný přístup k souborům ani k systému.
contextBridge.exposeInMainWorld("playhaven", {
  isApp: true,
  info: () => ipcRenderer.invoke("app:info"),
  getState: () => ipcRenderer.invoke("state:get"),
  onState: (cb) => {
    const handler = (_e, state) => cb(state);
    ipcRenderer.on("state", handler);
    return () => ipcRenderer.removeListener("state", handler);
  },
  setAlwaysOnTop: (on) => ipcRenderer.invoke("win:aot", !!on),
});
