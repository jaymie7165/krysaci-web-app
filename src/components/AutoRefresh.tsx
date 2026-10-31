"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Obnovuje se jen na přehledech, kde se obsah mění sám (každá obnova znamená dotazy na server).
const LIVE_PAGES = ["/now", "/lfg", "/customs", "/tournaments", "/esports"];
const isLive = (p: string) => p === "/" || LIVE_PAGES.some((x) => p === x || p.startsWith(x + "/"));

/**
 * Sám doaktualizuje data na stránce (kdo hraje, nové turnaje, zápasy…), takže nemusíš mačkat F5.
 * Nic neobnovuje, když je záložka skrytá nebo když právě něco píšeš do formuláře.
 */
export default function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLive(pathname)) return;
    const typing = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      return el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el.tagName === "INPUT" && (el as HTMLInputElement).type !== "button");
    };
    const tick = () => {
      if (document.visibilityState === "visible" && !typing()) router.refresh();
    };
    const id = window.setInterval(tick, seconds * 1000);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, router, seconds]);

  return null;
}
