import { cached } from "@/lib/cache";
import type { TwitchLive } from "@/lib/twitch";

/**
 * Kick indikátor "živě" (oficiální API api.kick.com). Potřebuje KICK_CLIENT_ID a KICK_CLIENT_SECRET
 * (aplikace v Kick Developer nastavení). Bez klíčů vrací vždy null. Výsledek se kešuje 2 minuty.
 */
let token: { v: string; exp: number } | null = null;

async function appToken() {
  const id = process.env.KICK_CLIENT_ID, secret = process.env.KICK_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (token && token.exp > Date.now() + 60000) return token.v;
  const r = await fetch("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { access_token: string; expires_in: number };
  token = { v: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return token.v;
}

export const validKick = (s: string) => /^[a-zA-Z0-9_-]{3,30}$/.test(s);

export async function getKickLive(slug: string | null | undefined): Promise<TwitchLive> {
  if (!slug || !validKick(slug)) return null;
  try {
    const r0 = await cached<{ live: TwitchLive }>(`kick:${slug.toLowerCase()}`, 120, async () => {
      const t = await appToken();
      if (!t) return { live: null };
      const r = await fetch(`https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(slug)}`, {
        headers: { authorization: `Bearer ${t}`, accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (r.status === 400 || r.status === 404) return { live: null }; // neexistující kanál
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as {
        data?: { slug: string; stream_title?: string; category?: { name?: string } | string; stream?: { is_live?: boolean; viewer_count?: number } }[];
      };
      const c = j.data?.[0];
      if (!c?.stream?.is_live) return { live: null };
      const cat = typeof c.category === "string" ? c.category : c.category?.name ?? "";
      return { live: { title: c.stream_title ?? "", game: cat, viewers: c.stream.viewer_count ?? 0, url: `https://kick.com/${c.slug}` } };
    });
    return r0.live;
  } catch {
    return null;
  }
}
