import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, pick } from "@/lib/i18n";
import { banUser, unbanUser, setRole, createNews, deleteNews, togglePinNews } from "./actions";

export const metadata = { title: "Admin" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await auth();
  if (s?.user?.role !== "ADMIN") redirect("/");
  const { locale } = await getT();
  const L = (cs: string, sk: string, en: string) => pick(locale, cs, sk, en);
  const { q } = await searchParams;
  const term = (q ?? "").trim();

  const [users, news, logs, counts] = await Promise.all([
    db.user.findMany({
      where: term ? { OR: [{ handle: { contains: term, mode: "insensitive" } }, { username: { contains: term, mode: "insensitive" } }] } : {},
      orderBy: term ? { handle: "asc" } : { createdAt: "desc" },
      take: 30,
    }),
    db.news.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 20 }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    Promise.all([db.user.count(), db.user.count({ where: { bannedAt: { not: null } } }), db.ticket.count({ where: { status: "OPEN" } })]),
  ]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="text-sm text-slate-400">
          {counts[0]} {L("hráčů", "hráčov", "players")} · {counts[1]} {L("zablokovaných", "zablokovaných", "banned")} ·{" "}
          <Link href="/tickets" className="text-violet-300 hover:underline">{counts[2]} {L("otevřených ticketů", "otvorených ticketov", "open tickets")}</Link>
        </p>
      </header>

      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-semibold">{L("Novinky", "Novinky", "News")}</h2>
        <form action={createNews} className="space-y-2">
          <input name="title" required minLength={3} maxLength={120} placeholder={L("Nadpis", "Nadpis", "Title")} className="input w-full" />
          <textarea name="body" required minLength={3} maxLength={3000} rows={3} placeholder={L("Text novinky", "Text novinky", "Body")} className="input w-full" />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" name="pinned" className="accent-violet-500" /> {L("Připnout", "Pripnúť", "Pin")}</label>
            <button className="btn">{L("Zveřejnit", "Zverejniť", "Publish")}</button>
          </div>
        </form>
        <ul className="divide-y divide-ink-600/40">
          {news.map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate">{n.pinned && "📌 "}{n.title}</span>
              <span className="flex shrink-0 gap-2">
                <form action={togglePinNews}><input type="hidden" name="id" value={n.id} /><button className="text-violet-300 hover:underline">{n.pinned ? L("Odepnout", "Odpnúť", "Unpin") : L("Připnout", "Pripnúť", "Pin")}</button></form>
                <form action={deleteNews}><input type="hidden" name="id" value={n.id} /><button className="text-ember hover:underline">{L("Smazat", "Zmazať", "Delete")}</button></form>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-semibold">{L("Hráči", "Hráči", "Players")}</h2>
        <form className="flex gap-2">
          <input name="q" defaultValue={term} placeholder={L("Hledat jméno nebo @handle", "Hľadať meno alebo @handle", "Search name or @handle")} className="input flex-1" />
          <button className="btn">{L("Hledat", "Hľadať", "Search")}</button>
        </form>
        <ul className="divide-y divide-ink-600/40">
          {users.map((u) => (
            <li key={u.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link href={`/players/${u.handle}`} className="font-medium hover:text-violet-300">{u.username}</Link>{" "}
                <span className="text-slate-500">@{u.handle}</span>
                {u.role === "ADMIN" && <span className="chip ml-2">ADMIN</span>}
                {u.bannedAt && <span className="chip ml-2 text-ember">BAN{u.banReason ? `: ${u.banReason}` : ""}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {u.bannedAt ? (
                  <form action={unbanUser}><input type="hidden" name="id" value={u.id} /><button className="btn-ghost">{L("Odblokovat", "Odblokovať", "Unban")}</button></form>
                ) : u.role !== "ADMIN" ? (
                  <form action={banUser} className="flex gap-1">
                    <input type="hidden" name="id" value={u.id} />
                    <input name="reason" placeholder={L("Důvod", "Dôvod", "Reason")} className="input w-32" />
                    <button className="btn-ghost text-ember">Ban</button>
                  </form>
                ) : null}
                {u.id !== s.user.id && (
                  <form action={setRole}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="role" value={u.role === "ADMIN" ? "USER" : "ADMIN"} />
                    <button className="btn-ghost">{u.role === "ADMIN" ? L("Odebrat admina", "Odobrať admina", "Remove admin") : L("Udělat adminem", "Urobiť adminom", "Make admin")}</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-semibold">{L("Záznam akcí", "Záznam akcií", "Audit log")}</h2>
        <ul className="space-y-1 text-xs text-slate-400">
          {logs.map((l) => (
            <li key={l.id}>
              <span className="text-slate-500">{l.createdAt.toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })}</span> · {l.actorName} · <span className="text-slate-300">{l.action}</span>
              {l.target && ` · ${l.target}`}{l.detail && ` · ${l.detail}`}
            </li>
          ))}
          {logs.length === 0 && <li>{L("Zatím nic.", "Zatiaľ nič.", "Nothing yet.")}</li>}
        </ul>
      </section>
    </div>
  );
}
