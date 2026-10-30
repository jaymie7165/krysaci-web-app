"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** Uloží (nebo změní) tip. Formulář posílá hodnotu "A", "B" nebo "A:2:1" (vítěz:skóreA:skóreB). */
export async function savePick(matchId: string, fd: FormData) {
  const s = await auth();
  if (!s?.user?.id) redirect("/api/auth/signin");
  const b = await db.user.findUnique({ where: { id: s.user.id }, select: { bannedAt: true } });
  if (b?.bannedAt) redirect("/banned");
  const m = await db.esportsMatch.findUnique({ where: { id: matchId } });
  if (!m || m.status !== "upcoming" || m.startsAt.getTime() <= Date.now()) redirect("/pickems?msg=locked");

  const v = /^(A|B)(?::(\d):(\d))?$/.exec(String(fd.get("pick") ?? ""));
  if (!v) return;
  const winner = v[1];
  const scoreA = v[2] != null ? Number(v[2]) : null;
  const scoreB = v[3] != null ? Number(v[3]) : null;
  if (scoreA != null && scoreB != null) {
    if (scoreA === scoreB || scoreA > m.bestOf || scoreB > m.bestOf) return;
    if ((scoreA > scoreB ? "A" : "B") !== winner) return;
  }
  await db.pick.upsert({
    where: { userId_matchId: { userId: s.user.id, matchId } },
    update: { winner, scoreA, scoreB },
    create: { userId: s.user.id, matchId, winner, scoreA, scoreB },
  });
  revalidatePath("/pickems");
}

export async function removePick(matchId: string) {
  const s = await auth();
  if (!s?.user?.id) redirect("/api/auth/signin");
  const m = await db.esportsMatch.findUnique({ where: { id: matchId } });
  if (!m || m.status !== "upcoming" || m.startsAt.getTime() <= Date.now()) redirect("/pickems?msg=locked");
  await db.pick.deleteMany({ where: { userId: s.user.id, matchId } });
  revalidatePath("/pickems");
}
