"use client";

import { useState, useTransition } from "react";
import { setTheme } from "@/app/actions";
import { THEMES, type ThemeKey } from "@/lib/themes";

/** Výběr barvy webu. Změna se projeví hned, na pozadí se uloží k účtu. */
export default function ThemePicker({ current, locale }: { current: ThemeKey; locale: "cs" | "sk" | "en" }) {
  const [active, setActive] = useState<ThemeKey>(current);
  const [, start] = useTransition();
  const li = locale === "cs" ? 0 : locale === "sk" ? 1 : 2;
  return (
    <div role="radiogroup" aria-label={["Barva webu", "Farba webu", "Site colour"][li]} className="flex flex-wrap gap-2">
      {THEMES.map((t) => (
        <button
          key={t.key}
          type="button"
          role="radio"
          aria-checked={active === t.key}
          title={t.label[li]}
          onClick={() => {
            setActive(t.key);
            document.documentElement.dataset.theme = t.key;
            start(() => void setTheme(t.key));
          }}
          className={`h-7 w-7 rounded-full border-2 transition ${active === t.key ? "scale-110 border-white" : "border-transparent hover:scale-105"}`}
          style={{ background: t.swatch }}
        />
      ))}
    </div>
  );
}
