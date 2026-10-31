import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkBotKey } from "@/lib/botAuth";

export const dynamic = "force-dynamic";

/** GET /api/bot/games – seznam her pro našeptávání ve slash příkazech. */
export async function GET(req: Request) {
  const denied = checkBotKey(req);
  if (denied) return denied;
  const games = await db.game.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { slug: true, name: true } });
  return NextResponse.json({ games });
}
