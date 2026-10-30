"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { buildMatches, roundsFor, usersOf, type Part } from "@/lib/bracket";

async function me() {
  const s = await auth();
  if (!s?.user?.id) redirect("/api/auth/signin");
  const b = await db.user.findUnique({ where: { id: s.user.id }, select: { bannedAt: true } });
  if (b?.bannedAt) redirect("/banned");
  return s.user;
}

const done = (id: string, msg?: string): never => {
  revalidatePath(`/tournaments/${id}`);
  revalidatePath("/tournaments");
  redirect(`/tournaments/${id}${msg ? `?msg=${msg}` : ""}`);
};

async function load(id: string) {
  return db.tournament.findUnique({
    where: { id },
    include: { entries: true, teams: { include: { entries: true } }, matches: true },
  });
}
/** Admin nebo pořadatel spustí turnaj: zamkne přihlášky a vylosuje pavouk. */
export async function startTournament(id: string) {
  const u = await me();
  const t = await load(id);
  if (!t || (u.role !== "ADMIN" && t.organizerId !== u.id)) redirect("/tournaments");
  if (t.status !== "UPCOMING" || t.matches.length > 0) return done(id);
  const parts: Part[] =
    t.teamSize > 1
      ? t.teams.filter((x) => x.entries.length > 0).map((x) => ({ ref: `t:${x.id}`, name: x.name }))
      : await Promise.all(
          t.entries.map(async (e) => {
            const usr = await db.user.findUnique({ where: { id: e.userId }, select: { username: true } });
            return { ref: `e:${e.id}`, name: usr?.username ?? "?" };
          })
        );
  if (parts.length < 2) return done(id, "fewteams");
  const matches = buildMatches(parts);
  await db.$transaction(async (tx) => {
    await tx.tournament.update({ where: { id }, data: { status: "LIVE" } });
    await tx.tournamentMatch.createMany({ data: matches.map((m) => ({ ...m, tournamentId: id })) });
  });
  await audit({ id: u.id, name: u.name }, "tournament.start", id, t.name);
  // volné losy rovnou postoupí
  const fresh = await db.tournamentMatch.findMany({ where: { tournamentId: id, round: 1 } });
  for (const m of fresh) {
    if ((m.refA && !m.refB) || (!m.refA && m.refB)) await settle(id, m.id, m.refA ? "A" : "B", null, null, true);
  }
  done(id, "started");
}

/** Hráč z jednoho z týmů nahlásí výsledek. Potvrdí ho až admin/pořadatel. */
export async function reportResult(matchId: string, fd: FormData) {
  const u = await me();
  const m = await db.tournamentMatch.findUnique({ where: { id: matchId } });
  if (!m) redirect("/tournaments");
  const t = await load(m.tournamentId);
  if (!t) redirect("/tournaments");
  const mine = [...usersOf(t, m.refA), ...usersOf(t, m.refB)].includes(u.id);
  const canManage = u.role === "ADMIN" || t.organizerId === u.id;
  if (!mine && !canManage) return done(t.id, "notyours");
  if (m.status === "confirmed" || !m.refA || !m.refB) return done(t.id);
  const a = Number(fd.get("scoreA")), b = Number(fd.get("scoreB"));
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a === b || a > 99 || b > 99) return done(t.id, "badscore");
  if (canManage) {
    await settle(t.id, m.id, a > b ? "A" : "B", a, b, false);
    await audit({ id: u.id, name: u.name }, "match.confirm", m.id, `${a}:${b}`);
  } else {
    await db.tournamentMatch.update({ where: { id: m.id }, data: { scoreA: a, scoreB: b, winner: a > b ? "A" : "B", status: "reported", reportedById: u.id } });
  }
  done(t.id, canManage ? undefined : "reported");
}

/** Pořadatel potvrdí nahlášený výsledek, nebo ho vrátí. */
export async function reviewResult(matchId: string, fd: FormData) {
  const u = await me();
  const m = await db.tournamentMatch.findUnique({ where: { id: matchId } });
  if (!m) redirect("/tournaments");
  const t = await load(m.tournamentId);
  if (!t || (u.role !== "ADMIN" && t.organizerId !== u.id)) redirect("/tournaments");
  if (m.status !== "reported" || !m.winner) return done(t.id);
  if (String(fd.get("decision")) === "reject") {
    await db.tournamentMatch.update({ where: { id: m.id }, data: { scoreA: null, scoreB: null, winner: null, status: "pending", reportedById: null } });
  } else {
    await settle(t.id, m.id, m.winner as "A" | "B", m.scoreA, m.scoreB, false);
    await audit({ id: u.id, name: u.name }, "match.confirm", m.id, `${m.scoreA}:${m.scoreB}`);
  }
  done(t.id);
}

/** Zapíše potvrzený výsledek, postrčí vítěze dál a po finále udělí body a odznaky. */
async function settle(tid: string, matchId: string, winner: "A" | "B", sa: number | null, sb: number | null, bye: boolean) {
  const t = await load(tid);
  if (!t) return;
  const m = t.matches.find((x) => x.id === matchId);
  if (!m || m.status === "confirmed") return;
  const { rounds } = roundsFor(t.matches.filter((x) => x.round === 1).length * 2);
  const winRef = winner === "A" ? m.refA : m.refB;
  const winName = winner === "A" ? m.nameA : m.nameB;
  const loseRef = winner === "A" ? m.refB : m.refA;
  await db.tournamentMatch.update({ where: { id: m.id }, data: { winner, scoreA: sa, scoreB: sb, status: "confirmed" } });

  // body za výhru/prohru (ne za volný los)
  if (!bye) {
    await bump(t.gameId, usersOf(t, winRef), { points: 10, wins: 1, matches: 1 });
    await bump(t.gameId, usersOf(t, loseRef), { points: 0, losses: 1, matches: 1 });
  }

  if (m.round < rounds) {
    const next = await db.tournamentMatch.findUnique({ where: { tournamentId_round_position: { tournamentId: tid, round: m.round + 1, position: Math.floor(m.position / 2) } } });
    if (next) {
      await db.tournamentMatch.update({
        where: { id: next.id },
        data: m.position % 2 === 0 ? { refA: winRef, nameA: winName } : { refB: winRef, nameB: winName },
      });
    }
    return;
  }

  // finále
  if (t.settledAt) return;
  const loseName = winner === "A" ? m.nameB : m.nameA;
  await db.tournament.update({ where: { id: tid }, data: { status: "FINISHED", championName: winName, settledAt: new Date() } });
  const all = new Set<string>();
  for (const x of t.matches) for (const r of [x.refA, x.refB]) usersOf(t, r).forEach((id) => all.add(id));
  const champs = usersOf(t, winRef), finalists = usersOf(t, loseRef);
  await bump(t.gameId, [...all], { points: 5 });
  await bump(t.gameId, champs, { points: 50 });
  await bump(t.gameId, finalists, { points: 25 });
  const badge = (userId: string, key: string, label: string) =>
    db.badge.upsert({ where: { userId_key_tournamentId: { userId, key, tournamentId: tid } }, create: { userId, key, tournamentId: tid, label }, update: {} });
  await Promise.all([
    ...champs.map((id) => badge(id, "champion", t.name)),
    ...finalists.map((id) => badge(id, "finalist", t.name)),
    ...[...all].filter((id) => !champs.includes(id) && !finalists.includes(id)).map((id) => badge(id, "player", t.name)),
  ]);
  void loseName;
}

async function bump(gameId: string, userIds: string[], d: { points?: number; wins?: number; losses?: number; matches?: number }) {
  for (const userId of userIds) {
    await db.playerStat.upsert({
      where: { userId_gameId: { userId, gameId } },
      create: { userId, gameId, points: d.points ?? 0, wins: d.wins ?? 0, losses: d.losses ?? 0, matches: d.matches ?? 0 },
      update: {
        points: { increment: d.points ?? 0 },
        wins: { increment: d.wins ?? 0 },
        losses: { increment: d.losses ?? 0 },
        matches: { increment: d.matches ?? 0 },
      },
    });
  }
}
