"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export type TopTab = { href: string; label: string; tone?: "gold" };

export default function TopNav({
  tabs,
  logo,
  drawer,
  children,
  menuLabel,
}: {
  tabs: TopTab[];
  logo: ReactNode;
  drawer: ReactNode;
  children: ReactNode;
  menuLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-600/50 bg-ink-950/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
        <button
          type="button"
          aria-label={menuLabel}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="grid h-9 w-9 place-items-center rounded-lg text-slate-300 hover:bg-ink-700 hover:text-white lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <div className="lg:w-[208px]">{logo}</div>
        <nav className="hidden h-full items-stretch gap-1 lg:flex" aria-label="Hlavní navigace">
          {tabs.map((tb) => (
            <Link
              key={tb.href}
              href={tb.href}
              data-active={isActive(tb.href)}
              aria-current={isActive(tb.href) ? "page" : undefined}
              className={`tab ${tb.tone === "gold" ? "tab-gold" : ""}`}
            >
              {tb.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">{children}</div>
      </div>

      {/* Mobil: výsuvné menu */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto bg-ink-950/95 p-4 backdrop-blur-xl lg:hidden">
          <div className="mx-auto max-w-sm">{drawer}</div>
        </div>
      )}
    </header>
  );
}
