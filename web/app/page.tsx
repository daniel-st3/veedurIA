import { NextRequest } from "next/server";

import { LandingPage } from "@/components/landing-page";
import { GET as getContractsOverview } from "@/app/api/contracts/overview/route";
import { resolveLang } from "@/lib/copy";
import { buildPageMetadata } from "@/lib/metadata";
import type { Lang, OverviewPayload } from "@/lib/types";
import { getVotometroDirectory } from "@/lib/votometro-server";
import type { VotometroLandingStats } from "@/lib/votometro-types";

const FCP_TIMEOUT_MS = 5000;

function emptyOverview(lang: Lang): OverviewPayload {
  return {
    meta: { lang, fullDataset: false, totalRows: 0, shownRows: 0, previewRows: 0,
      latestContractDate: null, sourceLatestContractDate: null, sourceFreshnessGapDays: null,
      sourceRows: null, sourceUpdatedAt: null, lastRunTs: null, dateRange: { from: null, to: null } },
    options: { departments: [], modalities: [] },
    map: { departments: [] },
    slice: { totalContracts: 0, redAlerts: 0, prioritizedValue: 0, prioritizedValueLabel: "—", dominantDepartment: "—" },
    benchmarks: { nationalMeanRisk: 0, sliceMeanRisk: 0, departmentMeanRisk: null, sliceMedianValue: 0 },
    leadCases: [],
    summaries: { entities: [], modalities: [] },
    analytics: { departments: [], modalities: [], entities: [], months: [], riskBands: [] },
    methodology: { modelType: "IsolationForest", nEstimators: 100, contamination: 0.05, nFeatures: 0,
      trainedAt: null, redThreshold: 0.7, yellowThreshold: 0.4 },
    liveFeed: { latestDate: null, rowsAtSource: null, contracts: [] },
  };
}

function emptyVotometroStats(): VotometroLandingStats {
  return {
    activeLegislators: null,
    indexedVotes: null,
    averageCoherence: null,
    available: false,
  };
}

async function fetchOverviewForHome(lang: Lang): Promise<OverviewPayload | null> {
  const response = await getContractsOverview(
    new NextRequest(`http://veeduria.local/api/contracts/overview?lang=${lang}`),
  );
  if (!response.ok) return null;
  return (await response.json()) as OverviewPayload;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  return buildPageMetadata({
    lang,
    path: `/?lang=${lang}`,
      title:
        lang === "es"
          ? "VeedurIA: radar ciudadano de contratos públicos"
          : "VeedurIA: citizen radar for public contracts",
    description:
      lang === "es"
        ? "Explora contratación pública, votaciones legislativas y redes de poder desde una sola plataforma cívica."
        : "Explore public procurement, legislative voting records, and power networks from one civic platform.",
    imagePath: "/opengraph-image",
  });
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);

  // Race the API against a timeout so a slow backend never delays the first byte.
  // The client-side refetch in LandingPage fills in real data after hydration.
  let overview: OverviewPayload | null = null;
  let votometroStats: VotometroLandingStats | null = null;
  try {
    const [overviewResult, votometroResult] = await Promise.all([
      Promise.race<OverviewPayload | null>([
        fetchOverviewForHome(lang),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), FCP_TIMEOUT_MS)),
      ]),
      Promise.race<Awaited<ReturnType<typeof getVotometroDirectory>> | null>([
        getVotometroDirectory({ page: "1", page_size: "1" }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), FCP_TIMEOUT_MS)),
      ]),
    ]);

    overview = overviewResult;
    votometroStats = votometroResult
      ? {
          activeLegislators: votometroResult.meta.activeLegislators,
          indexedVotes: votometroResult.meta.indexedVotes,
          averageCoherence: votometroResult.meta.averageCoherence,
          available: !votometroResult.issue,
        }
      : null;
  } catch {
    overview = null;
    votometroStats = null;
  }

  return (
    <LandingPage
      lang={lang}
      initialOverview={overview ?? emptyOverview(lang)}
      initialVotometroStats={votometroStats ?? emptyVotometroStats()}
    />
  );
}
