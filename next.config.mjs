/** @type {import('next').NextConfig} */
const immutable = [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }];

const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  compress: true,
  poweredByHeader: false,
  async headers() {
    // Obrázky peta a ostatní statické soubory se neposílají znovu při každém zobrazení.
    return [
      { source: "/pets/:path*", headers: immutable },
      { source: "/brand/:path*", headers: immutable },
      { source: "/games/:path*", headers: immutable },
      { source: "/hero.jpg", headers: immutable },
    ];
  },
};

export default nextConfig;
