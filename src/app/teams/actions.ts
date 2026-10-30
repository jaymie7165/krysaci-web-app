"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { allow } from "@/lib/rateLimit";

async function me() {
  const s = await auth();
  if (!s?.user?.id) redirect("/api/auth/signin");
  const b = await db.user.findUnique({ where: { id: s.user.id }, select: { bannedAt: true } });
  if (b?.bannedAt) redirect("/banned");
  return s.user;
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
function back(msg: string): never {
  revalidatePath("/teams");
  redirect(`/teams?msg=${msg}`);
}

export async function createPersistentTeam(fd: FormData) {
  const u = await me();
  if (!allow(`pteam:${u.id}`, 3, 3600000)) back("ratelimit");
  const name = str(fd, "name").slice(0, 40);
  const tag = str(fd, "tag").slice(0, 5).toUpperCase() || null;
  const logoUrl = str(fd, "logoUrl");
  if (name.length < 2) back("teamname");
  if (logoUrl && !/^https:\/\/\S+$/.test(logoUrl)) back("badurl");
  if (await db.team.findFirst({ where: { name: { equals: name, mode: "insensitive" } } })) back("teamtaken");
  const t = await db.team.create({ data: { name, tag, logoUrl: logoUrl || null, captainId: u.id } });
  await db.teamMember.create({ data: { teamId: t.id, userId: u.id } });
  back("teamcreated");
}

export async function addPersistentMember(teamId: string, fd: FormData) {
  const u = await me();
  const t = await db.team.findUnique({ where: { id: teamId }, include: { members: true } });
  if (!t || (t.captainId !== u.id && u.role !== "ADMIN")) back("notyours");
  const q = str(fd, "handle").replace(/^@/, "");
  const p = await db.user.findFirst({ where: { OR: [{ handle: { equals: q, mode: "insensitive" } }, { username: { equals: q, mode: "insensitive" } }] } });
  if (!p) back("notfound");
  if (t.members.length >= 12) back("teamfull");
  await db.teamMember.upsert({ where: { teamId_userId: { teamId, userId: p.id } }, update: {}, create: { teamId, userId: p.id } });
  back("added");
}

export async function leavePersistentTeam(teamId: string) {
  const u = await me();
  const t = await db.team.findUnique({ where: { id: teamId }, include: { members: true } });
  if (!t) back("notyours");
  await db.teamMember.deleteMany({ where: { teamId, userId: u.id } });
  const rest = t.members.filter((m) => m.userId !== u.id);
  if (rest.length === 0) await db.team.delete({ where: { id: teamId } });
  else if (t.captainId === u.id) await db.team.update({ where: { id: teamId }, data: { captainId: rest[0].userId } });
  back("left");
}

export async function disbandPersistentTeam(teamId: string) {
  const u = await me();
  const t = await db.team.findUnique({ where: { id: teamId } });
  if (!t || (t.captainId !== u.id && u.role !== "ADMIN")) back("notyours");
  await db.team.delete({ where: { id: teamId } });
  back("left");
}

/** Přihlásí celý trvalý tým do týmového turnaje. */
export async function registerPersistentTeam(teamId: string, fd: FormData) {
  const u = await me();
  const tournamentId = str(fd, "tournamentId");
  const team = await db.team.findUnique({ where: { id: teamId }, include: { members: true } });
  if (!team || team.captainId !== u.id) back("notyours");
  const t = await db.tournament.findUnique({ where: { id: tournamentId }, include: { entries: true, teams: true } });
  if (!t || t.status !== "UPCOMING") back("closed");
  if (t.teamSize < 2) back("solo");
  if (team.members.length > t.teamSize) back("toomany");
  if (t.teams.some((x) => x.teamId === team.id || x.name.toLowerCase() === team.name.toLowerCase())) back("teamtaken");
  const busy = t.entries.some((e) => e.teamId && team.members.some((m) => m.userId === e.userId));
  if (busy) back("memberbusy");
  const fresh = team.members.filter((m) => !t.entries.some((e) => e.userId === m.userId));
  if (t.entries.length + fresh.length > t.maxPlayers) back("full");
  const tt = await db.tournamentTeam.create({ data: { tournamentId, name: team.name, captainId: team.captainId, teamId: team.id } });
  for (const m of team.members) {
    await db.tournamentEntry.upsert({
      where: { tournamentId_userId: { tournamentId, userId: m.userId } },
      update: { teamId: tt.id },
      create: { tournamentId, userId: m.userId, teamId: tt.id },
    });
  }
  revalidatePath("/tournaments");
  back("teamok");
}
