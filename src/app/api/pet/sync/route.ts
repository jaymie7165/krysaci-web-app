import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncPetGames } from "@/lib/petSync";

export const dynamic = "force-dynamic";

/**
 * POST /api/pet/sync  – aplikace to zavolá po konci hry v League klientu (s přihlášením hráče).
 * Odpověď: { gained, treats, xp, coins } (gained = počet nově započítaných her).
 */
export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Jen z aplikace nebo ze stejného webu (ochrana proti cizím stránkám).
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const r = await syncPetGames(s.user.id, { force: true }).catch(() => ({ gained: 0, error: "x" }));
  return NextResponse.json(r);
}
