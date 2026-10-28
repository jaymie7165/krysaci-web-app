"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LOCALES } from "@/lib/i18n";
import { pragueToDate } from "@/lib/time";

async function user() {
  const s = await auth();
  if (!s?.user?.id) redirect("/api/auth/signin");
  return s.user;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

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

/* ---------- LFG ---------- */
export async function createLfg(fd: FormData) {
  const u = await user();
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
      prize: z.string().max(100).optional(),
    })
    .safeParse({
      gameId: str(fd, "gameId"),
      name: str(fd, "name"),
      description: str(fd, "description"),
      startsAt: str(fd, "startsAt"),
      maxPlayers: str(fd, "maxPlayers") || "16",
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

export async function leaveTournament(id: string) {
  const u = await user();
  await db.tournamentEntry.deleteMany({ where: { tournamentId: id, userId: u.id } });
  revalidatePath("/tournaments");
}

/* ---------- Customky ---------- */
export async function createCustom(fd: FormData) {
  const u = await user();
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
  await db.tournament.delete({ where: { id } }).catch(() => null);
  revalidatePath("/tournaments");
}

export async function deleteSuggestion(id: string) {
  const u = await user();
  if (u.role !== "ADMIN") return;
  await db.gameSuggestion.delete({ where: { id } }).catch(() => null);
  revalidatePath("/vote");
}
