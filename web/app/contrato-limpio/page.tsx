import { ContractsView } from "@/components/contracts-view";
import { fetchContractsTable, fetchGeoJson, fetchOverview } from "@/lib/api";
import { resolveLang } from "@/lib/copy";
import { buildPageMetadata } from "@/lib/metadata";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  return buildPageMetadata({
    lang,
    path: `/contrato-limpio?lang=${lang}`,
    title: lang === "es" ? "ContratoLimpio — VeedurIA" : "ContratoLimpio — VeedurIA",
    description:
      lang === "es"
        ? "Filtra contratos públicos, revisa señales de riesgo y abre evidencia oficial en SECOP II."
        : "Filter public contracts, review risk signals, and open official evidence in SECOP II.",
    imagePath: "/contrato-limpio/opengraph-image",
  });
}

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
