import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

import { DEFAULT_THEME, isTheme, type ThemeKey } from "@/lib/themes";

export { THEMES, DEFAULT_THEME, isTheme, type ThemeKey } from "@/lib/themes";

/** Téma pro aktuálního návštěvníka: účet má přednost před cookie. */
export async function getTheme(): Promise<ThemeKey> {
  try {
    const s = await auth();
    if (s?.user?.id) {
      const u = await db.user.findUnique({ where: { id: s.user.id }, select: { theme: true } });
      if (isTheme(u?.theme)) return u.theme;
    }
  } catch {
    /* bez DB použijeme cookie */
  }
  const c = (await cookies()).get("ph_theme")?.value;
  return isTheme(c) ? c : DEFAULT_THEME;
}
