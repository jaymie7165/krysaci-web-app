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
  recent: { appId: number; name: string; hours2w: number; hoursTotal: number }[];
};

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
      (g: { appid: number; name: string; playtime_2weeks?: number; playtime_forever?: number }) => ({
        appId: g.appid,
        name: g.name,
        hours2w: Math.round(((g.playtime_2weeks ?? 0) / 60) * 10) / 10,
        hoursTotal: Math.round((g.playtime_forever ?? 0) / 60),
      })
    );
  }
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
  return cached(`steam:${steamId}`, 900, () => loadSummary(steamId));
}
