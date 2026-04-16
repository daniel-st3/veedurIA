import {
  createServerSupabase,
  createServiceSupabase,
} from "@/lib/supabase-server";
import {
  getTopicLabel,
  VOTOMETRO_TOPICS,
  type VotometroTopicKey,
} from "@/lib/votometro-topics";
import type {
  AttendanceSummary,
  IdentityConflictRecord,
  LegislatorListItem,
  LegislatorProfile,
  PartySummary,
  PromiseReviewRecord,
  PromiseReviewSummary,
  TopicScore,
  VotometroChamber,
  VotometroDirectoryPayload,
  VotometroFilters,
  VotometroVotesPayload,
  VoteEventDetail,
} from "@/lib/votometro-types";

const DEFAULT_PAGE_SIZE = 24;
const DEFAULT_VOTES_PAGE_SIZE = 20;
const MAX_DIRECTORY_FETCH = 500;

type SearchParamInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

type DirectoryRow = Record<string, unknown>;
type VoteRow = Record<string, unknown>;

function getDataSupabase() {
  try {
    return createServiceSupabase();
  } catch {
    return createServerSupabase();
  }
}

function readSearchParam(input: SearchParamInput, key: string) {
  if (input instanceof URLSearchParams) return input.get(key) ?? undefined;
  const value = input[key];
  return Array.isArray(value) ? value[0] : value;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseTopicScores(value: unknown): TopicScore[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      return {
        key: toStringValue(item.key),
        label: toStringValue(item.label) || getTopicLabel(toStringValue(item.key)),
        score: toNumber(item.score),
        votes: toNumber(item.votes) ?? 0,
      } satisfies TopicScore;
    })
    .filter((entry): entry is TopicScore => Boolean(entry?.key));
}

function parseTopTopics(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object") {
        return toStringValue((entry as Record<string, unknown>).label);
      }
      return "";
    })
    .filter(Boolean);
}

function chamberLabel(chamber: string): string {
  return chamber === "camara" ? "Cámara de Representantes" : "Senado";
}

function itemFromDirectoryRow(row: DirectoryRow): LegislatorListItem {
  const chamber = (toStringValue(row.chamber) || "senado") as VotometroChamber;
  return {
    id: toStringValue(row.id),
    slug: toStringValue(row.slug),
    canonicalName: toStringValue(row.canonical_name),
    normalizedName: toStringValue(row.normalized_name),
    initials: toStringValue(row.initials) || "NN",
    chamber,
    chamberLabel: chamberLabel(chamber),
    party: toStringValue(row.party) || "Sin partido visible",
    partyKey: toStringValue(row.party_key) || "sin-partido",
    roleLabel: toStringValue(row.role_label) || (chamber === "camara" ? "Representante" : "Senador"),
    commission: toStringValue(row.commission),
    circunscription: toStringValue(row.circunscription),
    email: toStringValue(row.email),
    phone: toStringValue(row.phone),
    office: toStringValue(row.office),
    imageUrl: toStringValue(row.image_url),
    bio: toStringValue(row.bio),
    sourcePrimary: toStringValue(row.source_primary),
    sourceRef: toStringValue(row.source_ref),
    sourceUpdatedAt: toStringValue(row.source_updated_at) || null,
    votesIndexed: toNumber(row.votes_indexed) ?? 0,
    attendanceSessions: toNumber(row.attendance_sessions) ?? 0,
    attendedSessions: toNumber(row.attended_sessions) ?? 0,
    attendanceRate: toNumber(row.attendance_rate),
    approvedPromiseMatches: toNumber(row.approved_promise_matches) ?? 0,
    coherentVotes: toNumber(row.coherent_votes) ?? 0,
    inconsistentVotes: toNumber(row.inconsistent_votes) ?? 0,
    absentVotes: toNumber(row.absent_votes) ?? 0,
    coherenceScore: toNumber(row.coherence_score),
    topTopics: parseTopTopics(row.top_topics),
    topicScores: parseTopicScores(row.topic_scores),
    updatedAt: toStringValue(row.updated_at) || null,
  };
}

function voteFromRow(row: VoteRow): VoteEventDetail {
  return {
    id: toStringValue(row.id),
    voteEventId: toStringValue(row.vote_event_id),
    projectId: toStringValue(row.project_id) || null,
    title: toStringValue(row.project_title) || "Votación sin título visible",
    description: toStringValue(row.project_description),
    topicKey: toStringValue(row.topic_key) || null,
    topicLabel: toStringValue(row.topic_label) || getTopicLabel(toStringValue(row.topic_key)),
    voteDate: toStringValue(row.vote_date),
    voteValue: toStringValue(row.vote_value) || "Sin dato",
    resultText: toStringValue(row.result_text),
    promiseAlignment:
      (toStringValue(row.promise_alignment) as VoteEventDetail["promiseAlignment"]) || "sin-promesa",
    sourceUrl: toStringValue(row.source_url),
    projectSourceUrl: toStringValue(row.project_source_url),
    sessionLabel: toStringValue(row.session_label),
    isAbsent: Boolean(row.is_absent),
    deviatesFromParty: Boolean(row.deviates_from_party),
  };
}

function emptyDirectory(filters: VotometroFilters): VotometroDirectoryPayload {
  return {
    meta: {
      total: 0,
      page: filters.page,
      pageSize: filters.pageSize,
      pageCount: 1,
      activeLegislators: 0,
      indexedVotes: 0,
      averageCoherence: null,
      generatedAt: new Date().toISOString(),
    },
    filters,
    options: {
      parties: [],
      circunscriptions: [],
      commissions: [],
    },
    items: [],
  };
}

export function parseVotometroFilters(input: SearchParamInput): VotometroFilters {
  const chamber = readSearchParam(input, "chamber");
  const attendanceMin = toNumber(readSearchParam(input, "attendance_min"));
  const coherenceMin = toNumber(readSearchParam(input, "coherence_min"));
  const page = Math.max(1, toNumber(readSearchParam(input, "page")) ?? 1);
  const pageSize = Math.min(100, Math.max(1, toNumber(readSearchParam(input, "page_size")) ?? DEFAULT_PAGE_SIZE));
  return {
    chamber: chamber === "senado" || chamber === "camara" ? chamber : undefined,
    party: toStringValue(readSearchParam(input, "party")) || undefined,
    circunscription: toStringValue(readSearchParam(input, "circunscription")) || undefined,
    commission: toStringValue(readSearchParam(input, "commission")) || undefined,
    topic: toStringValue(readSearchParam(input, "topic")) || undefined,
    attendanceMin: attendanceMin ?? undefined,
    coherenceMin: coherenceMin ?? undefined,
    page,
    pageSize,
  };
}

export async function getVotometroDirectory(filtersInput: SearchParamInput | VotometroFilters) {
  const filters: VotometroFilters =
    filtersInput instanceof URLSearchParams || typeof (filtersInput as Partial<VotometroFilters>).page !== "number"
      ? parseVotometroFilters(filtersInput as SearchParamInput)
      : (filtersInput as VotometroFilters);

  try {
    const supabase = getDataSupabase();
    let query = supabase
      .from("votometro_directory_public")
      .select("*")
      .order("canonical_name", { ascending: true })
      .limit(MAX_DIRECTORY_FETCH);

    if (filters.chamber) query = query.eq("chamber", filters.chamber);
    if (filters.party) query = query.eq("party", filters.party);

    const { data, error } = await query;
    if (error || !data) return emptyDirectory(filters);

    const items = (data as DirectoryRow[]).map(itemFromDirectoryRow);
    const optionsSource = [...items];

    const filtered = items
      .filter((item) =>
        !filters.circunscription ||
        item.circunscription.toLocaleLowerCase("es-CO").includes(filters.circunscription.toLocaleLowerCase("es-CO")),
      )
      .filter((item) =>
        !filters.commission ||
        item.commission.toLocaleLowerCase("es-CO").includes(filters.commission.toLocaleLowerCase("es-CO")),
      )
      .filter((item) => filters.attendanceMin == null || (item.attendanceRate ?? -1) >= filters.attendanceMin)
      .filter((item) => filters.coherenceMin == null || (item.coherenceScore ?? -1) >= filters.coherenceMin)
      .filter((item) => {
        if (!filters.topic) return true;
        return item.topicScores.some((score) => score.key === filters.topic) || item.topTopics.includes(getTopicLabel(filters.topic));
      })
      .sort((a, b) => {
        const coherenceA = a.coherenceScore ?? -1;
        const coherenceB = b.coherenceScore ?? -1;
        if (coherenceB !== coherenceA) return coherenceB - coherenceA;
        const attendanceA = a.attendanceRate ?? -1;
        const attendanceB = b.attendanceRate ?? -1;
        if (attendanceB !== attendanceA) return attendanceB - attendanceA;
        return b.votesIndexed - a.votesIndexed || a.canonicalName.localeCompare(b.canonicalName, "es-CO");
      });

    const total = filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
    const safePage = Math.min(filters.page, pageCount);
    const start = (safePage - 1) * filters.pageSize;
    const paged = filtered.slice(start, start + filters.pageSize);

    const coherenceValues = filtered
      .map((item) => item.coherenceScore)
      .filter((value): value is number => typeof value === "number");

    return {
      meta: {
        total,
        page: safePage,
        pageSize: filters.pageSize,
        pageCount,
        activeLegislators: filtered.length,
        indexedVotes: filtered.reduce((sum, item) => sum + item.votesIndexed, 0),
        averageCoherence: coherenceValues.length
          ? Math.round(coherenceValues.reduce((sum, value) => sum + value, 0) / coherenceValues.length)
          : null,
        generatedAt: new Date().toISOString(),
      },
      filters: { ...filters, page: safePage },
      options: {
        parties: [...new Set(optionsSource.map((item) => item.party).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es-CO")),
        circunscriptions: [...new Set(optionsSource.map((item) => item.circunscription).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es-CO")),
        commissions: [...new Set(optionsSource.map((item) => item.commission).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es-CO")),
      },
      items: paged,
    } satisfies VotometroDirectoryPayload;
  } catch {
    return emptyDirectory(filters);
  }
}

export async function getVotometroProfile(slug: string): Promise<LegislatorProfile | null> {
  try {
    const supabase = getDataSupabase();
    const { data: profileRow, error: profileError } = await supabase
      .from("votometro_directory_public")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (profileError || !profileRow) return null;

    const item = itemFromDirectoryRow(profileRow as DirectoryRow);

    const [{ data: socials }, { data: promises }] = await Promise.all([
      supabase
        .from("legislator_socials")
        .select("network, handle, url")
        .eq("legislator_id", item.id)
        .order("network", { ascending: true }),
      supabase
        .from("votometro_approved_promises_public")
        .select("*")
        .eq("legislator_id", item.id)
        .order("source_date", { ascending: false })
        .limit(12),
    ]);

    const votes = await getVotometroVotes({ legislatorId: item.id, page: 1, pageSize: DEFAULT_VOTES_PAGE_SIZE });

    const attendance: AttendanceSummary = {
      sessions: item.attendanceSessions,
      attended: item.attendedSessions,
      rate: item.attendanceRate,
    };

    const promiseItems: PromiseReviewSummary[] = Array.isArray(promises)
      ? (promises as Record<string, unknown>[]).map((promise) => ({
          id: toStringValue(promise.id),
          claimText: toStringValue(promise.claim_text),
          sourceUrl: toStringValue(promise.source_url),
          sourceLabel: toStringValue(promise.source_label),
          sourceDate: toStringValue(promise.source_date) || null,
          topicKey: toStringValue(promise.topic_key) || null,
          topicLabel: toStringValue(promise.topic_label) || getTopicLabel(toStringValue(promise.topic_key)),
          stance: toStringValue(promise.stance) || "indeterminado",
          extractionConfidence: toNumber(promise.extraction_confidence),
          reviewNote: toStringValue(promise.review_note),
          reviewedAt: toStringValue(promise.reviewed_at) || null,
        }))
      : [];

    return {
      ...item,
      attendance,
      socials: Array.isArray(socials)
        ? (socials as Record<string, unknown>[]).map((social) => ({
            network: toStringValue(social.network),
            handle: toStringValue(social.handle),
            url: toStringValue(social.url),
          }))
        : [],
      promises: promiseItems,
      recentVotes: votes.items,
    };
  } catch {
    return null;
  }
}

export async function getVotometroVotes({
  slug,
  legislatorId,
  topic,
  page = 1,
  pageSize = DEFAULT_VOTES_PAGE_SIZE,
}: {
  slug?: string;
  legislatorId?: string;
  topic?: string;
  page?: number;
  pageSize?: number;
}): Promise<VotometroVotesPayload> {
  try {
    const supabase = getDataSupabase();
    let resolvedLegislatorId = legislatorId;
    if (!resolvedLegislatorId && slug) {
      const { data } = await supabase
        .from("votometro_directory_public")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      resolvedLegislatorId = toStringValue((data as Record<string, unknown> | null)?.id);
    }

    let query = supabase
      .from("votometro_vote_records_public")
      .select("*", { count: "exact" })
      .order("vote_date", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (resolvedLegislatorId) query = query.eq("legislator_id", resolvedLegislatorId);
    if (topic) query = query.eq("topic_key", topic);

    const { data, error, count } = await query;
    if (error || !data) {
      return {
        meta: { total: 0, page, pageSize, generatedAt: new Date().toISOString() },
        items: [],
      };
    }

    return {
      meta: {
        total: count ?? data.length,
        page,
        pageSize,
        generatedAt: new Date().toISOString(),
      },
      items: (data as VoteRow[]).map(voteFromRow),
    };
  } catch {
    return {
      meta: { total: 0, page, pageSize, generatedAt: new Date().toISOString() },
      items: [],
    };
  }
}

export async function getPartySummaries(chamber?: VotometroChamber): Promise<PartySummary[]> {
  try {
    const supabase = getDataSupabase();
    let query = supabase.from("party_metrics_current").select("*").order("member_count", { ascending: false });
    if (chamber) query = query.eq("chamber", chamber);
    const { data, error } = await query;
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((row) => ({
      partyKey: toStringValue(row.party_key),
      party: toStringValue(row.party),
      chamber: toStringValue(row.chamber),
      memberCount: toNumber(row.member_count) ?? 0,
      activeMembers: toNumber(row.active_members) ?? 0,
      indexedVotes: toNumber(row.indexed_votes) ?? 0,
      attendanceRate: toNumber(row.attendance_rate),
      coherenceScore: toNumber(row.coherence_score),
      approvedPromiseMatches: toNumber(row.approved_promise_matches) ?? 0,
      topicScores: parseTopicScores(row.topic_scores),
    }));
  } catch {
    return [];
  }
}

export function getTopicOptions() {
  return VOTOMETRO_TOPICS;
}

export async function getReviewDashboard() {
  const supabase = createServiceSupabase();

  const [{ data: legislators }, { data: claims }, { data: reviews }, { data: conflicts }, { data: runs }] =
    await Promise.all([
      supabase.from("legislators").select("id, canonical_name"),
      supabase
        .from("promise_claims")
        .select("id, legislator_id, claim_text, source_label, source_date, topic_label")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("promise_reviews")
        .select("promise_claim_id, status, review_note")
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("identity_conflicts")
        .select("*")
        .order("confidence", { ascending: false })
        .limit(50),
      supabase
        .from("ingestion_runs")
        .select("id, job_name, mode, source_system, status, started_at, finished_at, rows_in, rows_out, replace_public, warnings")
        .order("started_at", { ascending: false })
        .limit(20),
    ]);

  const legislatorNameById = new Map<string, string>(
    (legislators as Record<string, unknown>[] | null)?.map((row) => [toStringValue(row.id), toStringValue(row.canonical_name)]) ?? [],
  );

  const reviewByClaimId = new Map<string, Record<string, unknown>>(
    (reviews as Record<string, unknown>[] | null)?.map((row) => [toStringValue(row.promise_claim_id), row]) ?? [],
  );

  const promiseQueue: PromiseReviewRecord[] = (claims as Record<string, unknown>[] | null)?.map((claim) => {
    const review = reviewByClaimId.get(toStringValue(claim.id));
    return {
      id: toStringValue(claim.id),
      legislatorId: toStringValue(claim.legislator_id),
      legislatorName: legislatorNameById.get(toStringValue(claim.legislator_id)) ?? "Legislador sin nombre",
      topicLabel: toStringValue(claim.topic_label) || "Sin tema",
      sourceLabel: toStringValue(claim.source_label) || "Fuente pública",
      sourceDate: toStringValue(claim.source_date) || null,
      claimText: toStringValue(claim.claim_text),
      status: toStringValue(review?.status) || "pending",
      reviewNote: toStringValue(review?.review_note),
    };
  }) ?? [];

  const identityQueue: IdentityConflictRecord[] = (conflicts as Record<string, unknown>[] | null)?.map((conflict) => ({
    id: toStringValue(conflict.id),
    sourceSystem: toStringValue(conflict.source_system),
    chamber: toStringValue(conflict.chamber),
    candidateName: toStringValue(conflict.candidate_name),
    normalizedName: toStringValue(conflict.normalized_name),
    proposedLegislatorId: toStringValue(conflict.proposed_legislator_id) || null,
    confidence: toNumber(conflict.confidence),
    status: toStringValue(conflict.status),
    evidence:
      conflict.evidence && typeof conflict.evidence === "object"
        ? (conflict.evidence as Record<string, unknown>)
        : {},
    resolvedNote: toStringValue(conflict.resolved_note),
  })) ?? [];

  return {
    promiseQueue,
    identityQueue,
    runs: (runs as Record<string, unknown>[] | null) ?? [],
  };
}
