import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { siteOrigin, steamLoginUrl } from "@/lib/steam";

/** Začátek propojení Steamu: přesměruje přihlášeného hráče na přihlášení u Steamu. */
export async function GET(req: Request) {
  const origin = siteOrigin(req);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/api/auth/signin", origin));
  return NextResponse.redirect(steamLoginUrl(origin));
}
