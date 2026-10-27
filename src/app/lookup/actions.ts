"use server";

import { redirect } from "next/navigation";
import { DEFAULT_PLATFORM, PLATFORMS, parseRiotId } from "@/lib/riot";

export async function searchLol(fd: FormData) {
  const parsed = parseRiotId(String(fd.get("riotId") ?? ""));
  const platformRaw = String(fd.get("platform") ?? DEFAULT_PLATFORM);
  const platform = platformRaw in PLATFORMS ? platformRaw : DEFAULT_PLATFORM;
  if (!parsed) redirect("/lookup?error=format");
  redirect(`/lol/${platform}/${encodeURIComponent(parsed.gameName)}-${encodeURIComponent(parsed.tagLine)}`);
}
