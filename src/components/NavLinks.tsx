"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavGroup = { title?: string; links: readonly (readonly [string, string])[] };

export default function NavLinks({
  groups,
  orientation,
}: {
  groups: NavGroup[];
  orientation: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  const item = (href: string, label: string, extra = "") => (
    <Link
      key={href}
      href={href}
      data-active={isActive(href)}
      aria-current={isActive(href) ? "page" : undefined}
      className={`rail-link ${extra}`}
    >
      {label}
    </Link>
  );

  if (orientation === "horizontal") {
    return (
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
        {groups.flatMap((g) => g.links.map(([href, label]) => item(href, label, "whitespace-nowrap")))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-5">
      {groups.map((g, i) => (
        <div key={g.title ?? i} className="flex flex-col gap-0.5">
          {g.title && <p className="px-3 pb-1 text-xs font-semibold text-slate-500">{g.title}</p>}
          {g.links.map(([href, label]) => item(href, label))}
        </div>
      ))}
    </nav>
  );
}
