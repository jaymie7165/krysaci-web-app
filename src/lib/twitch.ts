import { cached } from "@/lib/cache";

/**
 * Twitch indikátor "živě". Potřebuje TWITCH_CLIENT_ID a TWITCH_CLIENT_SECRET (app token, bez přihlášení hráče).
 * Výsledek se kešuje na 2 minuty. Bez klíčů vrací vždy null.
 */
export type TwitchLive = { title: string; game: string; viewers: number; url: string } | null;

let token: { v: string; exp: number } | null = null;

async function appToken() {
  const id = process.env.TWITCH_CLIENT_ID, secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (token && token.exp > Date.now() + 60000) return token.v;
  const r = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`, { method: "POST", signal: AbortSignal.timeout(5000) });
  if (!r.ok) return null;
  const j = (await r.json()) as { access_token: string; expires_in: number };
  token = { v: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return token.v;
}

export const validTwitch = (s: string) => /^[a-zA-Z0-9_]{3,25}$/.test(s);

export async function getTwitchLive(login: string | null | undefined): Promise<TwitchLive> {
  if (!login || !validTwitch(login)) return null;
  try {
    const r0 = await cached<{ live: TwitchLive }>(`twitch:${login.toLowerCase()}`, 120, async () => {
      const t = await appToken();
      if (!t) return { live: null };
      const r = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, {
        headers: { "client-id": process.env.TWITCH_CLIENT_ID!, authorization: `Bearer ${t}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { data: { title: string; game_name: string; viewer_count: number; user_login: string }[] };
      const s = j.data[0];
      return { live: s ? { title: s.title, game: s.game_name, viewers: s.viewer_count, url: `https://twitch.tv/${s.user_login}` } : null };
    });
    return r0.live;
  } catch {
    return null;
  }
}
