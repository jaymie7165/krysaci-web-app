const COLORS: Record<string, string> = {
  IRON: "#8a7f7a", BRONZE: "#b27040", SILVER: "#a3b0bd", GOLD: "#e6b94f", PLATINUM: "#4fc1b5",
  EMERALD: "#3fc784", DIAMOND: "#6fa5ff", MASTER: "#c46bff", GRANDMASTER: "#ff6b7a", CHALLENGER: "#f5d76e",
  // Valorant
  IRON_V: "#8a7f7a", RADIANT: "#fff1a8", IMMORTAL: "#ff5a6e", ASCENDANT: "#3fc784", UNRATED: "#8a8aa3",
};

export function tierColor(tier: string) {
  const key = tier.toUpperCase().split(" ")[0];
  return COLORS[key] ?? "#a78bfa";
}

export default function RankTag({ tier, sub }: { tier: string; sub?: string }) {
  const c = tierColor(tier);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} aria-hidden="true" />
      <span className="font-display text-lg font-bold" style={{ color: c }}>
        {tier[0].toUpperCase() + tier.slice(1).toLowerCase()}
        {sub ? ` ${sub}` : ""}
      </span>
    </span>
  );
}
