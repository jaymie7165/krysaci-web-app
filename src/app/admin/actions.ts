"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

async function admin() {
  const s = await auth();
  if (!s?.user?.id || s.user.role !== "ADMIN") redirect("/");
  return { id: s.user.id, name: s.user.name ?? s.user.id };
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function banUser(fd: FormData) {
  const a = await admin();
  const id = str(fd, "id");
  const reason = str(fd, "reason").slice(0, 200);
  const u = await db.user.findUnique({ where: { id }, select: { role: true, handle: true } });
  if (!u || u.role === "ADMIN" || id === a.id) return;
  await db.user.update({ where: { id }, data: { bannedAt: new Date(), banReason: reason || null } });
  await audit(a, "user.ban", u.handle, reason);
  revalidatePath("/admin");
}

export async function unbanUser(fd: FormData) {
  const a = await admin();
  const id = str(fd, "id");
  const u = await db.user.update({ where: { id }, data: { bannedAt: null, banReason: null } }).catch(() => null);
  if (u) await audit(a, "user.unban", u.handle);
  revalidatePath("/admin");
}

export async function setRole(fd: FormData) {
  const a = await admin();
  const id = str(fd, "id");
  const role = str(fd, "role") === "ADMIN" ? "ADMIN" : "USER";
  if (id === a.id) return;
  const u = await db.user.update({ where: { id }, data: { role } }).catch(() => null);
  if (u) await audit(a, "user.role", u.handle, role);
  revalidatePath("/admin");
}

export async function createNews(fd: FormData) {
  const a = await admin();
  const title = str(fd, "title").slice(0, 120);
  const body = str(fd, "body").slice(0, 3000);
  if (title.length < 3 || body.length < 3) return;
  const n = await db.news.create({ data: { title, body, authorId: a.id, pinned: fd.get("pinned") === "on" } });
  await audit(a, "news.create", n.id, title);
  revalidatePath("/admin");
  revalidatePath("/news");
  revalidatePath("/");
}

export async function deleteNews(fd: FormData) {
  const a = await admin();
  const id = str(fd, "id");
  const n = await db.news.delete({ where: { id } }).catch(() => null);
  if (n) await audit(a, "news.delete", id, n.title);
  revalidatePath("/admin");
  revalidatePath("/news");
  revalidatePath("/");
}

export async function togglePinNews(fd: FormData) {
  const a = await admin();
  const id = str(fd, "id");
  const n = await db.news.findUnique({ where: { id } });
  if (!n) return;
  await db.news.update({ where: { id }, data: { pinned: !n.pinned } });
  await audit(a, "news.pin", id, String(!n.pinned));
  revalidatePath("/admin");
  revalidatePath("/news");
  revalidatePath("/");
}
