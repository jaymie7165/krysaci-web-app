import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getT, dateFmt, type Key } from "@/lib/i18n";
import { createTicket } from "@/app/actions";

export const metadata = { title: "Podpora" };

const statusKey = { OPEN: "ticketOpen", ANSWERED: "ticketAnswered", CLOSED: "ticketClosed" } as const;

export default async function TicketsPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");
  const { t, locale } = await getT();
  const staff = session.user.role !== "USER";
  const tickets = await db.ticket.findMany({
    where: staff ? undefined : { authorId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { author: true },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">{t("tickets")}</h1>

      <form action={createTicket} className="card grid gap-3 p-5 md:grid-cols-2">
        <div><label className="label">{t("ticketSubject")}</label><input name="subject" required minLength={3} maxLength={100} className="input" /></div>
        <div>
          <label className="label">{t("ticketCategory")}</label>
          <select name="category" className="input">
            <option>Podpora</option>
            <option>Report hráče</option>
            <option>Turnaje</option>
            <option>Návrh</option>
            <option>Jiné</option>
          </select>
        </div>
        <div className="md:col-span-2"><label className="label">{t("description")}</label><textarea name="body" required minLength={3} maxLength={2000} rows={4} className="input" /></div>
        <div><button className="btn">{t("submit")}</button></div>
      </form>

      {tickets.length === 0 && <p className="text-slate-500">{t("noData")}</p>}
      <div className="space-y-2">
        {tickets.map((x) => (
          <Link key={x.id} href={`/tickets/${x.id}`} className="card flex items-center justify-between p-4 transition hover:border-accent">
            <div>
              <h3 className="text-lg font-semibold">{x.subject}</h3>
              <p className="text-xs text-slate-500">
                {x.category} · {x.author.username} · {dateFmt(locale, x.updatedAt)}
              </p>
            </div>
            <span className="badge">{t(statusKey[x.status] as Key)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
