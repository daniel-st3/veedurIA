import { ContractsView } from "@/components/contracts-view";
import { fetchContractsTable, fetchGeoJson, fetchOverview } from "@/lib/api";
import { resolveLang } from "@/lib/copy";

export default async function ContratoLimpioPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  
  const [overview, table, geojson] = await Promise.all([
    fetchOverview({ lang, full: false }).catch(() => null),
    fetchContractsTable({ lang, full: false, offset: 0, limit: 24 }).catch(() => null),
    fetchGeoJson().catch(() => null),
  ]);

  return <ContractsView lang={lang} initialOverview={overview} initialTable={table} initialGeojson={geojson} />;
}
