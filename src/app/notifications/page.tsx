import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, pick } from "@/lib/i18n";

export const metadata = { title: "Oznámení" };

export default async function NotificationsPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/api/auth/signin");
  const uid = s.user.id;
  const { locale } = await getT();
  const L = (cs: string, sk: string, en: string) => pick(locale, cs, sk, en);
  const items = await db.notification.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 50 });
  const tag = locale === "cs" ? "cs-CZ" : locale === "sk" ? "sk-SK" : "en-GB";
  async function readAll() {
    "use server";
    const a = await auth();
    if (!a?.user?.id) return;
    await db.notification.updateMany({ where: { userId: a.user.id, readAt: null }, data: { readAt: new Date() } });
    revalidatePath("/notifications");
    revalidatePath("/", "layout");
  }
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{L("Oznámení", "Oznámenia", "Notifications")}</h1>
        {items.some((i) => !i.readAt) && (
          <form action={readAll}><button className="btn-ghost">{L("Označit vše jako přečtené", "Označiť všetko ako prečítané", "Mark all read")}</button></form>
        )}
      </div>
      {items.length === 0 && <p className="card p-5 text-slate-400">{L("Zatím nic. Sem chodí žádosti o přátelství, změny v turnajích, tipy a přidání do tvých her.", "Zatiaľ nič.", "Nothing yet.")}</p>}
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} className={`card p-4 ${n.readAt ? "opacity-70" : "border-accent/50"}`}>
            <Link href={n.url ?? "/notifications"} className="block">
              <p className="font-semibold text-white">{!n.readAt && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" />}{n.title}</p>
              {n.body && <p className="text-sm text-slate-400">{n.body}</p>}
              <p className="mt-1 text-xs text-slate-500">{n.createdAt.toLocaleString(tag, { timeZone: "Europe/Prague" })}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
