import { TINT_FILTER, type Species } from "@/lib/pet";

type Mood = "sated" | "ok" | "hungry" | "starving" | "sleeping";

const PALETTE: Record<Species, { body: string; belly: string; dark: string; accent: string }> = {
  frog: { body: "#5fcf6a", belly: "#c9f5a8", dark: "#2f8f45", accent: "#ff8aa0" },
  cat: { body: "#f0a35c", belly: "#ffe3c2", dark: "#c27a30", accent: "#ff8aa0" },
  dog: { body: "#c99560", belly: "#f6e2c4", dark: "#8a5d32", accent: "#ff8aa0" },
  dragon: { body: "#8a6bff", belly: "#d8cbff", dark: "#5a3fd0", accent: "#ffb347" },
};

/** Animovaný pet jako SVG. stage 0 až 4, vzhled se zhoršuje podle `penalty` (nekrmený pet bledne a kleje). */
export default function PetSprite({
  species, stage, mood, penalty = 0, hat, tint, size = 220,
}: {
  species: Species; stage: number; mood: Mood; penalty?: number; hat?: string | null; tint?: string | null; size?: number;
}) {
  const c = PALETTE[species];
  const sleeping = mood === "sleeping";
  const sad = mood === "hungry" || mood === "starving" || sleeping;
  const egg = species === "dragon" && stage === 0;
  const tadpole = species === "frog" && stage <= 1;
  const scale = 0.66 + stage * 0.085;
  const wash = ["", "saturate(.8)", "saturate(.5) brightness(.92)", "grayscale(.75) brightness(.78)"][penalty] ?? "";
  const filter = [tint ? TINT_FILTER[tint] : "", wash].filter(Boolean).join(" ") || undefined;
  const headY = tadpole ? 112 : 88;
  const bodyAnim = sleeping ? "pet-breathe" : mood === "sated" ? "pet-hop" : "pet-bob";

  const eyes = sleeping ? (
    <g stroke="#2a1b3a" strokeWidth="3" strokeLinecap="round" fill="none">
      <path d={`M84 ${headY - 2}q6 5 12 0`} />
      <path d={`M104 ${headY - 2}q6 5 12 0`} />
    </g>
  ) : (
    <g className="pet-blink">
      {[88, 112].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={headY - 2} rx="6.5" ry={sad ? 5 : 7} fill="#fff" />
          <circle cx={x + (mood === "starving" ? 0 : 1)} cy={headY - (sad ? 0 : 1)} r="3.6" fill="#2a1b3a" />
          <circle cx={x + 2} cy={headY - 3} r="1.3" fill="#fff" />
        </g>
      ))}
      {sad && <path d={`M80 ${headY - 13}l14 4M120 ${headY - 13}l-14 4`} stroke="#2a1b3a" strokeWidth="2.5" strokeLinecap="round" />}
    </g>
  );
  const mouth = sleeping || mood === "starving" ? (
    <path d={`M92 ${headY + 14}q8 -6 16 0`} stroke="#2a1b3a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  ) : sad ? (
    <path d={`M93 ${headY + 13}q7 -4 14 0`} stroke="#2a1b3a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  ) : (
    <path d={`M91 ${headY + 9}q9 ${mood === "sated" ? 12 : 8} 18 0`} stroke="#2a1b3a" strokeWidth="2.5" fill={mood === "sated" ? "#ff7a8a" : "none"} strokeLinecap="round" className={mood === "sated" ? "pet-chew" : undefined} />
  );

  const crown = stage >= 4 && (
    <g transform={`translate(0 ${headY - 88})`}>
      <path d="M78 52l6-18 10 12 6-16 6 16 10-12 6 18z" fill="#ffd34d" stroke="#c99a1a" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="100" cy="36" r="2.6" fill="#ff5a7a" />
    </g>
  );
  const scarf = stage >= 2 && stage < 4 && !tadpole && !egg && <path d="M70 120q30 14 60 0l-4 12q-26 10 -52 0z" fill={c.accent} stroke={c.dark} strokeWidth="1.5" opacity=".95" />;
  const cape = stage >= 4 && <path d="M72 116q28 22 56 0l8 46q-36 14 -72 0z" fill="#d6304f" opacity=".9" />;

  const hatEl = hat && !egg && (
    <g transform={`translate(0 ${headY - 88})`}>
      {hat === "cap" && <><path d="M66 62q34 -34 68 0z" fill="#3b82f6" stroke="#1e4fa8" strokeWidth="2" /><path d="M120 60h26q-4 8 -26 6z" fill="#1e4fa8" /></>}
      {hat === "bow" && <g fill="#ff6fa5" stroke="#c2407a" strokeWidth="2"><path d="M100 52l-22 -12v24z" /><path d="M100 52l22 -12v24z" /><circle cx="100" cy="52" r="5" /></g>}
      {hat === "party" && <><path d="M82 58l18 -44l18 44z" fill="#ffd34d" stroke="#c99a1a" strokeWidth="2" /><circle cx="100" cy="14" r="4" fill="#ff5a7a" /><path d="M88 46l24 -2M92 34l16 -2" stroke="#ff5a7a" strokeWidth="3" /></>}
      {hat === "tophat" && <><rect x="80" y="14" width="40" height="40" rx="3" fill="#222" /><rect x="70" y="50" width="60" height="8" rx="3" fill="#222" /><rect x="80" y="40" width="40" height="6" fill="#d6304f" /></>}
      {hat === "headphones" && <><path d="M64 78q0 -40 36 -40t36 40" fill="none" stroke="#222" strokeWidth="6" strokeLinecap="round" /><rect x="58" y="72" width="14" height="24" rx="6" fill="#ff4d8d" /><rect x="128" y="72" width="14" height="24" rx="6" fill="#ff4d8d" /></>}
    </g>
  );

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`${species} ${stage}`} style={{ filter, overflow: "visible" }}>
      <ellipse cx="100" cy="176" rx={34 * scale + 10} ry="7" fill="#000" opacity=".25" />
      <g className={bodyAnim} style={{ transformOrigin: "100px 176px", transformBox: "view-box" }}>
        <g transform={`translate(100 176) scale(${scale}) translate(-100 -176)`}>
          {egg ? (
            <g className="pet-wobble" style={{ transformOrigin: "100px 170px" }}>
              <ellipse cx="100" cy="124" rx="40" ry="52" fill={c.body} />
              <path d="M62 120l12 -10l10 12l12 -12l12 12l12 -12l12 12l8 -8" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" opacity=".6" />
              <circle cx="84" cy="94" r="7" fill={c.belly} opacity=".7" /><circle cx="118" cy="140" r="9" fill={c.belly} opacity=".6" />
              {sleeping && <text x="132" y="70" fontSize="20" fill="#fff" className="pet-zzz">z</text>}
            </g>
          ) : (
            <>
              {/* ocas */}
              {species === "cat" && <path d="M130 150q40 0 30 -40" stroke={c.body} strokeWidth="9" fill="none" strokeLinecap="round" className="pet-wag" style={{ transformOrigin: "130px 150px" }} />}
              {species === "dog" && <path d="M130 150q26 -6 24 -30" stroke={c.dark} strokeWidth="9" fill="none" strokeLinecap="round" className="pet-wag" style={{ transformOrigin: "130px 150px" }} />}
              {species === "dragon" && <path d="M128 152q36 6 34 -26l-8 6" stroke={c.body} strokeWidth="11" fill="none" strokeLinecap="round" />}
              {tadpole && <path d="M128 130q40 -14 44 16q-34 12 -44 -8z" fill={c.dark} className="pet-wag" style={{ transformOrigin: "128px 132px" }} />}
              {/* křídla */}
              {species === "dragon" && stage >= 2 && (
                <g fill={c.dark} opacity=".9" className="pet-flap" style={{ transformOrigin: "100px 120px" }}>
                  <path d="M70 120l-44 -34q8 30 14 36l-12 14q26 4 40 -2z" /><path d="M130 120l44 -34q-8 30 -14 36l12 14q-26 4 -40 -2z" />
                </g>
              )}
              {/* tělo */}
              {!tadpole && <ellipse cx="100" cy="144" rx={species === "cat" && stage === 0 ? 30 : 38} ry="32" fill={c.body} />}
              {!tadpole && <ellipse cx="100" cy="150" rx="22" ry="22" fill={c.belly} />}
              {/* nohy */}
              {!tadpole && <><ellipse cx="78" cy="174" rx="13" ry="8" fill={c.dark} /><ellipse cx="122" cy="174" rx="13" ry="8" fill={c.dark} /></>}
              {tadpole && stage === 1 && <><ellipse cx="82" cy="158" rx="9" ry="6" fill={c.dark} /><ellipse cx="118" cy="158" rx="9" ry="6" fill={c.dark} /></>}
              {/* uši / rohy / oči nahoře */}
              {species === "cat" && <><path d="M68 70l6 -30l22 18z" fill={c.body} /><path d="M132 70l-6 -30l-22 18z" fill={c.body} /><path d="M74 62l2 -12l9 8z" fill={c.accent} /><path d="M126 62l-2 -12l-9 8z" fill={c.accent} /></>}
              {species === "dog" && <><ellipse cx="66" cy="92" rx="13" ry="26" fill={c.dark} transform="rotate(12 66 92)" /><ellipse cx="134" cy="92" rx="13" ry="26" fill={c.dark} transform="rotate(-12 134 92)" /></>}
              {species === "dragon" && stage >= 1 && <><path d="M76 58l-8 -22l20 14z" fill={stage >= 3 ? "#ffd34d" : c.dark} /><path d="M124 58l8 -22l-20 14z" fill={stage >= 3 ? "#ffd34d" : c.dark} /></>}
              {species === "frog" && !tadpole && <><circle cx="80" cy="60" r="13" fill={c.body} /><circle cx="120" cy="60" r="13" fill={c.body} /></>}
              {/* hlava */}
              {tadpole ? <ellipse cx="100" cy="124" rx="40" ry="32" fill={c.body} /> : <circle cx="100" cy="88" r={species === "cat" && stage === 0 ? 40 : 37} fill={c.body} />}
              {species === "dog" && !tadpole && <ellipse cx="100" cy="102" rx="18" ry="13" fill={c.belly} />}
              {species === "frog" && !tadpole && stage >= 3 && <><circle cx="76" cy="104" r="4" fill={c.dark} opacity=".5" /><circle cx="126" cy="76" r="5" fill={c.dark} opacity=".5" /></>}
              {species === "cat" && stage >= 3 && <path d="M92 54v12M100 52v14M108 54v12" stroke={c.dark} strokeWidth="4" strokeLinecap="round" />}
              {mood !== "sleeping" && mood !== "starving" && <><circle cx="76" cy={headY + 8} r="6" fill={c.accent} opacity=".5" /><circle cx="124" cy={headY + 8} r="6" fill={c.accent} opacity=".5" /></>}
              {species === "cat" && <path d={`M60 ${headY + 4}h-16M60 ${headY + 10}l-14 6M140 ${headY + 4}h16M140 ${headY + 10}l14 6`} stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".8" />}
              {eyes}
              {species === "dog" && !tadpole && <ellipse cx="100" cy={headY + 4} rx="6" ry="4.5" fill="#2a1b3a" />}
              {mouth}
              {mood === "starving" && <path d={`M122 ${headY + 4}q4 8 0 12q-4 -4 0 -12z`} fill="#7ad7ff" />}
              {species === "dragon" && stage >= 3 && mood !== "sleeping" && <g className="pet-fire" fill="#ffb347"><path d="M112 98q22 -6 30 6q-14 2 -18 10q-4 -8 -12 -16z" /></g>}
              {cape}{scarf}{crown}{hatEl}
              {sleeping && <text x="138" y="60" fontSize="22" fill="#fff" className="pet-zzz">z</text>}
              {mood === "sated" && <g fill="#ff5a7a" className="pet-hearts"><path d="M146 52q-5 -9 -11 -2q-4 8 11 18q15 -10 11 -18q-6 -7 -11 2z" transform="scale(.7) translate(60 20)" /></g>}
            </>
          )}
        </g>
      </g>
    </svg>
  );
}
