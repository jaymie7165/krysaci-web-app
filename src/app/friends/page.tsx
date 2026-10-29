import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getT, pick } from "@/lib/i18n";
import { acceptFriend, removeFriend, sendFriendRequest, sendFriendRequestByHandle } from "@/app/actions";
import Notice from "@/components/Notice";

export const metadata = { title: "Přátelé" };

export default async function FriendsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");
  const { t, locale } = await getT();
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

  // Návrhy: nedávno aktivní hráči, se kterými ještě nemám žádný vztah.
  const known = new Set([me, ...rows.map((r) => (r.requesterId === me ? r.addresseeId : r.requesterId))]);
  const suggestions = (
    await db.user.findMany({
      where: { id: { notIn: [...known] } },
      orderBy: { lastSeenAt: "desc" },
      take: 8,
    })
  ).slice(0, 6);

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">{t("friends")}</h1>
      <Notice msg={msg} locale={locale} />

      <section className="card space-y-3 p-5">
        <h2 className="text-xl font-semibold">{pick(locale, "Přidat kamaráda", "Pridať kamaráta", "Add a friend")}</h2>
        <form action={sendFriendRequestByHandle} className="flex flex-wrap gap-2">
          <input
            name="handle"
            required
            maxLength={40}
            placeholder={pick(locale, "Jméno nebo @handle hráče", "Meno alebo @handle hráča", "Player name or @handle")}
            className="input max-w-sm"
          />
          <button className="btn">{pick(locale, "Poslat žádost", "Poslať žiadosť", "Send request")}</button>
        </form>
        <p className="text-sm text-slate-400">
          {pick(
            locale,
            "Hráč dostane žádost a po potvrzení se objeví v seznamu. Najdeš ho i v sekci Hráči, kde je u profilu tlačítko Přidat do přátel. Kamarád se musí na webu aspoň jednou přihlásit přes Discord.",
            "Hráč dostane žiadosť a po potvrdení sa objaví v zozname. Nájdeš ho aj v sekcii Hráči, kde je pri profile tlačidlo Pridať do priateľov. Kamarát sa musí na webe aspoň raz prihlásiť cez Discord.",
            "The player gets a request and shows up in your list once they accept. You can also find them under Players and use Add friend on their profile. They need to have signed in with Discord at least once."
          )}
        </p>
      </section>

      {incoming.length > 0 && (
        <section>
          <h2 className="mb-3 text-2xl font-semibold">{t("incoming")}</h2>
          <div className="space-y-2">
            {incoming.map((r) => (
              <div key={r.id} className="card flex items-center justify-between p-3">
                <Link href={`/players/${r.requester.handle}`} className="font-medium text-white">{r.requester.username}</Link>
                <div className="flex gap-2">
                  <form action={acceptFriend.bind(null, r.id)}><button className="btn">{t("accept")}</button></form>
                  <form action={removeFriend.bind(null, r.id)}><button className="btn-ghost" aria-label="reject">✕</button></form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-2xl font-semibold">{t("yourFriends")}</h2>
        {friends.length === 0 && (
          <p className="card p-5 text-slate-400">
            {pick(locale, "Zatím nikoho nemáš. Pošli žádost přes formulář výš nebo zkus návrhy níž.", "Zatiaľ nikoho nemáš. Pošli žiadosť cez formulár vyššie alebo skús návrhy nižšie.", "No friends yet. Send a request with the form above or try the suggestions below.")}
          </p>
        )}
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
              <span key={r.id} className="badge gap-2">
                {r.addressee.username}
                <form action={removeFriend.bind(null, r.id)} className="inline">
                  <button className="text-slate-400 hover:text-ember" aria-label="cancel">✕</button>
                </form>
              </span>
            ))}
          </div>
        </section>
      )}

      {suggestions.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-300">{pick(locale, "Koho možná znáš", "Koho možno poznáš", "People you may know")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((p) => (
              <div key={p.id} className="card flex items-center gap-3 p-3">
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
                ) : (
                  <span className="h-10 w-10 rounded-full bg-ink-600" />
                )}
                <Link href={`/players/${p.handle}`} className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-white">{p.username}</span>
                  <span className="block truncate text-xs text-slate-500">@{p.handle}</span>
                </Link>
                <form action={sendFriendRequest.bind(null, p.id)}><button className="btn-ghost px-3 py-1.5 text-xs">+</button></form>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
