import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSteamSummary, siteOrigin, verifySteamCallback } from "@/lib/steam";

/** Návrat ze Steamu: ověří podpis, uloží Steam ID a načte nick a avatar. */
export async function GET(req: Request) {
  const origin = siteOrigin(req);
  const back = (q: string) => NextResponse.redirect(new URL(`/account?${q}`, origin));

  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/api/auth/signin", origin));

  const steamId = await verifySteamCallback(new URL(req.url), origin).catch(() => null);
  if (!steamId) return back("error=steam_failed");

  const owner = await db.linkedAccount.findFirst({ where: { provider: "steam", externalId: steamId } });
  if (owner && owner.userId !== session.user.id) return back("error=steam_taken");

  const profile = await getSteamSummary(steamId).catch(() => null);
  const data = {
    externalId: steamId,
    displayName: profile?.name ?? `Steam ${steamId}`,
    avatarUrl: profile?.avatar ?? null,
    profileUrl: profile?.profileUrl ?? `https://steamcommunity.com/profiles/${steamId}`,
    verified: true, // Steam ověřil, že účet patří přihlášenému uživateli
  };
  const mine = await db.linkedAccount.findFirst({ where: { userId: session.user.id, provider: "steam" } });
  if (mine) await db.linkedAccount.update({ where: { id: mine.id }, data });
  else await db.linkedAccount.create({ data: { userId: session.user.id, provider: "steam", ...data } });
  return back("ok=steam");
}
