"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Obrázek hry ze Steamu. Demo verze a některé hry nemají všechny typy obrázků,
 * proto se zkouší několik zdrojů za sebou a nakonec se ukáže iniciála.
 */
export default function SteamGameImg({ appId, name, icon }: { appId: number; name: string; icon?: string }) {
  const base = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}`;
  const sources = [
    `${base}/capsule_184x69.jpg`,
    `${base}/header.jpg`,
    `${base}/capsule_sm_120.jpg`,
    ...(icon ? [`https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${icon}.jpg`] : []),
  ];
  const [i, setI] = useState(0);
  const ref = useRef<HTMLImageElement>(null);

  // Chyba mohla nastat před načtením skriptu, takže onError už nepřijde.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setI((n) => n + 1);
  }, [i]);

  if (i >= sources.length) {
    return (
      <span
        aria-hidden="true"
        className="flex h-7 w-[74px] shrink-0 items-center justify-center rounded bg-gradient-to-br from-ink-700 to-ink-900 font-display text-xs font-bold text-bone/50"
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      ref={ref}
      key={i}
      src={sources[i]}
      alt=""
      loading="lazy"
      onError={() => setI((n) => n + 1)}
      className={`h-7 shrink-0 rounded object-cover ${i === sources.length - 1 && icon ? "w-7" : "w-[74px]"}`}
    />
  );
}
