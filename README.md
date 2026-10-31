# Play Haven – web pro hráče a esport komunitu

Next.js 15 (App Router) + PostgreSQL (Prisma) + přihlášení přes Discord. Jazyky: čeština, slovenština, angličtina.

## Co web umí (MVP)

- Přihlášení přes Discord, hráčský profil / vizitka (bio, barva, herní nicky a ranky)
- Hry, statistiky a žebříčky
- Turnaje a customky (registrace, kapacita, termíny)
- LFG (hledání spoluhráčů), Friend list
- Ticket systém (hráč ↔ staff)
- Hlasování o nových hrách
- API pro Discord bota (`/api/bot/stats`, `/api/bot/events`)

## Lokální spuštění

```bash
npm install
cp .env.example .env      # doplň hodnoty
npx prisma db push        # vytvoří tabulky
npm run db:seed           # základní hry
npm run dev               # http://localhost:3000
```

## Nasazení: GitHub → Railway

1. Nahraj projekt na GitHub (`git init && git add . && git commit -m "init" && git push`).
2. Na Railway: **New Project → Deploy from GitHub repo** a vyber repozitář.
3. Přidej službu **PostgreSQL** (New → Database → PostgreSQL) a ve službě webu nastav `DATABASE_URL` jako referenci na `${{Postgres.DATABASE_URL}}`.
4. Nastav proměnné prostředí (viz `.env.example`):
   - `AUTH_SECRET` – `openssl rand -base64 32`
   - `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET` – z https://discord.com/developers/applications
   - `BOT_API_KEY` – libovolný dlouhý náhodný řetězec (sdílíš ho s botem)
   - `ADMIN_DISCORD_IDS` – tvoje Discord ID (admin po přihlášení)
   - `NEXT_PUBLIC_SITE_URL` – veřejná adresa (např. `https://playhaven.up.railway.app`)
5. V Settings → Networking vygeneruj doménu.
6. V Discord Developer Portalu (OAuth2 → Redirects) přidej:
   `https://TVOJE-DOMENA/api/auth/callback/discord`

Při startu se automaticky spustí `prisma db push` a seed her (`npm run start`).

> Pozor: `prisma db push` je pohodlné pro rychlý start. Až budou v databázi ostrá data, přejdi na `prisma migrate` (`npm run db:migrate` lokálně a `prisma migrate deploy` při startu), aby změny schématu nemohly nic smazat.

## Statistiky a propojení účtů

| Funkce | Co potřebuje | Poznámka |
| --- | --- | --- |
| Steam (nick, avatar, naposledy hrané hry) | `STEAM_API_KEY` (zdarma) | Hráč se přihlásí přes Steam, takže je vlastnictví ověřené automaticky. |
| LoL statistiky (rank, zápasy, nejhranější šampioni) | `RIOT_API_KEY` | Vyhledání kohokoliv přes Riot ID. Vlastní hry (customky) se nezobrazují. |
| Ověření Riot účtu | `RIOT_API_KEY` | Hráč si na pár minut nastaví v LoL přidělenou ikonu. |
| Valorant rank | `HENRIK_API_KEY` | Jen u ověřených hráčů, kteří sdílení sami zapnuli. Používá neoficiální službu HenrikDev. |

**Riot API klíče.** Osobní klíč je určený pro osobní projekty a vyprší po 24 hodinách. Web, který ukazuje statistiky
cizích hráčů, má být u Riotu zaregistrovaný jako produkt (Production key). Na webu musí být viditelné upozornění,
že Riot Games projekt neschvaluje (je v patičce). Zkontroluj aktuální podmínky na https://developer.riotgames.com.

**Steam.** V Discord redirectu nic nepřidáváš. Návratová adresa Steamu je `https://TVOJE-DOMENA/api/connect/steam/callback`
a řídí se proměnnou `AUTH_URL` (nebo `NEXT_PUBLIC_SITE_URL`).

## Propojení s Discord botem (discord.js)

Všechny požadavky mají hlavičku `x-bot-key: <BOT_API_KEY>`.

**Odeslat statistiky na web**

```js
await fetch(`${process.env.SITE_URL}/api/bot/stats`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-bot-key": process.env.BOT_API_KEY },
  body: JSON.stringify({
    stats: [{ discordId: "123456789", username: "Jmeno", game: "valorant", points: 1200, wins: 10, losses: 4 }],
  }),
});
```

Hráč, který na webu ještě není, dostane „stínový“ profil, který se po přihlášení přes Discord automaticky propojí.

**Načíst nadcházející akce** (pro oznámení v kanálu): `GET /api/bot/events`

**Jednorázový import dat bota**: `DATABASE_URL=... npm run import:bot cesta/k/data.json`
(formát je v hlavičce `scripts/import-bot-json.mjs`, upravíme podle skutečného JSONu bota).

## Živá komunita a vývoj ranku (bot)

Hub ukazuje, kdo je právě v jaké hře. Zdroje: Steam (aktuální hra), živá hra v LoL (jen ověřené Riot účty) a Discord aktivita z tvého bota. Hráč si to na stránce Propojené účty může vypnout (soukromí).

**Discord aktivita** – bot zhruba každých 60 s pošle, co kdo hraje (v Discord Developer Portalu zapni intent *Presence*):

```js
setInterval(async () => {
  const guild = client.guilds.cache.first();
  const players = guild.members.cache
    .filter((m) => !m.user.bot)
    .map((m) => ({
      discordId: m.id,
      game: m.presence?.activities.find((a) => a.type === 0)?.name ?? null,
    }));
  await fetch(`${process.env.WEB_URL}/api/bot/presence`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-bot-key": process.env.BOT_API_KEY },
    body: JSON.stringify({ players }),
  }).catch(() => {});
}, 60_000);
```

**Graf ranku** – bot jednou za 6 až 12 hodin zavolá `POST /api/bot/snapshots` (stejná hlavička `x-bot-key`, bez těla). Web uloží aktuální rank ověřených hráčů a z toho kreslí graf LP. Bez toho se body ukládají jen při otevření profilu.

Poznámka: databáze webu přibyly sloupce a tabulky (`showActivity`, `verifyIcon`, `RankSnapshot`, `StatCache`). Přidá je `prisma db push` při startu, vždy do databáze webu, ne do databáze bota.

## Aplikace pro počítač (Play Haven Desktop)

Složka `desktop/` obsahuje Windows aplikaci (Electron). Otevře web v okně na stránce `/live`, čte lokální API League klienta
a podle fáze hry (champ select, načítání, hra) ukazuje scouting spoluhráčů, nepřátel a doporučení. Nic nehraje za hráče.

Stažení: tlačítko na Hubu vede na `/api/download`, které přesměruje na soubor `PlayHaven.exe` v posledním GitHub Release
(proměnná `DESKTOP_GITHUB_REPO`) nebo na `DESKTOP_DOWNLOAD_URL`. Repozitář musí být veřejný, jinak se soubor nedá stáhnout bez přihlášení.

Nová verze: na GitHubu vytvoř Release s tagem `desktop-v1.0.1`, workflow `.github/workflows/desktop.yml` exe sestaví a přiloží.
Nebo exe sestav ručně (`cd desktop && npm install && npm run dist:portable`) a nahraj ho do Release jako `PlayHaven.exe`.
Obsah aplikace (rozhraní, scouting) se mění nasazením webu, appku není potřeba přestavovat.

## Struktura

```
prisma/schema.prisma     datový model
src/lib/auth.ts          Discord OAuth (Auth.js)
src/lib/i18n.ts          překlady CS / SK / EN
src/app/actions.ts       server actions (profil, LFG, turnaje, tickety, …)
src/app/api/bot/*        API pro Discord bota
src/app/*/page.tsx       stránky modulů
```

## Discord: oznámení a přidání ze serveru

Web ukládá oznámení (žádosti o přátelství, start turnaje, nahlášené výsledky, přidání do tvé customky/LFG, tipy v Pickems).
Hráč je vidí pod zvonečkem a bot je může poslat do Discord DM. Všechny endpointy chtějí hlavičku `x-bot-key`.

- `GET /api/bot/outbox` – vrátí `{ items: [{ id, discordId, kind, title, body, url }] }`. Volej např. jednou za minutu.
  Zároveň vygeneruje připomínky tipů, které začínají do 20 minut.
- `POST /api/bot/outbox` `{ "ids": ["..."] }` – po odeslání DM potvrď.
- `POST /api/bot/join` `{ "discordId": "...", "type": "custom|lfg|tournament", "id": "..." }` – přidá hráče z Discordu
  (např. tlačítko u zprávy z webhooku). Vrací `{ ok: true }` nebo `{ ok: false, reason }`.

Bez bota funguje `DISCORD_WEBHOOK_URL`: nové turnaje, customky, LFG a novinky se samy pošlou do kanálu.
Hráč si DM vypne na stránce Účet.

## Pet

Každý přihlášený hráč si vybere peta (`/pet`). Za odehrané hry z **ověřeného** Riot účtu dostává pamlsky, XP a mince
(hra s přítelem nebo spoluhráčem z LFG/customky/turnaje dává dvojnásobek XP a mincí, 5× denně). Hry se ověřují přes Riot
Match-v5 (`RIOT_API_KEY`), nejvýš jednou za 5 minut při otevření stránky `/pet`. Nekrmený pet postupně vypadá hůř
(po 16 h o stupeň, po 48 h spí), XP se neztrácí. Aplikace pro počítač má animovaný loading a v liště „Pet na ploše“
(malé okno `/pet/widget`). Pravidla a čísla jsou v `src/lib/pet.ts`.

Pet je z hotových obrázků (`public/pets/*.webp`, 5 druhů × 5 stupňů, doplňky v `public/pets/items`). Obrázky se připravují
skriptem `scripts/process-pets.py` ze zdrojových PNG. Doplňky se skládají jako vrstvy podle kotev v `ANCHORS` / `ITEM_FIT`
(`src/lib/pet.ts`); když doplněk někde špatně sedí, stačí upravit čísla tam.
