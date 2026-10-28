/** Logo týmu, nebo zkratka v seříznutém štítku, když logo chybí. */
export default function TeamMark({ name, logo, size = 40 }: { name: string; logo?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  const style = { width: size, height: size };
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" style={style} className="shrink-0 object-contain" loading="lazy" />;
  }
  return (
    <span
      style={{ ...style, clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)" }}
      className="num flex shrink-0 items-center justify-center bg-ink-600 text-xs font-bold text-bone/80"
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
