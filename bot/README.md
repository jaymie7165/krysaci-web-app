# Play Haven bot

Samostatná služba (druhá služba na Railway, kořenový adresář `bot/`, start `npm start`).

**Web → Discord:** nový turnaj, customka, LFG nebo novinka se sám objeví v kanálu s tlačítky Přidat se / Odhlásit.
Hráči dostávají DM (10 minut před začátkem turnaje a customky, tipy, hlad peta, ...).
**Discord → web:** `/lfg`, `/customka`, `/turnaj` (jen admin webu) založí věc na webu, tlačítka přihlašují hráče.

## Proměnné bota

| Proměnná | K čemu |
|---|---|
| `DISCORD_TOKEN` | token bota (Developer Portal → Bot) |
| `WEB_URL` | adresa webu, např. `https://playhaven.up.railway.app` |
| `BOT_API_KEY` | stejný řetězec jako na webu |
| `GUILD_ID` | ID tvého serveru (příkazy se pak objeví hned) |
| `CHANNEL_DEFAULT` | ID kanálu, kam jde vše, co nemá vlastní kanál |
| `CHANNEL_TOURNAMENTS`, `CHANNEL_CUSTOMS`, `CHANNEL_LFG`, `CHANNEL_NEWS` | volitelně vlastní kanály |
| `SYNC_PRESENCE` | `1` = bot posílá, kdo co hraje, a rank snapshoty (vyžaduje intenty Presence a Server Members) |

Pozvánka bota: scope `bot` + `applications.commands`, práva Send Messages a Embed Links.
Hráči musí mít zapnuté DM od členů serveru, jinak jim DM nepřijde (web jim oznámení ukáže i pod zvonečkem).
