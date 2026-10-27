import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/** Ověří hlavičku x-bot-key proti BOT_API_KEY. Vrací chybovou odpověď, nebo null, když je vše OK. */
export function checkBotKey(req: Request): NextResponse | null {
  const expected = process.env.BOT_API_KEY;
  if (!expected) {
    return NextResponse.json({ error: "BOT_API_KEY není nastaven na serveru" }, { status: 500 });
  }
  const given = req.headers.get("x-bot-key") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Neplatný klíč" }, { status: 401 });
  }
  return null;
}
