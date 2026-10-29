"use client";

import { useState } from "react";

/** Sdílení vizitky: zkopíruje odkaz, otevře systémové sdílení nebo nabídne obrázek ke stažení. */
export default function ShareCard({
  handle,
  labels,
}: {
  handle: string;
  labels: { copy: string; copied: string; share: string; image: string };
}) {
  const [done, setDone] = useState(false);
  const path = `/players/${handle}`;
  const url = () => `${window.location.origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      window.prompt("URL", url());
    }
  }
  async function share() {
    try {
      await navigator.share({ title: "Play Haven", url: url() });
    } catch {
      /* uživatel sdílení zavřel */
    }
  }
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copy} className="btn-ghost !px-3 !py-1.5 text-xs">
        {done ? labels.copied : labels.copy}
      </button>
      {canShare && (
        <button type="button" onClick={share} className="btn-ghost !px-3 !py-1.5 text-xs">
          {labels.share}
        </button>
      )}
      <a href={`${path}/opengraph-image`} target="_blank" rel="noopener noreferrer" className="btn-ghost !px-3 !py-1.5 text-xs">
        {labels.image}
      </a>
    </div>
  );
}
