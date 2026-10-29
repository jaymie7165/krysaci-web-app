import Link from "next/link";
import GameImage from "./GameImage";

type G = { slug: string; name: string; imageUrl: string; category: string; description?: string };

export default function GameCard({ game, href, compact }: { game: G; href?: string; compact?: boolean }) {
  const target = href ?? `/games/${game.slug}`;

  if (compact) {
    return (
      <Link
        href={target}
        className="group relative block aspect-[4/3] overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-900 transition hover:shadow-glow"
      >
        <GameImage
          src={game.imageUrl}
          name={game.name}
          className="h-full w-full transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="font-display text-base font-semibold leading-tight text-white">{game.name}</p>
          <p className="text-xs text-slate-300">{game.category}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link href={target} className="card group overflow-hidden transition hover:shadow-glow">
      <div className="relative aspect-[16/9] overflow-hidden bg-ink-900">
        <GameImage
          src={game.imageUrl}
          name={game.name}
          className="h-full w-full transition duration-500 group-hover:scale-105"
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
