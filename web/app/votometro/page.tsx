import { VotometroDirectoryPage } from "@/components/votometro/directory-page";
import { VotometroFallback } from "@/components/votometro/fallback-wrapper";
import { resolveLang } from "@/lib/copy";
import { buildPageMetadata } from "@/lib/metadata";
import type { LegislatorListItem, PartySummary } from "@/lib/votometro-types";
import { getPartySummariesPayload, getVotometroDirectory } from "@/lib/votometro-server";

export const dynamic = "force-dynamic";

// If the server fetches take longer than this, render with empty data and show fallback.
const SERVER_FETCH_TIMEOUT_MS = 2000;

function raceTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race<T>([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), SERVER_FETCH_TIMEOUT_MS)),
  ]);
}

function derivePartySummaries(items: LegislatorListItem[]): PartySummary[] {
  const groups = new Map<
    string,
    {
      partyKey: string;
      party: string;
      memberCount: number;
      indexedVotes: number;
      attendanceValues: number[];
      coherenceValues: number[];
    }
  >();

  for (const item of items) {
    const current = groups.get(item.partyKey) ?? {
      partyKey: item.partyKey,
      party: item.party,
      memberCount: 0,
      indexedVotes: 0,
      attendanceValues: [],
      coherenceValues: [],
    };
    current.memberCount += 1;
    current.indexedVotes += item.votesIndexed;
    if (typeof item.attendanceRate === "number") current.attendanceValues.push(item.attendanceRate);
    if (typeof item.coherenceScore === "number") current.coherenceValues.push(item.coherenceScore);
    groups.set(item.partyKey, current);
  }

  return [...groups.values()]
    .map((party) => ({
      partyKey: party.partyKey,
      party: party.party,
      chamber: "",
      memberCount: party.memberCount,
      activeMembers: party.memberCount,
      indexedVotes: party.indexedVotes,
      attendanceRate: party.attendanceValues.length
        ? Math.round(
            party.attendanceValues.reduce((sum, value) => sum + value, 0) / party.attendanceValues.length,
          )
        : null,
      coherenceScore: party.coherenceValues.length
        ? Math.round(
            party.coherenceValues.reduce((sum, value) => sum + value, 0) / party.coherenceValues.length,
          )
        : null,
      approvedPromiseMatches: 0,
      topicScores: [],
    }))
    .sort((left, right) => right.memberCount - left.memberCount || left.party.localeCompare(right.party, "es-CO"));
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const lang = resolveLang(Array.isArray(params.lang) ? params.lang[0] : params.lang);

  return buildPageMetadata({
    lang,
    path: `/votometro?lang=${lang}`,
    title: lang === "es" ? "Votómetro — VeedurIA" : "Votometer — VeedurIA",
    description:
      lang === "es"
        ? "Directorio vivo de legisladores colombianos con votos, asistencia y coherencia visible solo cuando hay promesas revisadas."
        : "Live directory of Colombian legislators with votes, attendance, and coherence shown only when reviewed promises exist.",
    imagePath: "/votometro/opengraph-image",
  });
}

export default async function VotometroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const lang = resolveLang(Array.isArray(params.lang) ? params.lang[0] : params.lang);
  const emptyPayload = {
    meta: { total: 0, page: 1, pageSize: 24, pageCount: 1, activeLegislators: 0, indexedVotes: 0, averageCoherence: null, generatedAt: new Date().toISOString() },
    issue: null,
    filters: { page: 1, pageSize: 24 },
    options: { parties: [], circunscriptions: [], commissions: [] },
    items: [],
  } as Awaited<ReturnType<typeof getVotometroDirectory>>;

  // Run both data fetches in parallel with a timeout so navigation is never blocked.
  const [payload, partyPayload] = await Promise.all([
    raceTimeout(getVotometroDirectory(params), emptyPayload),
    getPartySummariesPayload().catch(() => ({ items: [] as PartySummary[] })),
  ]);

  const forceLive =
    (Array.isArray(params.force_live) ? params.force_live[0] : params.force_live) === "1";
  const hasMeaningfulLiveCoverage =
    !payload.issue &&
    payload.items.some(
      (item) =>
        item.votesIndexed > 0 ||
        item.attendanceRate != null ||
        item.coherenceScore != null ||
        item.topTopics.length > 0 ||
        item.topicScores.length > 0,
    );

  let parties = derivePartySummaries(payload.items);
  if (partyPayload.items.length) {
    parties = partyPayload.items;
  }

  if (!forceLive && !hasMeaningfulLiveCoverage) {
    return <VotometroFallback lang={lang} />;
  }

  return <VotometroDirectoryPage lang={lang} payload={payload} parties={parties} />;
}
