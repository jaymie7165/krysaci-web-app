"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  DEFAULT_PLATFORM,
  PLATFORMS,
  RiotError,
  VERIFY_ICON_IDS,
  findAccount,
  getProfileIcon,
  getProfileIconId,
  parseRiotId,
} from "@/lib/riot";

async function me() {
  const s = await auth();
  if (!s?.user?.id) redirect("/api/auth/signin");
  const b = await db.user.findUnique({ where: { id: s.user.id }, select: { bannedAt: true } }).catch(() => null);
  if (b?.bannedAt) redirect("/banned");
  return s.user;
}

function riotErrorCode(e: unknown) {
  const status = e instanceof RiotError ? e.status : 0;
  return status === 404 ? "error=riot_notfound"
    : status === 503 ? "error=riot_nokey"
    : status === 401 || status === 403 ? "error=riot_key"
    : status === 429 ? "error=riot_busy"
    : "error=riot_failed";
}

/** Propojí Riot ID. Vlastnictví je nepotvrzené, dokud ho hráč neověří změnou ikony. */
export async function linkRiot(fd: FormData) {
  const u = await me();
  const parsed = parseRiotId(String(fd.get("riotId") ?? ""));
  const platformRaw = String(fd.get("platform") ?? DEFAULT_PLATFORM);
  const platform = platformRaw in PLATFORMS ? platformRaw : DEFAULT_PLATFORM;
  const shareValorant = fd.get("shareValorant") === "on";
  if (!parsed) redirect("/account?error=riot_format");

  let result: string;
  try {
    const acc = await findAccount(parsed.gameName, parsed.tagLine, platform);
    const verifiedOwner = await db.linkedAccount.findFirst({
      where: { provider: "riot", externalId: acc.puuid, verified: true, NOT: { userId: u.id } },
    });
    if (verifiedOwner) {
      result = "error=riot_taken";
    } else {
      const mine = await db.linkedAccount.findUnique({ where: { userId_provider: { userId: u.id, provider: "riot" } } });
      const same = mine?.externalId === acc.puuid;
      const avatarUrl = await getProfileIcon(acc.puuid, platform).catch(() => null);
      const data = {
        externalId: acc.puuid,
        displayName: `${acc.gameName}#${acc.tagLine}`,
        gameName: acc.gameName,
        tagLine: acc.tagLine,
        region: platform,
        avatarUrl,
        shareValorant,
        verified: same ? mine!.verified : false,
        verifyIcon: same ? mine!.verifyIcon : null,
      };
      await db.linkedAccount.upsert({
        where: { userId_provider: { userId: u.id, provider: "riot" } },
        update: data,
        create: { userId: u.id, provider: "riot", ...data },
      });
      result = "ok=riot";
    }
  } catch (e) {
    result = riotErrorCode(e);
  }
  revalidatePath("/account");
  redirect(`/account?${result}`);
}

/** Vybere ikonu, kterou si má hráč v LoL nastavit. */
export async function startRiotVerify() {
  const u = await me();
  const acc = await db.linkedAccount.findUnique({ where: { userId_provider: { userId: u.id, provider: "riot" } } });
  if (!acc || acc.verified) redirect("/account");

  let current = -1;
  try {
    current = await getProfileIconId(acc.externalId, acc.region ?? DEFAULT_PLATFORM);
  } catch (e) {
    redirect(`/account?${riotErrorCode(e)}`);
  }
  const choices = VERIFY_ICON_IDS.filter((id) => id !== current);
  const icon = choices[Math.floor(Math.random() * choices.length)];
  await db.linkedAccount.update({ where: { id: acc.id }, data: { verifyIcon: icon } });
  revalidatePath("/account");
  redirect("/account");
}

/** Zkontroluje u Riotu, že má hráč nastavenou požadovanou ikonu. */
export async function checkRiotVerify() {
  const u = await me();
  const acc = await db.linkedAccount.findUnique({ where: { userId_provider: { userId: u.id, provider: "riot" } } });
  if (!acc || acc.verified || acc.verifyIcon == null) redirect("/account");

  let result: string;
  try {
    const current = await getProfileIconId(acc.externalId, acc.region ?? DEFAULT_PLATFORM);
    if (current !== acc.verifyIcon) {
      result = "error=verify_wrong_icon";
    } else {
      const other = await db.linkedAccount.findFirst({
        where: { provider: "riot", externalId: acc.externalId, verified: true, NOT: { userId: u.id } },
      });
      if (other) {
        result = "error=riot_taken";
      } else {
        // Ověřený majitel vytlačí případné neověřené "zabrání" téhož účtu u jiných hráčů.
        await db.linkedAccount.deleteMany({
          where: { provider: "riot", externalId: acc.externalId, verified: false, NOT: { userId: u.id } },
        });
        await db.linkedAccount.update({ where: { id: acc.id }, data: { verified: true, verifyIcon: null } });
        result = "ok=verified";
      }
    }
  } catch (e) {
    result = riotErrorCode(e);
  }
  revalidatePath("/account");
  redirect(`/account?${result}`);
}

export async function unlinkAccount(provider: string) {
  const u = await me();
  if (provider !== "steam" && provider !== "riot") return;
  await db.linkedAccount.deleteMany({ where: { userId: u.id, provider } });
  revalidatePath("/account");
  redirect("/account");
}

/** Sdílení Valorant ranku jde zapnout jen u ověřeného Riot účtu. */
export async function setValorantShare(fd: FormData) {
  const u = await me();
  await db.linkedAccount.updateMany({
    where: { userId: u.id, provider: "riot", verified: true },
    data: { shareValorant: fd.get("shareValorant") === "on" },
  });
  revalidatePath("/account");
  redirect("/account?ok=valorant");
}

/** Hráč si sám určí, jestli web ukazuje, co právě hraje. */
export async function setShowActivity(fd: FormData) {
  const u = await me();
  await db.user.update({ where: { id: u.id }, data: { showActivity: fd.get("showActivity") === "on" } });
  revalidatePath("/account");
  redirect("/account?ok=valorant");
}

/** Trvalé smazání účtu a všech jeho dat (GDPR). Vyžaduje opsání handlu. */
export async function deleteAccount(fd: FormData) {
  const u = await me();
  const confirm = String(fd.get("confirm") ?? "").trim().replace(/^@/, "").toLowerCase();
  const row = await db.user.findUnique({ where: { id: u.id }, select: { handle: true } });
  if (!row || confirm !== row.handle.toLowerCase()) redirect("/account?error=delete_confirm");
  await db.user.delete({ where: { id: u.id } });
  redirect("/api/auth/signout");
}

export async function saveNotifySettings(fd: FormData) {
  const u = await me();
  const raw = String(fd.get("twitch") ?? "").trim().replace(/^https?:\/\/(www\.)?twitch\.tv\//i, "").replace(/\/.*$/, "");
  const twitchLogin = raw && /^[a-zA-Z0-9_]{3,25}$/.test(raw) ? raw : null;
  const rawK = String(fd.get("kick") ?? "").trim().replace(/^https?:\/\/(www\.)?kick\.com\//i, "").replace(/\/.*$/, "");
  const kickLogin = rawK && /^[a-zA-Z0-9_-]{3,30}$/.test(rawK) ? rawK : null;
  await db.user.update({ where: { id: u.id }, data: { notifyDiscord: fd.get("notifyDiscord") === "on", twitchLogin, kickLogin } });
  revalidatePath("/account");
  redirect("/account?ok=notify_saved");
}
