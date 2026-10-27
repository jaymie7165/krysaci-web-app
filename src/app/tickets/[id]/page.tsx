import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getT, dateFmt, type Key } from "@/lib/i18n";
import { replyTicket, closeTicket } from "@/app/actions";

const statusKey = { OPEN: "ticketOpen", ANSWERED: "ticketAnswered", CLOSED: "ticketClosed" } as const;

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");
  const { t, locale } = await getT();
  const ticket = await db.ticket.findUnique({
    where: { id },
    include: { author: true, messages: { orderBy: { createdAt: "asc" }, include: { author: true } } },
  });
  if (!ticket) notFound();
  const staff = session.user.role !== "USER";
  if (ticket.authorId !== session.user.id && !staff) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{ticket.subject}</h1>
          <p className="text-sm text-slate-500">{ticket.category} · {ticket.author.username}</p>
        </div>
        <span className="badge">{t(statusKey[ticket.status] as Key)}</span>
      </div>

      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div key={m.id} className={`card p-4 ${m.fromStaff ? "border-accent/60" : ""}`}>
            <p className="mb-1 text-xs text-slate-500">
              <span className="font-semibold text-slate-300">{m.author.username}</span>
              {m.fromStaff && <span className="badge ml-2">Staff</span>} · {dateFmt(locale, m.createdAt)}
            </p>
            <p className="whitespace-pre-wrap text-slate-200">{m.body}</p>
          </div>
        ))}
      </div>

      {ticket.status !== "CLOSED" && (
        <div className="space-y-3">
          <form action={replyTicket.bind(null, ticket.id)} className="card space-y-3 p-4">
            <textarea name="body" required rows={3} maxLength={2000} className="input" />
            <button className="btn">{t("reply")}</button>
          </form>
          <form action={closeTicket.bind(null, ticket.id)}>
            <button className="btn-ghost">{t("close")}</button>
          </form>
        </div>
      )}
    </div>
  );
}
