import { pick, type Locale } from "@/lib/i18n";

type N = { id: string; title: string; body: string; pinned: boolean; createdAt: Date };

export default function NewsList({ items, locale }: { items: N[]; locale: Locale }) {
  const tag = locale === "cs" ? "cs-CZ" : locale === "sk" ? "sk-SK" : "en-GB";
  if (items.length === 0) return <p className="text-sm text-slate-500">{pick(locale, "Zatím žádné novinky.", "Zatiaľ žiadne novinky.", "No news yet.")}</p>;
  return (
    <ul className="space-y-3">
      {items.map((n) => (
        <li key={n.id} className="card space-y-1 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">{n.pinned && "📌 "}{n.title}</h3>
            <time className="shrink-0 text-xs text-slate-500">{n.createdAt.toLocaleDateString(tag, { timeZone: "Europe/Prague" })}</time>
          </div>
          <p className="whitespace-pre-line text-sm text-slate-300">{n.body}</p>
        </li>
      ))}
    </ul>
  );
}
