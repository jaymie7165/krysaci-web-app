"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSpecies, SHOP } from "@/lib/pet";

async function me() {
  const s = await auth();
  if (!s?.user?.id) redirect("/api/auth/signin");
  const b = await db.user.findUnique({ where: { id: s.user.id }, select: { bannedAt: true } });
  if (b?.bannedAt) redirect("/banned");
  return s.user;
}
const done = (msg?: string): never => {
  revalidatePath("/pet");
  revalidatePath("/");
  redirect(`/pet${msg ? `?msg=${msg}` : ""}`);
};

export async function adoptPet(fd: FormData) {
  const u = await me();
  const species = String(fd.get("species") ?? "");
  const name = String(fd.get("name") ?? "").trim().slice(0, 20);
  if (!isSpecies(species) || name.length < 2) return done("petname");
  if (await db.pet.findUnique({ where: { userId: u.id } })) return done();
  await db.pet.create({ data: { userId: u.id, species, name } });
  done("adopted");
}

export async function feedPet() {
  const u = await me();
  const pet = await db.pet.findUnique({ where: { userId: u.id } });
  if (!pet) return done();
  if (pet.treats < 1) return done("notreats");
  await db.pet.update({ where: { userId: u.id }, data: { treats: { decrement: 1 }, lastFedAt: new Date(), xp: { increment: 2 } } });
  done("fed");
}

export async function buyItem(key: string) {
  const u = await me();
  const item = SHOP.find((i) => i.key === key);
  const pet = await db.pet.findUnique({ where: { userId: u.id } });
  if (!item || !pet) return done();
  if (await db.petItem.findUnique({ where: { userId_key: { userId: u.id, key } } })) return done();
  if (pet.coins < item.price) return done("nocoins");
  await db.$transaction([
    db.pet.update({ where: { userId: u.id }, data: { coins: { decrement: item.price } } }),
    db.petItem.create({ data: { userId: u.id, key } }),
  ]);
  done("bought");
}

/** Nasadí / sundá zakoupenou věc. Prázdný key = sundat. */
export async function equipItem(kind: "hat" | "bg" | "tint", key: string) {
  const u = await me();
  if (key) {
    const item = SHOP.find((i) => i.key === key && i.kind === kind);
    if (!item || !(await db.petItem.findUnique({ where: { userId_key: { userId: u.id, key } } }))) return done();
  }
  await db.pet.update({ where: { userId: u.id }, data: { [kind]: key || null } });
  done();
}

/** Krmení z malého okna na ploše (zůstane v okně). */
export async function feedPetWidget() {
  const u = await me();
  const pet = await db.pet.findUnique({ where: { userId: u.id } });
  if (pet && pet.treats > 0) await db.pet.update({ where: { userId: u.id }, data: { treats: { decrement: 1 }, lastFedAt: new Date(), xp: { increment: 2 } } });
  revalidatePath("/pet/widget");
  redirect("/pet/widget");
}
