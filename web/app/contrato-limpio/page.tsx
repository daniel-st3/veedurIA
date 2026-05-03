import { ContractsView } from "@/components/contracts-view";
import { deptGeoName } from "@/lib/colombia-departments";
import { fetchContractsTable, fetchGeoJson, fetchOverview } from "@/lib/api";
import { resolveLang } from "@/lib/copy";
import { buildPageMetadata } from "@/lib/metadata";
import {
  sanitizeContractOverviewForPublic,
  sanitizeContractsTableForPublic,
} from "@/lib/sanitize-public";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// If the API takes longer than this, render with null and let the client refetch.
// 4 s gives Supabase cold-starts room while keeping TTFB acceptable.
const SERVER_FETCH_TIMEOUT_MS = 4000;

function raceTimeout<T>(promise: Promise<T>): Promise<T | null> {
  return Promise.race<T | null>([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), SERVER_FETCH_TIMEOUT_MS)),
  ]);
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  try {
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
  } catch (err) {
    console.error("[contrato-limpio] generateMetadata failed", err);
    return { title: "ContratoLimpio — VeedurIA" };
  }
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
    department: params.dept ? deptGeoName(params.dept) : undefined,
    risk: params.risk === "high" || params.risk === "medium" || params.risk === "low" ? params.risk : "all",
    modality: params.modality || undefined,
    query: params.q || "",
    dateFrom: params.from || "",
    dateTo: params.to || "",
    full: params.full === "1" || params.full === "true",
  } as const;
  
  const [overview, table, geojson] = await Promise.all([
    raceTimeout(fetchOverview({ lang, ...initialFilters })).catch(() => null),
    raceTimeout(fetchContractsTable({ lang, ...initialFilters, offset: 0, limit: 24 })).catch(() => null),
    raceTimeout(fetchGeoJson()).catch(() => null),
  ]);

  return (
    <ContractsView
      lang={lang}
      initialOverview={overview ? sanitizeContractOverviewForPublic(overview) : null}
      initialTable={table ? sanitizeContractsTableForPublic(table) : null}
      initialGeojson={geojson}
      initialFilters={{ ...initialFilters }}
    />
  );
}
