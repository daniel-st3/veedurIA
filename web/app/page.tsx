import { LandingPage } from "@/components/landing-page";
import { fetchOverview } from "@/lib/api";
import { resolveLang } from "@/lib/copy";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const overview = await fetchOverview({ lang, full: false });
  return <LandingPage lang={lang} initialOverview={overview} />;
}
