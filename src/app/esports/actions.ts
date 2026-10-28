"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pragueToDate } from "@/lib/time";
import { syncEsports } from "@/lib/esports";

async function admin() {
  const s = await auth();
  if (!s?.user || s.user.role !== "ADMIN") redirect("/esports");
  return s.user;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v === "" ? null : Number(v);
};

export async function createEsportsMatch(fd: FormData) {
  await admin();
  const p = z
    .object({
      game: z.enum(["lol", "valorant"]),
      league: z.string().min(2).max(40),
      stage: z.string().max(60).optional(),
      startsAt: z.string().transform(pragueToDate).refine((d) => !isNaN(d.getTime())),
      bestOf: z.coerce.number().int().min(1).max(7),
      teamA: z.string().min(1).max(40),
      teamB: z.string().min(1).max(40),
      streamUrl: z.string().url().max(300).optional().or(z.literal("")),
    })
    .safeParse({
      game: str(fd, "game"), league: str(fd, "league"), stage: str(fd, "stage"), startsAt: str(fd, "startsAt"),
      bestOf: str(fd, "bestOf") || "1", teamA: str(fd, "teamA"), teamB: str(fd, "teamB"), streamUrl: str(fd, "streamUrl"),
    });
  if (!p.success) redirect("/esports?error=invalid");
  await db.esportsMatch.create({
    data: { ...p.data, stage: p.data.stage || null, streamUrl: p.data.streamUrl || null, source: "manual" },
  });
  revalidatePath("/esports");
  redirect("/esports");
}

/** Výsledek a stav zápasu. */
export async function updateEsportsMatch(id: string, fd: FormData) {
  await admin();
  const status = str(fd, "status");
  if (!["upcoming", "live", "finished"].includes(status)) return;
  await db.esportsMatch.update({
    where: { id },
    data: { status, scoreA: num(fd, "scoreA"), scoreB: num(fd, "scoreB") },
  });
  revalidatePath("/esports");
}

export async function deleteEsportsMatch(id: string) {
  await admin();
  await db.esportsMatch.delete({ where: { id } }).catch(() => null);
  revalidatePath("/esports");
}

export async function runEsportsSync() {
  await admin();
  const r = await syncEsports();
  revalidatePath("/esports");
  redirect(`/esports?synced=${r.saved}${r.errors.length ? "&syncerr=1" : ""}`);
}
