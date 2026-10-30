const { app, BrowserWindow, Tray, Menu, ipcMain, shell, Notification, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const { LeagueConnector } = require("./lcu");

// Adresa webu: PLAYHAVEN_URL v prostředí, nebo "url" v config.json ve složce aplikace, nebo výchozí.
const DEFAULT_URL = "https://playhaven.up.railway.app";
const configPath = () => path.join(app.getPath("userData"), "config.json");
function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), "utf8")); } catch { return {}; }
}
function writeConfig(patch) {
  try { fs.writeFileSync(configPath(), JSON.stringify({ ...readConfig(), ...patch }, null, 2)); } catch { /* nevadí */ }
}
const SITE = (process.env.PLAYHAVEN_URL || readConfig().url || DEFAULT_URL).replace(/\/$/, "");
const SITE_ORIGIN = new URL(SITE).origin;
const ALLOWED = [SITE_ORIGIN, "https://discord.com", "https://discordapp.com", "https://steamcommunity.com"];
const allowed = (u) => { try { return ALLOWED.includes(new URL(u).origin); } catch { return false; } };

let win = null;
let tray = null;
let quitting = false;
const league = new LeagueConnector();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showWindow());
}

function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow() {
  const cfg = readConfig();
  win = new BrowserWindow({
    width: 1180, height: 820, minWidth: 420, minHeight: 600,
    backgroundColor: cfg.bg || "#0c070e",
    title: "Play Haven",
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    autoHideMenuBar: true,
    show: !cfg.startHidden,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setMenu(null);
  // Barva okna se řídí tématem, které si hráč zvolil na webu (pozadí se pamatuje na příští start).
  const syncTheme = () => {
    win.webContents
      .executeJavaScript(`(() => { const v = getComputedStyle(document.documentElement).getPropertyValue("--ink-950").trim().split(/\\s+/).map(Number); return v.length === 3 && v.every((n) => n >= 0) ? "#" + v.map((n) => n.toString(16).padStart(2, "0")).join("") : null; })()`)
      .then((hex) => { if (hex) { win.setBackgroundColor(hex); writeConfig({ bg: hex }); } })
      .catch(() => null);
  };
  win.webContents.on("did-finish-load", syncTheme);
  win.webContents.on("did-navigate-in-page", syncTheme);
  // Web pozná aplikaci podle "PlayHavenApp" v user agentu. "Electron" z něj odebereme, aby přihlášení přes Discord fungovalo.
  const ua = win.webContents.userAgent.replace(/ Electron\/\S+/, "").replace(/ play-haven-desktop\/\S+/, "");
  win.webContents.setUserAgent(`${ua} PlayHavenApp/${app.getVersion()}`);

  const start = () => win.loadURL(`${SITE}/live`).catch(() => null); // chybu řeší did-fail-load
  win.webContents.on("did-fail-load", (_e, code, _d, url, isMain) => {
    if (!isMain || code === -3) return;
    win.loadFile(path.join(__dirname, "offline.html"), { query: { u: `${SITE}/live` } });
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (allowed(url)) win.loadURL(url).catch(() => null);
    else shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith("file:") || allowed(url)) return;
    e.preventDefault();
    shell.openExternal(url);
  });
  win.on("close", (e) => {
    if (quitting) return;
    e.preventDefault(); // zavření jen schová okno do lišty, aplikace dál sleduje klienta
    win.hide();
  });
  win.on("closed", () => { win = null; });
  start();
}

function buildTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "..", "assets", "tray.png"));
  tray = new Tray(icon);
  tray.setToolTip("Play Haven");
  const render = () =>
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Otevřít Play Haven", click: showWindow },
        { type: "separator" },
        {
          label: "Okno vždy nad ostatními", type: "checkbox", checked: !!win && win.isAlwaysOnTop(),
          click: (item) => { if (win) win.setAlwaysOnTop(item.checked, "screen-saver"); },
        },
        {
          label: "Spouštět s Windows", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin,
          click: (item) => { app.setLoginItemSettings({ openAtLogin: item.checked, args: ["--hidden"] }); },
        },
        { type: "separator" },
        { label: "Konec", click: () => { quitting = true; app.quit(); } },
      ])
    );
  render();
  tray.on("click", showWindow);
  tray.on("right-click", render);
}

ipcMain.handle("app:info", () => ({ version: app.getVersion(), site: SITE, alwaysOnTop: !!win && win.isAlwaysOnTop() }));
ipcMain.handle("state:get", () => league.state);
ipcMain.handle("win:aot", (_e, on) => { if (win) win.setAlwaysOnTop(on, "screen-saver"); return !!on; });

app.whenReady().then(() => {
  if (process.argv.includes("--hidden")) writeConfig({ startHidden: true });
  else writeConfig({ startHidden: false });
  createWindow();
  buildTray();

  let lastPhase = "None";
  league.on("state", (s) => {
    if (win && !win.isDestroyed()) win.webContents.send("state", s);
    // Upozornění na začátek champ selectu, když je okno schované.
    if (s.phase === "ChampSelect" && lastPhase !== "ChampSelect" && Notification.isSupported() && (!win || !win.isVisible())) {
      const n = new Notification({ title: "Play Haven", body: "Champ select začal. Klikni pro scouting spoluhráčů." });
      n.on("click", showWindow);
      n.show();
    }
    lastPhase = s.phase;
  });
  league.start();
});

app.on("before-quit", () => { quitting = true; league.stop(); });
app.on("window-all-closed", () => { /* zůstáváme v liště */ });
