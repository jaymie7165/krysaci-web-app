# KRYSÁCI – web pro hráče a esport komunitu

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
   - `NEXT_PUBLIC_SITE_URL` – veřejná adresa (např. `https://krysaci.up.railway.app`)
5. V Settings → Networking vygeneruj doménu.
6. V Discord Developer Portalu (OAuth2 → Redirects) přidej:
   `https://TVOJE-DOMENA/api/auth/callback/discord`

Při startu se automaticky spustí `prisma db push` a seed her (`npm run start`).

> Pozor: `prisma db push` je pohodlné pro rychlý start. Až budou v databázi ostrá data, přejdi na `prisma migrate` (`npm run db:migrate` lokálně a `prisma migrate deploy` při startu), aby změny schématu nemohly nic smazat.

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

## Struktura

```
prisma/schema.prisma     datový model
src/lib/auth.ts          Discord OAuth (Auth.js)
src/lib/i18n.ts          překlady CS / SK / EN
src/app/actions.ts       server actions (profil, LFG, turnaje, tickety, …)
src/app/api/bot/*        API pro Discord bota
src/app/*/page.tsx       stránky modulů
```
