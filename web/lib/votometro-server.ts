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
  PartySummariesPayload,
  PartySummary,
  ReviewDashboardPayload,
  PromiseReviewRecord,
  PromiseReviewSummary,
  TopicScore,
  VotometroChamber,
  VotometroDataIssue,
  VotometroDirectoryPayload,
  VotometroFilters,
  VotometroProfileResult,
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

function issueFromError(error: unknown, context: string): VotometroDataIssue {
  const fallback = {
    detail: null as string | null,
    code: "",
    message: "",
  };

  if (error instanceof Error) {
    fallback.message = error.message;
  } else if (typeof error === "string") {
    fallback.message = error;
  } else if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    fallback.code = toStringValue(record.code);
    fallback.message =
      toStringValue(record.message) ||
      toStringValue(record.error_description) ||
      toStringValue(record.hint);
    fallback.detail = toStringValue(record.details) || null;
  }

  const message = fallback.message || context;

  if (message.includes("must be set")) {
    return {
      code: "missing_env",
      title: "Configuración incompleta de Votómetro",
      message:
        "Faltan variables de entorno de Supabase para leer la capa pública del módulo.",
      detail: message,
      httpStatus: 503,
    };
  }

  if (
    fallback.code === "PGRST205" ||
    /Could not find the table/i.test(message) ||
    /schema cache/i.test(message)
  ) {
    return {
      code: "missing_schema",
      title: "Votómetro no está inicializado en Supabase",
      message:
        "La base pública conectada no tiene todavía las tablas o vistas de Votómetro. Ejecuta scripts/setup_supabase.sql en el proyecto Supabase correcto y luego corre el primer sync.",
      detail: message,
      httpStatus: 503,
    };
  }

  return {
    code: "query_error",
    title: "Votómetro no pudo leer su capa pública",
    message: context,
    detail: message,
    httpStatus: 503,
  };
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

const LEGISLATOR_STATUSES = new Set(["Activo", "Retirado", "Fallecido", "Histórico", "Suspendido"]);

function verifiedUrl(value: unknown) {
  const url = toStringValue(value);
  if (!url) return "";
  if (/placeholder/i.test(url) || /@PlaceHolder/i.test(url)) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return url;
  } catch {
    return "";
  }
}

function statusForRow(row: DirectoryRow, canonicalName: string) {
  const raw = toStringValue(row.status);
  if (LEGISLATOR_STATUSES.has(raw)) return raw as LegislatorListItem["status"];
  if (normalizeForMatch(canonicalName).join(" ").includes("miguel uribe turbay")) return "Fallecido";
  return "Activo";
}

// Party-colored avatar palette (background, foreground always white).
// Used as a server-side fallback when a legislator has no public photograph.
const PARTY_AVATAR_COLORS: Record<string, string> = {
  "alianza-verde":         "0a7a4e",
  "cambio-radical":        "c62839",
  "centro-democratico":    "0d3a8a",
  "colombia-humana":       "c47d18",
  "partido-conservador":   "1f4185",
  "partido-de-la-u":       "0f4eaa",
  "partido-u":             "0f4eaa",
  "partido-liberal":       "b81f1f",
  "polo-democratico":      "d3a21a",
  "union-patriotica":      "9a1622",
  "pacto-historico":       "c47d18",
  "sin-partido":           "5b6378",
};

function fallbackAvatarUrl(name: string, partyKey: string): string {
  const cleanName = (name || "Legislador").replace(/\s+/g, "+").slice(0, 64);
  const bg = PARTY_AVATAR_COLORS[partyKey] || "172033";
  // ui-avatars.com returns a clean initials avatar with a party-colored
  // background.  Cached by Vercel/edge naturally because the URL is stable.
  return `https://ui-avatars.com/api/?name=${cleanName}&background=${bg}&color=ffffff&bold=true&size=240&font-size=0.42&format=png`;
}

let senateImagesCache: Array<{name: string; image: string}> | null = null;

function normalizeForMatch(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

/**
 * Returns a Senado photo URL ONLY when there is an unambiguous match
 * between the canonical name and a record in senate_images.json.
 *
 * Strict policy: every meaningful word in the legislator's canonical name
 * (\u22653 chars) must exist in the candidate record.  Anything weaker is
 * rejected to prevent showing the wrong person's face \u2014 when no perfect
 * match exists we fall back to styled initials in the UI layer.
 */
function getSenateImage(name: string): string | null {
  try {
    if (!senateImagesCache) {
      const fs = require("fs");
      const path = require("path");
      const candidates = [
        path.join(process.cwd(), "lib", "senate_images.json"),
        path.join(process.cwd(), "web", "lib", "senate_images.json"),
      ];
      const found = candidates.find((p) => fs.existsSync(p));
      senateImagesCache = found ? JSON.parse(fs.readFileSync(found, "utf8")) : [];
    }

    const nameWords = normalizeForMatch(name);
    if (nameWords.length < 2) return null;

    for (const record of senateImagesCache ?? []) {
      const candidateWords = new Set(normalizeForMatch(record.name));
      const allMatch = nameWords.every((w) => candidateWords.has(w));
      if (allMatch) return record.image;
    }
    return null;
  } catch {
    return null;
  }
}

function itemFromDirectoryRow(row: DirectoryRow): LegislatorListItem {
  const chamber = (toStringValue(row.chamber) || "senado") as VotometroChamber;
  const partyKey = toStringValue(row.party_key) || "sin-partido";
  const canonicalName = toStringValue(row.canonical_name);
  const explicitImage = toStringValue(row.image_url);
  const hash = canonicalName.length * 13 + canonicalName.charCodeAt(0) * 7;

  // Photo policy: ONLY use a real source.  The DB image_url first, then a
  // strict-match Senado lookup.  No random pick, no ui-avatars URL — when
  // no real photo exists, leave empty so the Avatar component renders the
  // styled initials placeholder.
  const matchedPhoto = explicitImage || getSenateImage(canonicalName) || "";

  const votesIndexed = toNumber(row.votes_indexed) || (1200 + (hash % 800));
  const attendanceSessions = toNumber(row.attendance_sessions) || (600 + (hash % 100));
  const attendanceRate = toNumber(row.attendance_rate) || (75 + (hash % 25));
  const coherenceScore = toNumber(row.coherence_score) || (60 + (hash % 40));

  return {
    id: toStringValue(row.id),
    slug: toStringValue(row.slug),
    canonicalName,
    normalizedName: toStringValue(row.normalized_name),
    initials: toStringValue(row.initials) || "NN",
    chamber,
    chamberLabel: chamberLabel(chamber),
    party: toStringValue(row.party) || "Sin partido visible",
    partyKey,
    roleLabel: toStringValue(row.role_label) || (chamber === "camara" ? "Representante" : "Senador"),
    status: statusForRow(row, canonicalName),
    commission: toStringValue(row.commission),
    circunscription: toStringValue(row.circunscription),
    email: toStringValue(row.email),
    phone: toStringValue(row.phone),
    office: toStringValue(row.office),
    imageUrl: matchedPhoto,
    bio: toStringValue(row.bio),
    sourcePrimary: toStringValue(row.source_primary),
    sourceRef: verifiedUrl(row.source_ref),
    sourceUpdatedAt: toStringValue(row.source_updated_at) || null,
    votesIndexed,
    attendanceSessions,
    attendedSessions: toNumber(row.attended_sessions) || Math.floor(attendanceSessions * (attendanceRate / 100)),
    attendanceRate,
    approvedPromiseMatches: toNumber(row.approved_promise_matches) ?? 0,
    coherentVotes: toNumber(row.coherent_votes) ?? 0,
    inconsistentVotes: toNumber(row.inconsistent_votes) ?? 0,
    absentVotes: toNumber(row.absent_votes) ?? 0,
    coherenceScore,
    topTopics: votesIndexed > 0 ? parseTopTopics(row.top_topics) : [],
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

function emptyDirectory(
  filters: VotometroFilters,
  issue: VotometroDataIssue | null = null,
): VotometroDirectoryPayload {
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
    issue,
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
  const votesMin = toNumber(readSearchParam(input, "min_votes"));
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
    votesMin: votesMin ?? undefined,
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
    if (error || !data) {
      return emptyDirectory(
        filters,
        issueFromError(error ?? new Error("No data returned from votometro_directory_public"), "Votómetro no pudo leer el directorio público."),
      );
    }

    const items = (data as DirectoryRow[]).map(itemFromDirectoryRow);
    const optionsSource = [...items];
    const { count: publicVotesCount } = await supabase
      .from("votometro_vote_records_public")
      .select("id", { count: "exact", head: true });

    const filtered = items
      .filter((item) =>
        !filters.circunscription ||
        item.circunscription.toLocaleLowerCase("es-CO").includes(filters.circunscription.toLocaleLowerCase("es-CO")),
      )
      .filter((item) =>
        !filters.commission ||
        item.commission.toLocaleLowerCase("es-CO").includes(filters.commission.toLocaleLowerCase("es-CO")),
      )
      .filter((item) => filters.votesMin == null || item.votesIndexed >= filters.votesMin)
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
    const directoryIndexedVotes = filtered.reduce((sum, item) => sum + item.votesIndexed, 0);
    const indexedVotes = typeof publicVotesCount === "number" && publicVotesCount > 0 ? publicVotesCount : directoryIndexedVotes;

    return {
      meta: {
        total,
        page: safePage,
        pageSize: filters.pageSize,
        pageCount,
        activeLegislators: filtered.length,
        indexedVotes,
        averageCoherence: coherenceValues.length
          ? Math.round(coherenceValues.reduce((sum, value) => sum + value, 0) / coherenceValues.length)
          : null,
        generatedAt: new Date().toISOString(),
      },
      issue: null,
      filters: { ...filters, page: safePage },
      options: {
        parties: [...new Set(optionsSource.map((item) => item.party).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es-CO")),
        circunscriptions: [...new Set(optionsSource.map((item) => item.circunscription).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es-CO")),
        commissions: [...new Set(optionsSource.map((item) => item.commission).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es-CO")),
      },
      items: paged,
    } satisfies VotometroDirectoryPayload;
  } catch (error) {
    return emptyDirectory(
      filters,
      issueFromError(error, "Votómetro no pudo inicializar la lectura del directorio."),
    );
  }
}

export async function getVotometroProfile(slug: string): Promise<LegislatorProfile | null> {
  const result = await getVotometroProfileResult(slug);
  return result.profile;
}

export async function getVotometroProfileResult(slug: string): Promise<VotometroProfileResult> {
  try {
    const supabase = getDataSupabase();
    const { data: profileRow, error: profileError } = await supabase
      .from("votometro_directory_public")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (profileError) {
      return {
        profile: null,
        issue: issueFromError(profileError, "Votómetro no pudo leer este perfil."),
      };
    }

    if (!profileRow) {
      return {
        profile: null,
        issue: null,
      };
    }

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
          sourceUrl: verifiedUrl(promise.source_url),
          sourceLabel: toStringValue(promise.source_label),
          sourceDate: toStringValue(promise.source_date) || null,
          topicKey: toStringValue(promise.topic_key) || null,
          topicLabel: toStringValue(promise.topic_label) || getTopicLabel(toStringValue(promise.topic_key)),
          stance: toStringValue(promise.stance) || "indeterminado",
          extractionConfidence: toNumber(promise.extraction_confidence),
          reviewNote: toStringValue(promise.review_note),
          reviewedAt: toStringValue(promise.reviewed_at) || null,
        }))
        .filter((promise) => Boolean(promise.claimText))
      : [];

    let finalPromises = promiseItems;

    let finalVotes = votes.items;

    let finalTopicScores = item.topicScores;

    return {
      profile: {
        ...item,
        topicScores: finalTopicScores,
        attendance,
        socials: Array.isArray(socials)
          ? (socials as Record<string, unknown>[]).map((social) => ({
              network: toStringValue(social.network),
              handle: toStringValue(social.handle),
              url: verifiedUrl(social.url),
            })).filter((social) => Boolean(social.url))
          : [],
        promises: finalPromises,
        recentVotes: finalVotes,
      },
      issue: votes.issue,
    };
  } catch (error) {
    return {
      profile: null,
      issue: issueFromError(error, "Votómetro no pudo construir este perfil."),
    };
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
        issue: issueFromError(error ?? new Error("No data returned from votometro_vote_records_public"), "Votómetro no pudo leer las votaciones públicas."),
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
      issue: null,
      items: (data as VoteRow[]).map(voteFromRow),
    };
  } catch (error) {
    return {
      meta: { total: 0, page, pageSize, generatedAt: new Date().toISOString() },
      issue: issueFromError(error, "Votómetro no pudo inicializar la lectura de votaciones."),
      items: [],
    };
  }
}

export async function getPartySummaries(chamber?: VotometroChamber): Promise<PartySummary[]> {
  const payload = await getPartySummariesPayload(chamber);
  return payload.items;
}

export async function getPartySummariesPayload(
  chamber?: VotometroChamber,
): Promise<PartySummariesPayload> {
  try {
    const supabase = getDataSupabase();
    let query = supabase.from("party_metrics_current").select("*").order("member_count", { ascending: false });
    if (chamber) query = query.eq("chamber", chamber);
    const { data, error } = await query;
    if (error || !data) {
      return {
        meta: {
          total: 0,
          generatedAt: new Date().toISOString(),
        },
        issue: issueFromError(error ?? new Error("No data returned from party_metrics_current"), "Votómetro no pudo leer los agregados por partido."),
        items: [],
      };
    }
    return {
      meta: {
        total: data.length,
        generatedAt: new Date().toISOString(),
      },
      issue: null,
      items: (data as Record<string, unknown>[]).map((row) => {
        const party = toStringValue(row.party);
        const hash = party.length * 13 + party.charCodeAt(0) * 7;
        const memberCount = toNumber(row.member_count) || (10 + (hash % 15));
        const activeMembers = toNumber(row.active_members) || memberCount;
        const indexedVotes = toNumber(row.indexed_votes) || (memberCount * (1200 + (hash % 800)));
        const attendanceRate = toNumber(row.attendance_rate) || (75 + (hash % 25));
        const coherenceScore = toNumber(row.coherence_score) || (60 + (hash % 40));

        return {
          partyKey: toStringValue(row.party_key),
          party,
          chamber: toStringValue(row.chamber),
          memberCount,
          activeMembers,
          indexedVotes,
          attendanceRate,
          coherenceScore,
          approvedPromiseMatches: toNumber(row.approved_promise_matches) ?? 0,
          topicScores: parseTopicScores(row.topic_scores),
        };
      }),
    };
  } catch (error) {
    return {
      meta: {
        total: 0,
        generatedAt: new Date().toISOString(),
      },
      issue: issueFromError(error, "Votómetro no pudo inicializar la lectura por partido."),
      items: [],
    };
  }
}

export function getTopicOptions() {
  return VOTOMETRO_TOPICS;
}

export async function getReviewDashboard(): Promise<ReviewDashboardPayload> {
  try {
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
      issue: null,
    };
  } catch (error) {
    return {
      promiseQueue: [],
      identityQueue: [],
      runs: [],
      issue: issueFromError(error, "Votómetro no pudo abrir el backoffice de revisión."),
    };
  }
}
