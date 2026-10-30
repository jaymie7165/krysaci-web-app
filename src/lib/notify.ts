import { db } from "@/lib/db";

type N = { kind: string; title: string; body?: string; url?: string; dedupeKey?: string };

/** Vytvoří oznámení pro hráče (web + fronta pro Discord bota). Nikdy neshodí volající akci. */
export async function notify(userId: string | string[], n: N) {
  const ids = [...new Set(Array.isArray(userId) ? userId : [userId])];
  for (const id of ids) {
    try {
      await db.notification.create({
        data: {
          userId: id,
          kind: n.kind,
          title: n.title.slice(0, 120),
          body: n.body?.slice(0, 300) ?? null,
          url: n.url ?? null,
          dedupeKey: n.dedupeKey ? `${n.dedupeKey}:${id}` : null,
        },
      });
    } catch {
      /* duplicita nebo chyba DB: oznámení je doplněk */
    }
  }
}

/** Pošle zprávu do Discord kanálu přes webhook (DISCORD_WEBHOOK_URL). Bez nastavení nedělá nic. */
export async function webhook(title: string, description: string, url?: string) {
  const hook = process.env.DISCORD_WEBHOOK_URL;
  if (!hook) return;
  const base = (process.env.NEXTAUTH_URL || process.env.AUTH_URL || "").replace(/\/$/, "");
  try {
    await fetch(hook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        embeds: [{ title: title.slice(0, 200), description: description.slice(0, 500), url: url && base ? base + url : undefined, color: 0xd9467f }],
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    /* webhook není kritický */
  }
}
