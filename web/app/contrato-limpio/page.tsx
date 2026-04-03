import { ContractsView } from "@/components/contracts-view";
import { resolveLang } from "@/lib/copy";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export default async function ContratoLimpioPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const [overviewRes, tableRes, geojsonRes] = await Promise.all([
    fetch(`${API_BASE}/contracts/overview?lang=${lang}&full=false`, { cache: "no-store" }).catch(() => null),
    fetch(`${API_BASE}/contracts/table?lang=${lang}&full=false&offset=0&limit=24`, { cache: "no-store" }).catch(() => null),
    fetch(`${API_BASE}/contracts/geojson`, { cache: "force-cache" }).catch(() => null),
  ]);
  const initialOverview = overviewRes && overviewRes.ok ? await overviewRes.json() : null;
  const initialTable = tableRes && tableRes.ok ? await tableRes.json() : null;
  const initialGeojson = geojsonRes && geojsonRes.ok ? await geojsonRes.json() : null;
  return (
    <ContractsView
      lang={lang}
      initialOverview={initialOverview}
      initialTable={initialTable}
      initialGeojson={initialGeojson}
    />
  );
}
