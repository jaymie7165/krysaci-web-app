import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Play Haven vizitka";

/** Sdílitelná vizitka hráče (náhled odkazu na Discordu, v chatu i ke stažení). */
export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const p = await db.user
    .findUnique({
      where: { handle },
      include: { gameProfiles: { include: { game: true }, take: 4 }, stats: true },
    })
    .catch(() => null);

  const accent = p?.accent ?? "#8b5cf6";
  const avatar = p?.avatarUrl?.replace(/\.webp(\?|$)/, ".png$1");
  const points = p?.stats.reduce((s, x) => s + x.points, 0) ?? 0;
  const wins = p?.stats.reduce((s, x) => s + x.wins, 0) ?? 0;
  const matches = p?.stats.reduce((s, x) => s + x.matches, 0) ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: 64, color: "#ece9f8", background: `linear-gradient(135deg, ${accent} 0%, #18122f 45%, #0a0814 100%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 30, letterSpacing: 8, fontWeight: 700 }}>PLAY HAVEN</div>
          <div style={{ fontSize: 24, opacity: 0.8 }}>vizitka hráče</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} width={200} height={200} alt="" style={{ borderRadius: 24, border: "4px solid rgba(255,255,255,0.35)" }} />
          ) : (
            <div style={{ width: 200, height: 200, borderRadius: 24, background: "#332a5e", display: "flex" }} />
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>{p?.username ?? handle}</div>
            <div style={{ fontSize: 34, opacity: 0.75, marginTop: 8 }}>@{p?.handle ?? handle}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", maxWidth: 700 }}>
            {(p?.gameProfiles ?? []).map((g) => (
              <div key={g.id} style={{ display: "flex", padding: "10px 20px", fontSize: 26, background: "rgba(10,8,20,0.55)", borderRadius: 8 }}>
                {g.game.name}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 36, fontSize: 28 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ fontSize: 56, fontWeight: 700 }}>{points}</div>
              <div style={{ opacity: 0.7 }}>bodů</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ fontSize: 56, fontWeight: 700 }}>{matches ? Math.round((wins / matches) * 100) : 0} %</div>
              <div style={{ opacity: 0.7 }}>výher</div>
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
