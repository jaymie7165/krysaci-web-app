"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({
  links,
  orientation,
}: {
  links: readonly (readonly [string, string])[];
  orientation: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      className={
        orientation === "vertical" ? "flex flex-col gap-0.5" : "flex gap-1 overflow-x-auto px-3 pb-2"
      }
    >
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          data-active={isActive(href)}
          aria-current={isActive(href) ? "page" : undefined}
          className={`rail-link ${orientation === "horizontal" ? "whitespace-nowrap" : ""}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
