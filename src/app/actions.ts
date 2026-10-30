"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LOCALES } from "@/lib/i18n";
import { pragueToDate } from "@/lib/time";
import { allow } from "@/lib/rateLimit";
import { audit } from "@/lib/audit";

async function user() {
  const s = await auth();
  if (!s?.user?.id) redirect("/api/auth/signin");
  // Zablokovaný hráč nemůže nic měnit.
  const row = await db.user.findUnique({ where: { id: s.user.id }, select: { bannedAt: true } }).catch(() => null);
  if (row?.bannedAt) redirect("/banned");
  return s.user;
}

/** Omezení počtu akcí na hráče. Při překročení se vrátí zpět se zprávou. */
function throttle(userId: string, bucket: string, max: number, windowMs: number, path: string) {
  if (!allow(`${bucket}:${userId}`, max, windowMs)) back(path, "ratelimit");
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Vrátí zpět na stránku se zprávou, kterou stránka zobrazí nad obsahem. */
function back(path: string, msg: string): never {
  redirect(`${path}?msg=${msg}`);
}

/** Najde hráče podle @handle nebo jména (bez @, bez rozlišení velikosti písmen). */
async function findPlayer(input: string) {
  const q = input.trim().replace(/^@/, "");
  if (!q) return null;
  return (
    (await db.user.findFirst({ where: { handle: { equals: q, mode: "insensitive" } } })) ??
    (await db.user.findFirst({ where: { username: { equals: q, mode: "insensitive" } } }))
  );
}

/* ---------- Jazyk ---------- */
export async function setLang(lang: string) {
  if (!(LOCALES as readonly string[]).includes(lang)) return;
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

/* ---------- Profil ---------- */
export async function updateProfile(fd: FormData) {
  const u = await user();
  const data = z
    .object({
      bio: z.string().max(400),
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    })
    .safeParse({ bio: str(fd, "bio"), accent: str(fd, "accent") || "#8b5cf6" });
  if (!data.success) return;
  await db.user.update({ where: { id: u.id }, data: { bio: data.data.bio || null, accent: data.data.accent } });
  revalidatePath(`/players/${u.handle}`);
  redirect(`/players/${u.handle}`);
}

export async function saveGameProfile(fd: FormData) {
  const u = await user();
  const gameId = str(fd, "gameId");
  const inGameName = str(fd, "inGameName").slice(0, 40);
  const rank = str(fd, "rank").slice(0, 30) || null;
  if (!gameId || !inGameName) return;
  await db.gameProfile.upsert({
    where: { userId_gameId: { userId: u.id, gameId } },
    update: { inGameName, rank },
    create: { userId: u.id, gameId, inGameName, rank },
  });
  revalidatePath(`/players/${u.handle}`);
}

/** Přidání hráče do hry. Každý přidává sám sebe, admin může přidat kohokoliv podle @handlu. */
export async function joinGame(gameId: string, fd: FormData) {
  const u = await user();
  const game = await db.game.findUnique({ where: { id: gameId } });
  if (!game) return;
  const inGameName = str(fd, "inGameName").slice(0, 40);
  const rank = str(fd, "rank").slice(0, 30) || null;
  if (!inGameName) return;
  let target = u;
  const handle = str(fd, "handle");
  if (handle && u.role === "ADMIN") {
    const p = await findPlayer(handle);
    if (!p) back(`/games/${game.slug}`, "notfound");
    target = p as typeof u;
  }
  await db.gameProfile.upsert({
    where: { userId_gameId: { userId: target.id, gameId } },
    update: { inGameName, rank },
    create: { userId: target.id, gameId, inGameName, rank },
  });
  revalidatePath(`/games/${game.slug}`);
  back(`/games/${game.slug}`, "added");
}

export async function leaveGame(gameId: string) {
  const u = await user();
  const game = await db.game.findUnique({ where: { id: gameId } });
  await db.gameProfile.deleteMany({ where: { userId: u.id, gameId } });
  if (game) revalidatePath(`/games/${game.slug}`);
}

/* ---------- LFG ---------- */
export async function createLfg(fd: FormData) {
  const u = await user();
  throttle(u.id, "lfg", 5, 600000, "/lfg");
  const parsed = z
    .object({
      gameId: z.string().min(1),
      title: z.string().min(3).max(80),
      description: z.string().max(500).optional(),
      slots: z.coerce.number().int().min(1).max(20),
      rankHint: z.string().max(30).optional(),
    })
    .safeParse({
      gameId: str(fd, "gameId"),
      title: str(fd, "title"),
      description: str(fd, "description"),
      slots: str(fd, "slots") || "5",
      rankHint: str(fd, "rankHint"),
    });
  if (!parsed.success) return;
  await db.lfgPost.create({
    data: { ...parsed.data, description: parsed.data.description || null, rankHint: parsed.data.rankHint || null, authorId: u.id },
  });
  revalidatePath("/lfg");
}

export async function joinLfg(postId: string) {
  const u = await user();
  const post = await db.lfgPost.findUnique({ where: { id: postId }, include: { _count: { select: { joins: true } } } });
  if (!post || !post.open || post._count.joins + 1 >= post.slots) return; // autor zabírá jedno místo
  await db.lfgJoin.upsert({
    where: { postId_userId: { postId, userId: u.id } },
    update: {},
    create: { postId, userId: u.id },
  });
  revalidatePath("/lfg");
}

export async function closeLfg(postId: string) {
  const u = await user();
  const post = await db.lfgPost.findUnique({ where: { id: postId } });
  if (!post || (post.authorId !== u.id && u.role === "USER")) return;
  await db.lfgPost.update({ where: { id: postId }, data: { open: false } });
  revalidatePath("/lfg");
}

/** Autor LFG přidá do party hráče podle @handlu. */
export async function addToLfg(postId: string, fd: FormData) {
  const u = await user();
  const post = await db.lfgPost.findUnique({ where: { id: postId }, include: { _count: { select: { joins: true } } } });
  if (!post || (post.authorId !== u.id && u.role !== "ADMIN") || !post.open) return;
  const p = await findPlayer(str(fd, "handle"));
  if (!p) back("/lfg", "notfound");
  if (p.id === post.authorId) return;
  if (post._count.joins + 1 >= post.slots) back("/lfg", "full");
  await db.lfgJoin.upsert({
    where: { postId_userId: { postId, userId: p.id } },
    update: {},
    create: { postId, userId: p.id },
  });
  revalidatePath("/lfg");
  back("/lfg", "added");
}

/** Hráč se může z LFG odhlásit. */
export async function leaveLfg(postId: string) {
  const u = await user();
  await db.lfgJoin.deleteMany({ where: { postId, userId: u.id } });
  revalidatePath("/lfg");
}

/* ---------- Turnaje ---------- */
export async function createTournament(fd: FormData) {
  const u = await user();
  if (u.role !== "ADMIN") return; // turnaje zakládá jen admin
  const parsed = z
    .object({
      gameId: z.string().min(1),
      name: z.string().min(3).max(80),
      description: z.string().min(3).max(1000),
      startsAt: z.string().transform(pragueToDate).refine((d) => !isNaN(d.getTime())),
      maxPlayers: z.coerce.number().int().min(2).max(256),
      teamSize: z.coerce.number().int().min(1).max(10),
      prize: z.string().max(100).optional(),
    })
    .safeParse({
      gameId: str(fd, "gameId"),
      name: str(fd, "name"),
      description: str(fd, "description"),
      startsAt: str(fd, "startsAt"),
      maxPlayers: str(fd, "maxPlayers") || "16",
      teamSize: str(fd, "teamSize") || "1",
      prize: str(fd, "prize"),
    });
  if (!parsed.success) return;
  await db.tournament.create({ data: { ...parsed.data, prize: parsed.data.prize || null, organizerId: u.id } });
  revalidatePath("/tournaments");
}

export async function joinTournament(id: string) {
  const u = await user();
  const t = await db.tournament.findUnique({ where: { id }, include: { _count: { select: { entries: true } } } });
  if (!t || t.status !== "UPCOMING" || t._count.entries >= t.maxPlayers) return;
  await db.tournamentEntry.upsert({
    where: { tournamentId_userId: { tournamentId: id, userId: u.id } },
    update: {},
    create: { tournamentId: id, userId: u.id },
  });
  revalidatePath("/tournaments");
}

/** Přihlásí celý tým najednou. Kapitán zadá název a @handly spoluhráčů. */
export async function createTeam(tournamentId: string, fd: FormData) {
  const u = await user();
  throttle(u.id, "team", 5, 600000, "/tournaments");
  const t = await db.tournament.findUnique({ where: { id: tournamentId }, include: { entries: true } });
  if (!t || t.status !== "UPCOMING") back("/tournaments", "closed");
  if (t.teamSize < 2) back("/tournaments", "solo");
  const name = str(fd, "teamName").slice(0, 40);
  if (name.length < 2) back("/tournaments", "teamname");
  if (await db.tournamentTeam.findFirst({ where: { tournamentId, name: { equals: name, mode: "insensitive" } } })) back("/tournaments", "teamtaken");

  const mine = t.entries.find((e) => e.userId === u.id);
  if (mine?.teamId) back("/tournaments", "inteam");

  const handles = str(fd, "members").split(/[\s,;]+/).filter(Boolean).slice(0, t.teamSize - 1);
  const members: NonNullable<Awaited<ReturnType<typeof findPlayer>>>[] = [];
  for (const h of handles) {
    const p = await findPlayer(h);
    if (!p) back("/tournaments", "notfound");
    if (p.id === u.id || members.some((m) => m.id === p.id)) continue;
    if (t.entries.find((e) => e.userId === p.id)?.teamId) back("/tournaments", "memberbusy");
    members.push(p);
  }

  const already = new Set(t.entries.map((e) => e.userId));
  const added = [u.id, ...members.map((m) => m.id)].filter((x) => !already.has(x)).length;
  if (t.entries.length + added > t.maxPlayers) back("/tournaments", "full");

  const team = await db.tournamentTeam.create({ data: { tournamentId, name, captainId: u.id } });
  for (const uid of [u.id, ...members.map((m) => m.id)]) {
    await db.tournamentEntry.upsert({
      where: { tournamentId_userId: { tournamentId, userId: uid } },
      update: { teamId: team.id },
      create: { tournamentId, userId: uid, teamId: team.id },
    });
  }
  revalidatePath("/tournaments");
  back("/tournaments", "teamok");
}

/** Hráč se přidá do existujícího týmu, pokud je v něm volné místo. */
export async function joinTeam(teamId: string) {
  const u = await user();
  const team = await db.tournamentTeam.findUnique({
    where: { id: teamId },
    include: { tournament: { include: { entries: true } }, entries: true },
  });
  if (!team || team.tournament.status !== "UPCOMING") back("/tournaments", "closed");
  if (team.entries.length >= team.tournament.teamSize) back("/tournaments", "teamfull");
  const mine = team.tournament.entries.find((e) => e.userId === u.id);
  if (mine?.teamId) back("/tournaments", "inteam");
  if (!mine && team.tournament.entries.length >= team.tournament.maxPlayers) back("/tournaments", "full");
  await db.tournamentEntry.upsert({
    where: { tournamentId_userId: { tournamentId: team.tournamentId, userId: u.id } },
    update: { teamId },
    create: { tournamentId: team.tournamentId, userId: u.id, teamId },
  });
  revalidatePath("/tournaments");
}

/** Kapitán (nebo admin) přidá do týmu dalšího hráče podle @handlu. */
export async function addTeamMember(teamId: string, fd: FormData) {
  const u = await user();
  const team = await db.tournamentTeam.findUnique({
    where: { id: teamId },
    include: { tournament: { include: { entries: true } }, entries: true },
  });
  if (!team || (team.captainId !== u.id && u.role !== "ADMIN")) return;
  if (team.tournament.status !== "UPCOMING") back("/tournaments", "closed");
  if (team.entries.length >= team.tournament.teamSize) back("/tournaments", "teamfull");
  const p = await findPlayer(str(fd, "handle"));
  if (!p) back("/tournaments", "notfound");
  const e = team.tournament.entries.find((x) => x.userId === p.id);
  if (e?.teamId) back("/tournaments", "memberbusy");
  if (!e && team.tournament.entries.length >= team.tournament.maxPlayers) back("/tournaments", "full");
  await db.tournamentEntry.upsert({
    where: { tournamentId_userId: { tournamentId: team.tournamentId, userId: p.id } },
    update: { teamId },
    create: { tournamentId: team.tournamentId, userId: p.id, teamId },
  });
  revalidatePath("/tournaments");
}

export async function leaveTournament(id: string) {
  const u = await user();
  const entry = await db.tournamentEntry.findUnique({
    where: { tournamentId_userId: { tournamentId: id, userId: u.id } },
    include: { team: { include: { entries: true } } },
  });
  if (!entry) return;
  await db.tournamentEntry.delete({ where: { id: entry.id } });
  const team = entry.team;
  if (team) {
    const rest = team.entries.filter((e) => e.userId !== u.id);
    if (rest.length === 0) await db.tournamentTeam.delete({ where: { id: team.id } });
    else if (team.captainId === u.id) await db.tournamentTeam.update({ where: { id: team.id }, data: { captainId: rest[0].userId } });
  }
  revalidatePath("/tournaments");
}

/** Zrušení turnaje (admin). Zůstane vidět jako zrušený, aby se přihlášení dozvěděli, co se stalo. */
export async function cancelTournament(id: string) {
  const u = await user();
  if (u.role !== "ADMIN") return;
  await db.tournament.update({ where: { id }, data: { status: "CANCELLED" } }).catch(() => null);
  revalidatePath("/tournaments");
}

/* ---------- Customky ---------- */
export async function createCustom(fd: FormData) {
  const u = await user();
  throttle(u.id, "custom", 5, 600000, "/customs");
  const parsed = z
    .object({
      gameId: z.string().min(1),
      title: z.string().min(3).max(80),
      description: z.string().max(500).optional(),
      startsAt: z.string().transform(pragueToDate).refine((d) => !isNaN(d.getTime())),
      maxPlayers: z.coerce.number().int().min(2).max(100),
    })
    .safeParse({
      gameId: str(fd, "gameId"),
      title: str(fd, "title"),
      description: str(fd, "description"),
      startsAt: str(fd, "startsAt"),
      maxPlayers: str(fd, "maxPlayers") || "10",
    });
  if (!parsed.success) return;
  const custom = await db.custom.create({
    data: { ...parsed.data, description: parsed.data.description || null, hostId: u.id },
  });
  await db.customEntry.create({ data: { customId: custom.id, userId: u.id } });
  revalidatePath("/customs");
}

export async function joinCustom(id: string) {
  const u = await user();
  const c = await db.custom.findUnique({ where: { id }, include: { _count: { select: { entries: true } } } });
  if (!c || c.status !== "UPCOMING" || c._count.entries >= c.maxPlayers) return;
  await db.customEntry.upsert({
    where: { customId_userId: { customId: id, userId: u.id } },
    update: {},
    create: { customId: id, userId: u.id },
  });
  revalidatePath("/customs");
}

export async function leaveCustom(id: string) {
  const u = await user();
  await db.customEntry.deleteMany({ where: { customId: id, userId: u.id } });
  revalidatePath("/customs");
}

/** Zrušit customku může ten, kdo ji založil, nebo admin. */
export async function cancelCustom(id: string) {
  const u = await user();
  const c = await db.custom.findUnique({ where: { id } });
  if (!c || (c.hostId !== u.id && u.role !== "ADMIN")) return;
  await db.custom.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/customs");
}

/** Zakladatel přidá do customky hráče podle @handlu (např. kamaráda, který zrovna není na webu). */
export async function addToCustom(id: string, fd: FormData) {
  const u = await user();
  const c = await db.custom.findUnique({ where: { id }, include: { _count: { select: { entries: true } } } });
  if (!c || (c.hostId !== u.id && u.role !== "ADMIN") || c.status !== "UPCOMING") return;
  const p = await findPlayer(str(fd, "handle"));
  if (!p) back("/customs", "notfound");
  if (c._count.entries >= c.maxPlayers) back("/customs", "full");
  await db.customEntry.upsert({
    where: { customId_userId: { customId: id, userId: p.id } },
    update: {},
    create: { customId: id, userId: p.id },
  });
  revalidatePath("/customs");
  back("/customs", "added");
}

/* ---------- Přátelé ---------- */
export async function sendFriendRequest(targetId: string) {
  const u = await user();
  if (targetId === u.id) return;
  const existing = await db.friendship.findFirst({
    where: {
      OR: [
        { requesterId: u.id, addresseeId: targetId },
        { requesterId: targetId, addresseeId: u.id },
      ],
    },
  });
  if (existing) return;
  await db.friendship.create({ data: { requesterId: u.id, addresseeId: targetId } });
  revalidatePath("/friends");
  revalidatePath("/players/[handle]", "page");
}

/** Přidání přítele podle jména nebo @handlu z formuláře na stránce Přátelé. */
export async function sendFriendRequestByHandle(fd: FormData) {
  const u = await user();
  throttle(u.id, "friend", 20, 600000, "/friends");
  const p = await findPlayer(str(fd, "handle"));
  if (!p) back("/friends", "notfound");
  if (p.id === u.id) back("/friends", "self");
  const existing = await db.friendship.findFirst({
    where: { OR: [{ requesterId: u.id, addresseeId: p.id }, { requesterId: p.id, addresseeId: u.id }] },
  });
  if (existing) {
    // Pokud mi dotyčný žádost už poslal, rovnou ji potvrdíme.
    if (existing.status === "PENDING" && existing.addresseeId === u.id) {
      await db.friendship.update({ where: { id: existing.id }, data: { status: "ACCEPTED" } });
      revalidatePath("/friends");
      back("/friends", "accepted");
    }
    back("/friends", existing.status === "ACCEPTED" ? "already" : "pending");
  }
  await db.friendship.create({ data: { requesterId: u.id, addresseeId: p.id } });
  revalidatePath("/friends");
  back("/friends", "sent");
}

export async function acceptFriend(id: string) {
  const u = await user();
  await db.friendship.updateMany({ where: { id, addresseeId: u.id }, data: { status: "ACCEPTED" } });
  revalidatePath("/friends");
}

export async function removeFriend(id: string) {
  const u = await user();
  await db.friendship.deleteMany({
    where: { id, OR: [{ requesterId: u.id }, { addresseeId: u.id }] },
  });
  revalidatePath("/friends");
}

/* ---------- Tickety ---------- */
export async function createTicket(fd: FormData) {
  const u = await user();
  throttle(u.id, "ticket", 5, 3600000, "/tickets");
  const parsed = z
    .object({
      subject: z.string().min(3).max(100),
      category: z.string().min(2).max(30),
      body: z.string().min(3).max(2000),
    })
    .safeParse({ subject: str(fd, "subject"), category: str(fd, "category"), body: str(fd, "body") });
  if (!parsed.success) return;
  const { body, ...rest } = parsed.data;
  const ticket = await db.ticket.create({
    data: { ...rest, authorId: u.id, messages: { create: { authorId: u.id, body } } },
  });
  redirect(`/tickets/${ticket.id}`);
}

export async function replyTicket(ticketId: string, fd: FormData) {
  const u = await user();
  const body = str(fd, "body").slice(0, 2000);
  if (!body) return;
  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  const staff = u.role !== "USER";
  if (!ticket || (ticket.authorId !== u.id && !staff) || ticket.status === "CLOSED") return;
  await db.ticketMessage.create({ data: { ticketId, authorId: u.id, body, fromStaff: staff && ticket.authorId !== u.id } });
  await db.ticket.update({
    where: { id: ticketId },
    data: { status: staff && ticket.authorId !== u.id ? "ANSWERED" : "OPEN" },
  });
  revalidatePath(`/tickets/${ticketId}`);
}

export async function closeTicket(ticketId: string) {
  const u = await user();
  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || (ticket.authorId !== u.id && u.role === "USER")) return;
  await db.ticket.update({ where: { id: ticketId }, data: { status: "CLOSED" } });
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

/* ---------- Hlasování o hrách ---------- */
export async function suggestGame(fd: FormData) {
  const u = await user();
  if (u.role !== "ADMIN") return; // hlasování zakládá jen admin, hráči v něm hlasují
  const parsed = z
    .object({
      name: z.string().min(2).max(60),
      reason: z.string().max(300).optional(),
      storeUrl: z.string().url().max(300).optional().or(z.literal("")),
    })
    .safeParse({ name: str(fd, "name"), reason: str(fd, "reason"), storeUrl: str(fd, "storeUrl") });
  if (!parsed.success) return;
  const s = await db.gameSuggestion.create({
    data: {
      name: parsed.data.name,
      reason: parsed.data.reason || null,
      storeUrl: parsed.data.storeUrl || null,
      proposerId: u.id,
    },
  });
  await db.gameVote.create({ data: { suggestionId: s.id, userId: u.id } });
  revalidatePath("/vote");
}

export async function toggleVote(suggestionId: string) {
  const u = await user();
  const existing = await db.gameVote.findUnique({
    where: { suggestionId_userId: { suggestionId, userId: u.id } },
  });
  if (existing) await db.gameVote.delete({ where: { id: existing.id } });
  else await db.gameVote.create({ data: { suggestionId, userId: u.id } });
  revalidatePath("/vote");
}

/* ---------- Správa (jen admin) ---------- */
export async function deleteTournament(id: string) {
  const u = await user();
  if (u.role !== "ADMIN") return;
  const t = await db.tournament.findUnique({ where: { id }, select: { name: true } });
  await db.tournament.delete({ where: { id } }).catch(() => null);
  await audit(u, "tournament.delete", id, t?.name);
  revalidatePath("/tournaments");
}

export async function deleteSuggestion(id: string) {
  const u = await user();
  if (u.role !== "ADMIN") return;
  await db.gameSuggestion.delete({ where: { id } }).catch(() => null);
  await audit(u, "suggestion.delete", id);
  revalidatePath("/vote");
}

export async function dismissOnboarding() {
  const u = await user();
  await db.user.update({ where: { id: u.id }, data: { onboardingDismissed: true } });
  revalidatePath("/");
}
