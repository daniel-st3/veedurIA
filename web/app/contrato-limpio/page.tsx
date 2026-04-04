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
  searchParams: Promise<{
    lang?: string;
    dept?: string;
    risk?: string;
    modality?: string;
    q?: string;
    from?: string;
    to?: string;
    full?: string;
  }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const initialFilters = {
    department: params.dept || undefined,
    risk: params.risk === "high" || params.risk === "medium" || params.risk === "low" ? params.risk : "all",
    modality: params.modality || undefined,
    query: params.q || "",
    dateFrom: params.from || "",
    dateTo: params.to || "",
    full: params.full === "1" || params.full === "true",
  } as const;
  
  const [overview, table, geojson] = await Promise.all([
    fetchOverview({ lang, ...initialFilters }).catch(() => null),
    fetchContractsTable({ lang, ...initialFilters, offset: 0, limit: 24 }).catch(() => null),
    fetchGeoJson().catch(() => null),
  ]);

  return (
    <ContractsView
      lang={lang}
      initialOverview={overview}
      initialTable={table}
      initialGeojson={geojson}
      initialFilters={{ ...initialFilters }}
    />
  );
}
