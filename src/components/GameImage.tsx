"use client";

import { useEffect, useRef, useState } from "react";

/** Obrázek hry s pevným poměrem stran a náhradním motivem, když se zdroj nenačte. */
export default function GameImage({ src, name, className = "" }: { src: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // Obrázek mohl selhat ještě před načtením skriptu, takže událost onError by už nepřišla.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  if (failed || !src) {
    return (
      <div
        role="img"
        aria-label={name}
        className={`flex items-center justify-center bg-gradient-to-br from-ink-700 to-ink-900 pb-12 font-display text-3xl font-bold text-bone/50 ${className}`}
      >
        {initials}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      ref={ref}
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
