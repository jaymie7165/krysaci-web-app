import { cache } from "react";
import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { db } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      handle: string;
      role: "USER" | "MOD" | "ADMIN";
      name?: string | null;
      image?: string | null;
    };
  }
}

function slugifyHandle(input: string) {
  const base = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 20);
  return base || "hrac";
}

async function uniqueHandle(username: string) {
  const base = slugifyHandle(username);
  let candidate = base;
  let n = 1;
  while (await db.user.findUnique({ where: { handle: candidate } })) {
    n += 1;
    candidate = `${base}${n}`;
  }
  return candidate;
}

const adminIds = (process.env.ADMIN_DISCORD_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const { handlers, auth: rawAuth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID,
      clientSecret: process.env.AUTH_DISCORD_SECRET,
      // Discord posílá v odpovědi parametr "iss" (RFC 9207); bez tohoto nastavení ho knihovna odmítne.
      issuer: "https://discord.com",
      authorization: { params: { scope: "identify" } },
    }),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    async jwt({ token, account, profile }) {
      // Při prvním přihlášení uložíme / aktualizujeme uživatele v naší databázi.
      if (account?.provider === "discord" && profile) {
        const p = profile as { id: string; username: string; global_name?: string | null; avatar?: string | null };
        const avatarUrl = p.avatar ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png?size=256` : null;
        const displayName = p.global_name || p.username;
        const existing = await db.user.findUnique({ where: { discordId: p.id } });
        const isAdmin = adminIds.includes(p.id);
        const user = existing
          ? await db.user.update({
              where: { id: existing.id },
              data: {
                username: displayName,
                avatarUrl,
                lastSeenAt: new Date(),
                ...(isAdmin ? { role: "ADMIN" } : {}),
              },
            })
          : await db.user.create({
              data: {
                discordId: p.id,
                username: displayName,
                handle: await uniqueHandle(p.username),
                avatarUrl,
                role: isAdmin ? "ADMIN" : "USER",
              },
            });
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) {
        const user = await db.user.findUnique({ where: { id: token.uid as string } });
        if (user) {
          session.user.id = user.id;
          session.user.handle = user.handle;
          session.user.role = user.role;
          session.user.name = user.username;
          session.user.image = user.avatarUrl;
        }
      }
      return session;
    },
  },
});

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");
  return session.user;
}

/** Relace se v rámci jednoho požadavku načte jen jednou (layout, navigace i stránka se na ni ptají). */
export const auth = cache(rawAuth) as typeof rawAuth;
