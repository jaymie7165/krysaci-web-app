/**
 * Play Haven Discord bot: propojení Discordu s webem (obousměrně).
 *
 *  Web -> Discord:  nové turnaje, customky, LFG a novinky se samy objeví v kanálech (s tlačítkem „Přidat se“).
 *                   Oznámení hráčům (10 min před začátkem, hlad peta, tipy...) chodí do DM.
 *  Discord -> web:  /lfg, /customka, /turnaj (admin) založí věc rovnou na webu; tlačítka přihlašují hráče na web.
 *
 * Konfigurace přes proměnné prostředí, viz bot/README.md.
 */
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder, GatewayIntentBits, MessageFlags, SlashCommandBuilder,
} from "discord.js";

const env = process.env;
const need = ["DISCORD_TOKEN", "WEB_URL", "BOT_API_KEY"];
for (const k of need) if (!env[k]) { console.error(`Chybí proměnná ${k}`); process.exit(1); }
const WEB = env.WEB_URL.replace(/\/$/, "");
const PRESENCE = env.SYNC_PRESENCE === "1";
const COLOR = 0xd9467f;

const intents = [GatewayIntentBits.Guilds];
if (PRESENCE) intents.push(GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMembers);
const client = new Client({ intents });

/* ---------- komunikace s webem ---------- */
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${WEB}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-bot-key": env.BOT_API_KEY },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  return res.json();
}

/* ---------- Web -> Discord: kanály ---------- */
const channelFor = (type) =>
  env[{ tournament: "CHANNEL_TOURNAMENTS", custom: "CHANNEL_CUSTOMS", lfg: "CHANNEL_LFG", news: "CHANNEL_NEWS" }[type]] || env.CHANNEL_DEFAULT;

const TYPE_LABEL = { tournament: "Turnaj", custom: "Customka", lfg: "Hledám spoluhráče", news: "Novinka" };
const ts = (d) => `<t:${Math.floor(new Date(d).getTime() / 1000)}:F> (<t:${Math.floor(new Date(d).getTime() / 1000)}:R>)`;

function feedMessage(it) {
  const e = new EmbedBuilder().setColor(COLOR).setTitle(`${TYPE_LABEL[it.type]}: ${it.title}`.slice(0, 250)).setURL(it.url || WEB);
  if (it.description) e.setDescription(String(it.description).slice(0, 600));
  const f = [];
  if (it.game) f.push({ name: "Hra", value: it.game, inline: true });
  if (it.by) f.push({ name: "Zakládá", value: it.by, inline: true });
  if (it.startsAt) f.push({ name: "Začátek", value: ts(it.startsAt) });
  if (it.slots) f.push({ name: "Místa", value: `${it.taken ?? 0}/${it.slots}`, inline: true });
  if (it.prize) f.push({ name: "Cena", value: it.prize, inline: true });
  if (it.rankHint) f.push({ name: "Rank", value: it.rankHint, inline: true });
  if (f.length) e.addFields(f);
  const row = new ActionRowBuilder();
  if (it.type !== "news") {
    row.addComponents(
      new ButtonBuilder().setCustomId(`join:${it.type}:${it.id}`).setLabel("Přidat se").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`leave:${it.type}:${it.id}`).setLabel("Odhlásit").setStyle(ButtonStyle.Secondary),
    );
  }
  row.addComponents(new ButtonBuilder().setLabel("Otevřít na webu").setStyle(ButtonStyle.Link).setURL(it.url || WEB));
  return { embeds: [e], components: [row] };
}

async function pollFeed() {
  const { items } = await api("/api/bot/feed");
  const done = [];
  for (const it of items) {
    const chId = channelFor(it.type);
    if (!chId) { console.warn(`Není nastavený kanál pro ${it.type}`); continue; }
    try {
      const ch = await client.channels.fetch(chId);
      await ch.send(feedMessage(it));
      done.push({ type: it.type, id: it.id });
    } catch (e) {
      console.error("Oznámení se nepovedlo:", e.message);
    }
  }
  if (done.length) await api("/api/bot/feed", { method: "POST", body: { items: done } });
}

/* ---------- Web -> Discord: DM ---------- */
async function pollOutbox() {
  const { items } = await api("/api/bot/outbox");
  const sent = [];
  for (const n of items) {
    try {
      const user = await client.users.fetch(n.discordId);
      const e = new EmbedBuilder().setColor(COLOR).setTitle(n.title.slice(0, 250));
      if (n.body) e.setDescription(n.body);
      if (n.url) e.setURL(n.url);
      await user.send({ embeds: [e] });
    } catch {
      /* má zavřené DM nebo není na serveru: nezkoušíme donekonečna */
    }
    sent.push(n.id);
  }
  if (sent.length) await api("/api/bot/outbox", { method: "POST", body: { ids: sent } });
}

/* ---------- Discord -> web: slash příkazy ---------- */
const commands = [
  new SlashCommandBuilder().setName("lfg").setDescription("Hledám spoluhráče (objeví se na webu i tady)")
    .addStringOption((o) => o.setName("hra").setDescription("Hra").setAutocomplete(true).setRequired(true))
    .addStringOption((o) => o.setName("nazev").setDescription("Co hledáš").setRequired(true).setMinLength(3).setMaxLength(80))
    .addIntegerOption((o) => o.setName("mist").setDescription("Počet míst (výchozí 5)").setMinValue(1).setMaxValue(20))
    .addStringOption((o) => o.setName("rank").setDescription("Rank, např. Gold+").setMaxLength(30))
    .addStringOption((o) => o.setName("popis").setDescription("Popis").setMaxLength(500)),
  new SlashCommandBuilder().setName("customka").setDescription("Založit customku")
    .addStringOption((o) => o.setName("hra").setDescription("Hra").setAutocomplete(true).setRequired(true))
    .addStringOption((o) => o.setName("nazev").setDescription("Název").setRequired(true).setMinLength(3).setMaxLength(80))
    .addStringOption((o) => o.setName("kdy").setDescription("Kdy: 31.10. 20:00, dnes 20:00 nebo zítra 20:00").setRequired(true))
    .addIntegerOption((o) => o.setName("mist").setDescription("Počet hráčů (výchozí 10)").setMinValue(2).setMaxValue(100))
    .addStringOption((o) => o.setName("popis").setDescription("Popis").setMaxLength(500)),
  new SlashCommandBuilder().setName("turnaj").setDescription("Založit turnaj (jen admin webu)")
    .addStringOption((o) => o.setName("hra").setDescription("Hra").setAutocomplete(true).setRequired(true))
    .addStringOption((o) => o.setName("nazev").setDescription("Název").setRequired(true).setMinLength(3).setMaxLength(80))
    .addStringOption((o) => o.setName("kdy").setDescription("Kdy: 31.10. 20:00, dnes 20:00 nebo zítra 20:00").setRequired(true))
    .addIntegerOption((o) => o.setName("mist").setDescription("Max. hráčů (výchozí 16)").setMinValue(2).setMaxValue(256))
    .addIntegerOption((o) => o.setName("tym").setDescription("Velikost týmu (1 = solo)").setMinValue(1).setMaxValue(10))
    .addStringOption((o) => o.setName("cena").setDescription("Cena").setMaxLength(100))
    .addStringOption((o) => o.setName("popis").setDescription("Popis").setMaxLength(1000)),
  new SlashCommandBuilder().setName("web").setDescription("Odkaz na web Play Haven"),
].map((c) => c.toJSON());

/** "31.10. 20:00", "31.10.2026 20:00", "dnes 20:00", "zítra 20:00", "20:00" -> "YYYY-MM-DDTHH:mm" (pražský čas). */
function parseWhen(input) {
  const s = input.trim().toLowerCase().replace(/\s+/g, " ");
  const prague = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(d); // YYYY-MM-DD
  const nowDay = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  let m;
  if ((m = /^(dnes|zítra|zitra)?\s*(\d{1,2})[:.](\d{2})$/.exec(s))) {
    const add = m[1] === "zítra" || m[1] === "zitra" ? 1 : 0;
    const day = prague(new Date(nowDay.getTime() + add * 86400000));
    let r = `${day}T${pad(m[2])}:${m[3]}`;
    if (!m[1]) {
      // bez slova "dnes/zítra": když už čas dnes uplynul, jde o zítřek
      const nowHm = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(nowDay);
      if (`${pad(m[2])}:${m[3]}` <= nowHm) r = `${prague(new Date(nowDay.getTime() + 86400000))}T${pad(m[2])}:${m[3]}`;
    }
    return r;
  }
  if ((m = /^(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4}))?\s+(\d{1,2})[:.](\d{2})$/.exec(s))) {
    let y = Number(m[3] || prague(nowDay).slice(0, 4));
    let r = `${y}-${pad(m[2])}-${pad(m[1])}T${pad(m[4])}:${m[5]}`;
    if (!m[3] && r.slice(0, 10) < prague(nowDay)) r = `${y + 1}-${pad(m[2])}-${pad(m[1])}T${pad(m[4])}:${m[5]}`;
    return r;
  }
  return null;
}

const REASONS = {
  nouser: "Nemáš účet na webu. Přihlas se přes Discord na " + WEB + " a zkus to znovu.",
  nogame: "Takovou hru web nezná. Vyber ji z našeptávače.",
  forbidden: "Tohle smí jen admin webu.",
  badtime: "Špatný čas. Piš třeba `31.10. 20:00`, `dnes 20:00` nebo `zítra 20:00` (musí být v budoucnu).",
  ratelimit: "Zkoušíš to moc rychle. Chvíli počkej.",
  invalid: "Něco ve vyplněných údajích nesedí.",
  notfound: "Tohle už na webu neexistuje.",
  closed: "Přihlašování je uzavřené.",
  full: "Je plno.",
};

let gamesCache = { at: 0, games: [] };
async function games() {
  if (Date.now() - gamesCache.at > 5 * 60 * 1000) {
    gamesCache = { at: Date.now(), games: (await api("/api/bot/games")).games };
  }
  return gamesCache.games;
}

async function handleCommand(i) {
  if (i.commandName === "web") return i.reply({ content: WEB, flags: MessageFlags.Ephemeral });
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const o = i.options;
  const type = { lfg: "lfg", customka: "custom", turnaj: "tournament" }[i.commandName];
  const body = { discordId: i.user.id, type, game: o.getString("hra"), title: o.getString("nazev"), description: o.getString("popis") ?? undefined };
  if (type === "lfg") {
    body.slots = o.getInteger("mist") ?? 5;
    body.rankHint = o.getString("rank") ?? undefined;
  } else {
    const when = parseWhen(o.getString("kdy"));
    if (!when) return i.editReply(REASONS.badtime);
    body.startsAt = when;
    body.slots = o.getInteger("mist") ?? (type === "custom" ? 10 : 16);
    if (type === "tournament") { body.teamSize = o.getInteger("tym") ?? 1; body.prize = o.getString("cena") ?? undefined; }
  }
  const r = await api("/api/bot/create", { method: "POST", body });
  if (!r.ok) return i.editReply(REASONS[r.reason] ?? "Nepovedlo se.");
  // do kanálu to zveřejní smyčka pollFeed (do ~30 s)
  return i.editReply(`Hotovo, je to na webu: ${r.url}\nObjeví se i v kanálu na Discordu.`);
}

async function handleButton(i) {
  const [action, type, id] = i.customId.split(":");
  if (!["join", "leave"].includes(action)) return;
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const r = await api(`/api/bot/${action}`, { method: "POST", body: { discordId: i.user.id, type, id } });
  if (!r.ok) return i.editReply(REASONS[r.reason] ?? "Nepovedlo se.");
  return i.editReply(action === "join" ? "Jsi přihlášený/á. Hostitel to uvidí i na webu." : "Odhlášeno.");
}

client.on("interactionCreate", async (i) => {
  try {
    if (i.isAutocomplete()) {
      const q = i.options.getFocused().toLowerCase();
      const list = (await games()).filter((g) => g.name.toLowerCase().includes(q)).slice(0, 25);
      return i.respond(list.map((g) => ({ name: g.name, value: g.slug })));
    }
    if (i.isChatInputCommand()) return await handleCommand(i);
    if (i.isButton()) return await handleButton(i);
  } catch (e) {
    console.error("Interakce selhala:", e);
    const msg = "Web teď neodpovídá, zkus to za chvíli.";
    if (i.isRepliable()) (i.deferred || i.replied ? i.editReply(msg) : i.reply({ content: msg, flags: MessageFlags.Ephemeral })).catch(() => {});
  }
});

/* ---------- volitelné: aktivita a graf ranku ---------- */
async function pushPresence() {
  const guild = client.guilds.cache.get(env.GUILD_ID) ?? client.guilds.cache.first();
  if (!guild) return;
  const players = guild.members.cache.filter((m) => !m.user.bot).map((m) => ({
    discordId: m.id,
    game: m.presence?.activities.find((a) => a.type === 0)?.name?.slice(0, 80) ?? null,
  }));
  await api("/api/bot/presence", { method: "POST", body: { players: [...players.values()] } });
}

/* ---------- start ---------- */
const loop = (fn, ms, name) => {
  const run = () => fn().catch((e) => console.error(`${name}:`, e.message)).finally(() => setTimeout(run, ms));
  setTimeout(run, 3000);
};

client.once("clientReady", async () => {
  console.log(`Přihlášen jako ${client.user.tag}`);
  const guild = env.GUILD_ID && client.guilds.cache.get(env.GUILD_ID);
  await (guild ? guild.commands.set(commands) : client.application.commands.set(commands)).catch((e) => console.error("Příkazy:", e.message));
  loop(pollFeed, 30_000, "feed");
  loop(pollOutbox, 60_000, "dm");
  if (PRESENCE) {
    if (env.GUILD_ID) await client.guilds.cache.get(env.GUILD_ID)?.members.fetch().catch(() => {});
    loop(pushPresence, 60_000, "presence");
    loop(() => api("/api/bot/snapshots", { method: "POST" }), 8 * 3600_000, "snapshots");
  }
});

client.login(env.DISCORD_TOKEN);
