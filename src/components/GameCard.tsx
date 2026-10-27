import Link from "next/link";

type G = { slug: string; name: string; imageUrl: string; category: string; description?: string };

export default function GameCard({ game, href }: { game: G; href?: string }) {
  return (
    <Link
      href={href ?? `/leaderboards?game=${game.slug}`}
      className="card group overflow-hidden transition hover:border-accent hover:shadow-glow"
    >
      <div className="relative aspect-[460/215] overflow-hidden bg-ink-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.imageUrl}
          alt={game.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-800 via-transparent to-transparent" />
      </div>
      <div className="p-4">
        <span className="badge mb-2">{game.category}</span>
        <h3 className="text-xl font-semibold">{game.name}</h3>
        {game.description && <p className="mt-1 line-clamp-2 text-sm text-slate-400">{game.description}</p>}
      </div>
    </Link>
  );
}
