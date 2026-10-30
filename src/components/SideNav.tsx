"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SideSection = { title?: string; links: { href: string; label: string; icon: string; tone?: "gold" }[] };

/** Levý sidebar. Ikony jsou cesty k SVG (viz ICONS), aby šly předat ze serveru jako text. */
export const ICONS: Record<string, string> = {
  home: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  users: "M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zM8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zM8 13c-3 0-6 1.5-6 4v2h12v-2c0-2.5-3-4-6-4zm8 0c-.5 0-1 0-1.500.1 1.600 1 2.500 2.300 2.500 3.900v2h6v-2c0-2.500-3-4-7-4z",
  live: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-5l1 3H8l1-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm6 3v6l5-3z",
  game: "M7 8h10a5 5 0 0 1 5 5v2a3 3 0 0 1-5.200 2L15 15H9l-1.800 2A3 3 0 0 1 2 15v-2a5 5 0 0 1 5-5zm1 2v1H7v2h1v1h2v-1h1v-2h-1v-1zm8 1.500a1 1 0 1 0 1 1 1 1 0 0 0-1-1z",
  star: "M12 2l3 6.500 7 .8-5.200 4.800 1.400 7L12 17.500 5.800 21l1.400-7L2 9.300l7-.8z",
  trophy: "M7 4h10v4a5 5 0 0 1-10 0zM7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4M12 13v4M8 21h8M10 17h4",
  search: "M11 4a7 7 0 1 0 4.200 12.600L20 21l1-1-4.400-4.800A7 7 0 0 0 11 4z",
  news: "M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM9 8h6M9 12h6M9 16h4",
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  shield: "M12 2l8 3v6c0 5-3.500 9-8 11-4.500-2-8-6-8-11V5z",
  admin: "M12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4zm9 4l-2 .7a7 7 0 0 1-.6 1.400l1 1.900-1.400 1.400-1.900-1a7 7 0 0 1-1.400.6L14 21h-4l-.7-2a7 7 0 0 1-1.400-.6l-1.900 1-1.400-1.400 1-1.900A7 7 0 0 1 5 14.700L3 14v-4l2-.7a7 7 0 0 1 .6-1.400l-1-1.900L6 4.600l1.900 1A7 7 0 0 1 9.300 5L10 3h4l.7 2a7 7 0 0 1 1.400.6l1.900-1 1.400 1.400-1 1.900a7 7 0 0 1 .6 1.400z",
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] ?? ICONS.star} />
    </svg>
  );
}

export default function SideNav({ sections }: { sections: SideSection[] }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  return (
    <nav aria-label="Menu" className="space-y-0.5">
      {sections.map((s, i) => (
        <div key={i}>
          {s.title && <p className="rail-title">{s.title}</p>}
          {s.links.map((l) => (
            <Link key={l.href + l.label} href={l.href} data-active={active(l.href.split("?")[0])} className={`rail-link ${l.tone === "gold" ? "!text-gold" : ""}`}>
              <Icon name={l.icon} />
              {l.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
