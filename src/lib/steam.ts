import { db } from "@/lib/db";
import { cached } from "@/lib/cache";

const OPENID = "https://steamcommunity.com/openid/login";

/** Základní adresa webu (kvůli návratové adrese po přihlášení přes Steam). */
export function siteOrigin(req: Request) {
  return (process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
}

/** Adresa, na kterou přesměrujeme uživatele k přihlášení u Steamu (OpenID 2.0). */
export function steamLoginUrl(origin: string) {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${origin}/api/connect/steam/callback`,
    "openid.realm": origin,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `${OPENID}?${params.toString()}`;
}

/** Ověří odpověď Steamu a vrátí steamid64, nebo null, když je podpis neplatný. */
export async function verifySteamCallback(url: URL, origin: string): Promise<string | null> {
  const p = url.searchParams;
  if (p.get("openid.mode") !== "id_res") return null;
  if (p.get("openid.return_to") !== `${origin}/api/connect/steam/callback`) return null;

  const body = new URLSearchParams();
  for (const [k, v] of p.entries()) if (k.startsWith("openid.")) body.set(k, v);
  body.set("openid.mode", "check_authentication");

  const res = await fetch(OPENID, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!/is_valid\s*:\s*true/.test(text)) return null;

  const m = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(p.get("openid.claimed_id") ?? "");
  return m ? m[1] : null;
}

export type SteamSummary = {
  steamId: string;
  name: string;
  avatar: string;
  profileUrl: string;
  isPublic: boolean;
  recent: { appId: number; name: string; hours2w: number; hoursTotal: number; icon?: string; img?: string | null }[];
};

/**
 * Obrázek hry podle Steam Store. Nové hry a demoverze nemají obrázek na starých adresách
 * (/apps/ID/header.jpg), ale obchod vrací správnou adresu. U dema se použije obrázek plné hry.
 * Výsledek se cachuje na týden, neúspěch na 6 hodin.
 */
export async function getSteamAppImage(appId: number): Promise<string | null> {
  const r = await cached<{ img: string | null; at: number }>(`steamapp:${appId}`, 7 * 24 * 3600, async () => {
    const one = async (id: number) => {
      const j = await fetch(`https://store.steampowered.com/api/appdetails?appids=${id}&filters=basic&l=english`, { cache: "no-store" })
        .then((x) => x.json())
        .catch(() => null);
      const d = j?.[String(id)]?.data as { header_image?: string; capsule_image?: string; fullgame?: { appid?: string | number } } | undefined;
      return d ?? null;
    };
    const d = await one(appId);
    let img = d?.header_image ?? d?.capsule_image ?? null;
    if (!img && d?.fullgame?.appid) img = (await one(Number(d.fullgame.appid)))?.header_image ?? null;
    return { img, at: Date.now() };
  }).catch(() => null);
  if (!r) return null;
  // Prázdný výsledek zkusíme znovu po 6 hodinách.
  if (!r.img && Date.now() - r.at > 6 * 3600 * 1000) {
    await db.statCache.delete({ where: { key: `steamapp:${appId}` } }).catch(() => null);
  }
  return r.img;
}

async function loadSummary(steamId: string): Promise<SteamSummary> {
  const key = process.env.STEAM_API_KEY;
  if (!key) throw new Error("STEAM_API_KEY není nastaven");
  const sum = await (
    await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`)
  ).json();
  const p = sum?.response?.players?.[0];
  if (!p) throw new Error("Steam profil nenalezen");

  let recent: SteamSummary["recent"] = [];
  if (p.communityvisibilitystate === 3) {
    const r = await fetch(
      `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${key}&steamid=${steamId}&count=4`
    )
      .then((x) => x.json())
      .catch(() => null);
    recent = (r?.response?.games ?? []).map(
      (g: { appid: number; name: string; img_icon_url?: string; playtime_2weeks?: number; playtime_forever?: number }) => ({
        icon: g.img_icon_url || undefined,
        appId: g.appid,
        name: g.name,
        hours2w: Math.round(((g.playtime_2weeks ?? 0) / 60) * 10) / 10,
        hoursTotal: Math.round((g.playtime_forever ?? 0) / 60),
      })
    );
  }
  await Promise.all(
    recent.map(async (g) => {
      g.img = await getSteamAppImage(g.appId);
    })
  );
  return {
    steamId,
    name: p.personaname,
    avatar: p.avatarfull,
    profileUrl: p.profileurl,
    isPublic: p.communityvisibilitystate === 3,
    recent,
  };
}

/** Steam profil (cache 15 minut). */
export function getSteamSummary(steamId: string) {
  return cached(`steam:v2:${steamId}`, 900, () => loadSummary(steamId));
}

/** Co právě hrají zadaní hráči na Steamu (jeden dotaz pro celou skupinu, cache 1 minuta). */
export async function getSteamNowPlaying(steamIds: string[]): Promise<Record<string, string>> {
  const key = process.env.STEAM_API_KEY;
  if (!key || steamIds.length === 0) return {};
  const ids = [...new Set(steamIds)].slice(0, 100).sort();
  return cached(`steam:now:${ids.join(",")}`, 60, async () => {
    const r = await (
      await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${ids.join(",")}`)
    ).json();
    const out: Record<string, string> = {};
    for (const p of r?.response?.players ?? []) if (p.gameextrainfo) out[p.steamid] = p.gameextrainfo;
    return out;
  });
}
