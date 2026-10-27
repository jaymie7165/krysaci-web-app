import { searchLol } from "@/app/lookup/actions";
import { PLATFORMS, DEFAULT_PLATFORM } from "@/lib/riot";
import { pick, type Locale } from "@/lib/i18n";

/** Vyhledávací pole Riot ID (použité na hlavní stránce i na stránce Statistiky). */
export default function LolSearch({ locale, size = "lg" }: { locale: Locale; size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <form action={searchLol} className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row">
      <select
        name="platform"
        defaultValue={DEFAULT_PLATFORM}
        aria-label={pick(locale, "Server", "Server", "Server")}
        className={`input sm:w-28 ${big ? "py-3" : ""}`}
      >
        {Object.entries(PLATFORMS).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>
      <input
        name="riotId"
        required
        placeholder="Riot ID, např. Jaymie#HNZD"
        aria-label="Riot ID"
        className={`input flex-1 ${big ? "py-3 text-base" : ""}`}
      />
      <button className={`btn ${big ? "px-6 py-3 text-base" : ""}`}>
        {pick(locale, "Hledat v LoL", "Hľadať v LoL", "Search LoL")}
      </button>
    </form>
  );
}
