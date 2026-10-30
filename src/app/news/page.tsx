import { db } from "@/lib/db";
import { getT, pick } from "@/lib/i18n";
import NewsList from "@/components/NewsList";

export const metadata = { title: "Novinky" };

export default async function NewsPage() {
  const { locale } = await getT();
  const items = await db.news.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 50 });
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-3xl font-bold">{pick(locale, "Novinky", "Novinky", "News")}</h1>
      <NewsList items={items} locale={locale} />
    </div>
  );
}
