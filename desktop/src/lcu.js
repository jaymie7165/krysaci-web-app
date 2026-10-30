// Napojení na lokální API League klienta. Čte jen data (fáze hry, champ select), nic nehraje za hráče.
const https = require("https");
const fs = require("fs");
const { execFile } = require("child_process");
const { EventEmitter } = require("events");

const agent = new https.Agent({ rejectUnauthorized: false }); // klient má vlastní certifikát a jen na 127.0.0.1

// Region z League klienta na platformu Riot API.
const PLATFORM = {
  EUNE: "eun1", EUN: "eun1", EUW: "euw1", NA: "na1", NA1: "na1", KR: "kr", JP: "jp1", JP1: "jp1",
  BR: "br1", BR1: "br1", LAN: "la1", LAS: "la2", OCE: "oc1", OC1: "oc1", TR: "tr1", TR1: "tr1",
  RU: "ru", ME1: "me1", SG2: "sg2", TW2: "tw2", VN2: "vn2",
};

function run(cmd, args, timeout = 5000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => resolve(err ? "" : String(stdout)));
  });
}

async function findCredentials() {
  let line = "";
  if (process.platform === "win32") {
    line = await run("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command",
      "Get-CimInstance Win32_Process -Filter \"name='LeagueClientUx.exe'\" | Select-Object -ExpandProperty CommandLine",
    ]);
  } else {
    const out = await run("ps", ["-ax", "-o", "args"]);
    line = out.split("\n").find((l) => l.includes("LeagueClientUx")) || "";
  }
  const port = /--app-port=(\d+)/.exec(line);
  const token = /--remoting-auth-token=([\w-]+)/.exec(line);
  if (port && token) return { port: Number(port[1]), token: token[1] };

  // Záložní cesta: soubor lockfile v obvyklých složkách.
  const dirs = ["C:\\Riot Games\\League of Legends", "D:\\Riot Games\\League of Legends", "/Applications/League of Legends.app/Contents/LoL"];
  for (const d of dirs) {
    try {
      const [, , p, pw] = fs.readFileSync(`${d}${process.platform === "win32" ? "\\" : "/"}lockfile`, "utf8").split(":");
      if (p && pw) return { port: Number(p), token: pw };
    } catch { /* tato složka lockfile nemá */ }
  }
  return null;
}

function get(creds, path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: "127.0.0.1", port: creds.port, path, method: "GET", agent, timeout: 3000,
        headers: { Authorization: "Basic " + Buffer.from(`riot:${creds.token}`).toString("base64"), Accept: "application/json" },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode === 404) return resolve(null);
          if (res.statusCode >= 400) return reject(new Error(`LCU ${res.statusCode}`));
          try { resolve(body ? JSON.parse(body) : null); } catch { resolve(null); }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

const member = (m) => ({
  cellId: m.cellId,
  puuid: m.puuid || null,
  summonerId: m.summonerId || 0,
  championId: m.championId || m.championPickIntent || 0,
  position: m.assignedPosition || "",
  name: m.gameName ? `${m.gameName}#${m.tagLine || ""}` : null,
});

class LeagueConnector extends EventEmitter {
  constructor() {
    super();
    this.creds = null;
    this.me = null;
    this.platform = null;
    this.names = new Map(); // summonerId -> { puuid, name }
    this.state = { connected: false, phase: "None", me: null, platform: null, champSelect: null };
    this.last = "";
    this.stopped = false;
  }

  start() {
    this.stopped = false;
    this.tick();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  async tick() {
    if (this.stopped) return;
    try {
      if (!this.creds) this.creds = await findCredentials();
      if (this.creds) await this.poll();
      else this.publish({ connected: false, phase: "None", me: null, platform: null, champSelect: null });
    } catch {
      this.creds = null;
      this.me = null;
      this.publish({ connected: false, phase: "None", me: null, platform: null, champSelect: null });
    }
    this.timer = setTimeout(() => this.tick(), this.creds ? 1500 : 5000);
  }

  async poll() {
    const phase = (await get(this.creds, "/lol-gameflow/v1/gameflow-phase")) || "None";
    if (!this.me) {
      const s = await get(this.creds, "/lol-summoner/v1/current-summoner");
      if (s && s.puuid) this.me = { puuid: s.puuid, name: s.gameName ? `${s.gameName}#${s.tagLine || ""}` : s.displayName || "" };
    }
    if (!this.platform) {
      const r = await get(this.creds, "/riotclient/region-locale").catch(() => null);
      const key = String((r && (r.webRegion || r.region)) || "").toUpperCase();
      this.platform = PLATFORM[key] || null;
    }

    let champSelect = null;
    if (phase === "ChampSelect") {
      const s = await get(this.creds, "/lol-champ-select/v1/session");
      if (s) {
        const my = await this.fillIdentity((s.myTeam || []).map(member));
        champSelect = {
          localCellId: s.localPlayerCellId,
          myTeam: my,
          theirTeam: (s.theirTeam || []).map(member),
          bans: { my: (s.bans && s.bans.myTeamBans) || [], their: (s.bans && s.bans.theirTeamBans) || [] },
        };
      }
    }
    this.publish({ connected: true, phase, me: this.me, platform: this.platform || "eun1", champSelect });
  }

  // U starších verzí klienta chybí puuid, doplníme ho podle summonerId.
  async fillIdentity(list) {
    for (const m of list) {
      if (m.puuid || !m.summonerId) continue;
      if (!this.names.has(m.summonerId)) {
        const s = await get(this.creds, `/lol-summoner/v1/summoners/${m.summonerId}`).catch(() => null);
        this.names.set(m.summonerId, s ? { puuid: s.puuid, name: s.gameName ? `${s.gameName}#${s.tagLine || ""}` : null } : {});
      }
      const n = this.names.get(m.summonerId) || {};
      m.puuid = n.puuid || null;
      m.name = m.name || n.name || null;
    }
    return list;
  }

  publish(state) {
    const json = JSON.stringify(state);
    if (json === this.last) return;
    this.last = json;
    this.state = state;
    this.emit("state", state);
  }
}

module.exports = { LeagueConnector };
