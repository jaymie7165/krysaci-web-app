// Idempotentní seed: bezpečně se spouští při každém startu. Hry se doplní/aktualizují podle slugu.
// Obrázky jsou oficiální: Steam CDN (header hry) a Riot (Data Dragon / valorant-api).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const steam = (appId) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;

const games = [
  {
    slug: "league-of-legends",
    name: "League of Legends",
    category: "MOBA",
    imageUrl: "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg",
    description: "Týmová 5v5 MOBA od Riot Games. Ranked, flex, ARAM i vlastní hry.",
    sortOrder: 1,
  },
  {
    slug: "valorant",
    name: "VALORANT",
    category: "Taktická FPS",
    imageUrl: "https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/fullportrait.png",
    description: "Taktická 5v5 střílečka od Riot Games s unikátními agenty.",
    sortOrder: 2,
  },
  {
    slug: "phasmophobia",
    name: "Phasmophobia",
    category: "Co-op horor",
    imageUrl: steam(739630),
    description: "Kooperativní hon na duchy až pro 4 hráče. Perfektní na večerní session.",
    sortOrder: 3,
  },
  {
    slug: "feign",
    name: "Feign",
    category: "Sociální dedukce",
    imageUrl: steam(1436990),
    description: "Hra o důvěře a podvodu. Kdo z vás je mezi vámi nepřítel?",
    sortOrder: 4,
  },
  {
    slug: "golf-with-your-friends",
    name: "Golf With Your Friends",
    category: "Párty / Sport",
    imageUrl: steam(431240),
    description: "Bláznivý minigolf pro partu kamarádů. Skvělé na customky a turnajíčky.",
    sortOrder: 5,
  },
  {
    slug: "tavernia",
    name: "Tavernia",
    category: "Simulace / Co-op",
    imageUrl: steam(3970530),
    description: "Hospodská simulace, kterou můžete hrát s kamarády.",
    sortOrder: 6,
  },
];

for (const g of games) {
  await prisma.game.upsert({ where: { slug: g.slug }, update: g, create: g });
}

console.log(`Seed hotov: ${games.length} her.`);
await prisma.$disconnect();
