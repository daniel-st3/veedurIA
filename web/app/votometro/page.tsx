import { VotometroDirectoryPage } from "@/components/votometro/directory-page";
import { resolveLang } from "@/lib/copy";
import { buildPageMetadata } from "@/lib/metadata";
import type { PartySummary } from "@/lib/votometro-types";
import {
  getPartySummariesPayload,
  getVotometroDirectory,
  getVotometroVotes,
} from "@/lib/votometro-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SERVER_FETCH_TIMEOUT_MS = 4000;

function raceTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race<T>([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => resolve(fallback), SERVER_FETCH_TIMEOUT_MS),
    ),
  ]);
}

function derivePartySummaries(
  items: Awaited<ReturnType<typeof getVotometroDirectory>>["items"],
): PartySummary[] {
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
    if (typeof item.attendanceRate === "number")
      current.attendanceValues.push(item.attendanceRate);
    if (typeof item.coherenceScore === "number")
      current.coherenceValues.push(item.coherenceScore);
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
            party.attendanceValues.reduce((sum, value) => sum + value, 0) /
              party.attendanceValues.length,
          )
        : null,
      coherenceScore: party.coherenceValues.length
        ? Math.round(
            party.coherenceValues.reduce((sum, value) => sum + value, 0) /
              party.coherenceValues.length,
          )
        : null,
      approvedPromiseMatches: 0,
      topicScores: [],
    }))
    .sort(
      (left, right) =>
        right.memberCount - left.memberCount ||
        left.party.localeCompare(right.party, "es-CO"),
    );
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    const params = await searchParams;
    const lang = resolveLang(
      Array.isArray(params.lang) ? params.lang[0] : params.lang,
    );

    return buildPageMetadata({
      lang,
      path: `/votometro?lang=${lang}`,
      title: lang === "es" ? "Votómetro — VeedurIA" : "Votometer — VeedurIA",
      description:
        lang === "es"
          ? "Directorio vivo de legisladores colombianos con votos, asistencia y coherencia — datos actualizados diariamente desde fuentes oficiales."
          : "Live directory of Colombian legislators with votes, attendance, and coherence — updated daily from official sources.",
      imagePath: "/votometro/opengraph-image",
    });
  } catch (err) {
    console.error("[votometro] generateMetadata failed", err);
    return { title: "Votómetro — VeedurIA" };
  }
}

export default async function VotometroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const lang = resolveLang(
    Array.isArray(params.lang) ? params.lang[0] : params.lang,
  );
  const requestedPageSize = Array.isArray(params.page_size)
    ? params.page_size[0]
    : params.page_size;
  const directoryParams = requestedPageSize
    ? params
    : { ...params, page_size: "200" };
  const emptyPayload = {
    meta: {
      total: 0,
      page: 1,
      pageSize: 200,
      pageCount: 1,
      activeLegislators: 0,
      indexedVotes: 0,
      averageCoherence: null,
      generatedAt: new Date().toISOString(),
    },
    issue: null,
    filters: { page: 1, pageSize: 200 },
    options: { parties: [], circunscriptions: [], commissions: [] },
    items: [],
  } as Awaited<ReturnType<typeof getVotometroDirectory>>;

  const emptyPartyPayload = {
    meta: { total: 0, generatedAt: new Date().toISOString() },
    issue: null,
    items: [] as PartySummary[],
  };

  const emptyVotesPayload = {
    meta: { total: 0, page: 1, pageSize: 50, generatedAt: new Date().toISOString() },
    issue: null,
    items: [] as Awaited<ReturnType<typeof getVotometroVotes>>["items"],
  };

  const [payload, partyPayload, votesPayload] = await Promise.all([
    raceTimeout(
      getVotometroDirectory(directoryParams).catch((err) => {
        console.error("[votometro] directory fetch failed", err);
        return emptyPayload;
      }),
      emptyPayload,
    ),
    raceTimeout(
      getPartySummariesPayload().catch(() => emptyPartyPayload),
      emptyPartyPayload,
    ),
    raceTimeout(
      getVotometroVotes({ page: 1, pageSize: 50 }).catch((err) => {
        console.error("[votometro] votes fetch failed", err);
        return emptyVotesPayload;
      }),
      emptyVotesPayload,
    ),
  ]);

  let parties = derivePartySummaries(payload.items);
  if (partyPayload.items.length) {
    parties = partyPayload.items;
  }

  return (
    <VotometroDirectoryPage
      lang={lang}
      payload={payload}
      parties={parties}
      recentVotes={votesPayload.items}
      totalPublicVotes={votesPayload.meta.total}
    />
  );
}
