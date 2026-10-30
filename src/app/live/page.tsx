import { getT } from "@/lib/i18n";
import LiveCompanion from "@/components/LiveCompanion";

export const metadata = { title: "Live scouting" };

export default async function LivePage({ searchParams }: { searchParams: Promise<{ nodownload?: string }> }) {
  const { nodownload } = await searchParams;
  const { locale } = await getT();
  return <LiveCompanion locale={locale} noDownload={nodownload === "1"} />;
}
