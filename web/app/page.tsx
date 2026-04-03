import { LandingPage } from "@/components/landing-page";
import { resolveLang } from "@/lib/copy";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const [overviewRes, geojsonRes] = await Promise.all([
    fetch(`${API_BASE}/contracts/overview?lang=${lang}&full=false`, { cache: "no-store" }).catch(() => null),
    fetch(`${API_BASE}/contracts/geojson`, { cache: "force-cache" }).catch(() => null),
  ]);
  const initialMeta = overviewRes && overviewRes.ok ? (await overviewRes.json()).meta : null;
  const initialGeojson = geojsonRes && geojsonRes.ok ? await geojsonRes.json() : null;
  return <LandingPage lang={lang} initialMeta={initialMeta} initialGeojson={initialGeojson} />;
}
