// Jednorázový import dat z JSON souboru bota do databáze webu.
// Použití:  DATABASE_URL=... node scripts/import-bot-json.mjs cesta/k/souboru.json
//
// Očekávaný formát (upravíme podle skutečného JSONu tvého bota):
// {
//   "players": [
//     { "discordId": "123456789", "username": "Jmeno",
//       "stats": { "valorant": { "points": 1200, "wins": 10, "losses": 4 } } }
//   ]
// }
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const file = process.argv[2];
if (!file) {
  console.error("Zadej cestu k JSON souboru: node scripts/import-bot-json.mjs data.json");
  process.exit(1);
}

const prisma = new PrismaClient();
const data = JSON.parse(readFileSync(file, "utf8"));
const games = new Map((await prisma.game.findMany()).map((g) => [g.slug, g.id]));

const handleFrom = (name, id) =>
  `${(name || "hrac").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9_]+/g, "").slice(0, 16) || "hrac"}${String(id).slice(-4)}`;

let users = 0;
let stats = 0;
for (const p of data.players ?? []) {
  if (!p.discordId) continue;
  const user = await prisma.user.upsert({
    where: { discordId: String(p.discordId) },
    update: { username: p.username ?? undefined },
    create: {
      discordId: String(p.discordId),
      username: p.username ?? "Hráč",
      handle: handleFrom(p.username, p.discordId),
    },
  });
  users++;
  for (const [slug, s] of Object.entries(p.stats ?? {})) {
    const gameId = games.get(slug);
    if (!gameId) {
      console.warn(`Přeskakuji neznámou hru: ${slug}`);
      continue;
    }
    const wins = s.wins ?? 0;
    const losses = s.losses ?? 0;
    await prisma.playerStat.upsert({
      where: { userId_gameId: { userId: user.id, gameId } },
      update: { points: s.points ?? 0, wins, losses, matches: wins + losses },
      create: { userId: user.id, gameId, points: s.points ?? 0, wins, losses, matches: wins + losses },
    });
    stats++;
  }
}

console.log(`Hotovo: ${users} hráčů, ${stats} záznamů statistik.`);
await prisma.$disconnect();
