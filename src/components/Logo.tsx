import Link from "next/link";

/** Logo v barvě aktuálního tématu. */
export default function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Play Haven">
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "rgb(var(--accent-soft))" }} />
            <stop offset="1" style={{ stopColor: "rgb(var(--accent-deep))" }} />
          </linearGradient>
        </defs>
        <path d="M4 6 L20 2 L36 6 V24 L20 38 L4 24Z" fill="url(#lg)" opacity=".22" />
        <path d="M4 6 L20 2 L36 6 V24 L20 38 L4 24Z" fill="none" stroke="url(#lg)" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M15 12 L29 20 L15 28Z" fill="url(#lg)" />
      </svg>
      <span className="hidden text-[15px] font-extrabold uppercase tracking-[0.22em] text-white sm:block">Play Haven</span>
    </Link>
  );
}
