import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { acceptFriend, removeFriend } from "@/app/actions";

export const metadata = { title: "Přátelé" };

export default async function FriendsPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");
  const { t } = await getT();
  const me = session.user.id;
  const rows = await db.friendship.findMany({
    where: { OR: [{ requesterId: me }, { addresseeId: me }] },
    include: { requester: true, addressee: true },
    orderBy: { createdAt: "desc" },
  });
  const incoming = rows.filter((r) => r.status === "PENDING" && r.addresseeId === me);
  const outgoing = rows.filter((r) => r.status === "PENDING" && r.requesterId === me);
  const friends = rows.filter((r) => r.status === "ACCEPTED");
  const other = (r: (typeof rows)[number]) => (r.requesterId === me ? r.addressee : r.requester);

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">{t("friends")}</h1>

      {incoming.length > 0 && (
        <section>
          <h2 className="mb-3 text-2xl font-semibold">{t("incoming")}</h2>
          <div className="space-y-2">
            {incoming.map((r) => (
              <div key={r.id} className="card flex items-center justify-between p-3">
                <Link href={`/players/${r.requester.handle}`} className="font-medium text-white">{r.requester.username}</Link>
                <div className="flex gap-2">
                  <form action={acceptFriend.bind(null, r.id)}><button className="btn">{t("accept")}</button></form>
                  <form action={removeFriend.bind(null, r.id)}><button className="btn-ghost">✕</button></form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-2xl font-semibold">{t("yourFriends")}</h2>
        {friends.length === 0 && <p className="text-slate-500">{t("noData")}</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {friends.map((r) => {
            const o = other(r);
            return (
              <div key={r.id} className="card flex items-center gap-3 p-3">
                {o.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
                )}
                <Link href={`/players/${o.handle}`} className="flex-1 truncate font-medium text-white">{o.username}</Link>
                <form action={removeFriend.bind(null, r.id)}><button className="text-slate-500 hover:text-ember" aria-label="remove">✕</button></form>
              </div>
            );
          })}
        </div>
      </section>

      {outgoing.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-400">{t("pending")}</h2>
          <div className="flex flex-wrap gap-2">
            {outgoing.map((r) => (
              <span key={r.id} className="badge">{r.addressee.username}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
