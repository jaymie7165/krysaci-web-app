import { NextResponse } from "next/server";

/**
 * Stažení aplikace pro počítač. Adresa souboru se nastavuje v proměnné DESKTOP_DOWNLOAD_URL,
 * výchozí je poslední Release na GitHubu (DESKTOP_GITHUB_REPO, např. "uzivatel/repozitar").
 */
export function GET(req: Request) {
  const direct = process.env.DESKTOP_DOWNLOAD_URL;
  const repo = process.env.DESKTOP_GITHUB_REPO;
  const url = direct || (repo ? `https://github.com/${repo}/releases/latest/download/PlayHaven.exe` : null);
  if (!url) return NextResponse.redirect(new URL("/live?nodownload=1", req.url));
  return NextResponse.redirect(url);
}
