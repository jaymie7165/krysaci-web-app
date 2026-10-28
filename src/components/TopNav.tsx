"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export type NavItem =
  | { type: "link"; href: string; label: string; tone?: "gold" }
  | { type: "menu"; label: string; links: readonly (readonly [string, string])[] };

export default function TopNav({
  items,
  logo,
  children,
}: {
  items: NavItem[];
  logo: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  useEffect(() => setOpen(null), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-menu]")) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const flat = items.flatMap((i) => (i.type === "link" ? [[i.href, i.label, i.tone] as const] : i.links.map(([h, l]) => [h, l, undefined] as const)));

  return (
    <header className="sticky top-0 z-40 border-b border-ink-600/60 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 lg:px-8">
        {logo}
        <nav className="hidden h-full items-stretch gap-1 lg:flex" aria-label="Hlavní navigace">
          {items.map((it) =>
            it.type === "link" ? (
              <Link
                key={it.href}
                href={it.href}
                data-active={isActive(it.href)}
                aria-current={isActive(it.href) ? "page" : undefined}
                className={`tab ${it.tone === "gold" ? "tab-gold" : ""}`}
              >
                {it.label}
              </Link>
            ) : (
              <div key={it.label} className="relative flex h-full items-stretch" data-menu>
                <button
                  type="button"
                  aria-expanded={open === it.label}
                  aria-haspopup="true"
                  data-active={it.links.some(([h]) => isActive(h))}
                  onClick={() => setOpen(open === it.label ? null : it.label)}
                  className="tab gap-1"
                >
                  {it.label}
                  <svg viewBox="0 0 12 12" className="h-3 w-3 opacity-70" aria-hidden="true">
                    <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
                {open === it.label && (
                  <div className="card absolute left-0 top-full mt-px min-w-48 py-1 shadow-2xl">
                    {it.links.map(([h, l]) => (
                      <Link key={h} href={h} data-active={isActive(h)} className="menu-item">
                        {l}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3">{children}</div>
      </div>

      {/* Mobil: ploché menu s posuvem */}
      <nav className="flex gap-1 overflow-x-auto border-t border-ink-600/40 px-3 lg:hidden" aria-label="Hlavní navigace">
        {flat.map(([h, l, tone]) => (
          <Link
            key={h}
            href={h}
            data-active={isActive(h)}
            className={`tab h-11 whitespace-nowrap ${tone === "gold" ? "tab-gold" : ""}`}
          >
            {l}
          </Link>
        ))}
      </nav>
    </header>
  );
}
