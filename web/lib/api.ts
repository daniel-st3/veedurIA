import type {
  ContractsFreshnessPayload,
  Lang,
  OverviewPayload,
  PromisesPayload,
  TablePayload,
} from "@/lib/types";
import type {
  NetworkNodeDetail,
  NetworkPayload,
  NetworkVersion,
  ErrorReportBody,
} from "@/lib/network/types";
import {
  getMockFreshness,
  getMockOverview,
  getMockPromises,
  getMockTable,
  getMockNetwork,
  getMockNetworkNodeDetail,
  getMockNetworkVersion,
} from "@/lib/mock-data";
import { formatCompactCop } from "@/lib/format";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const OFFICIAL_CONTRACTS_SUMMARY =
  "https://www.datos.gov.co/resource/jbjy-vk9h.json?$select=max(fecha_de_firma)%20as%20max_fecha,%20count(*)%20as%20total&$limit=1";
const OFFICIAL_CONTRACTS_LATEST =
  "https://www.datos.gov.co/resource/jbjy-vk9h.json?$select=fecha_de_firma,id_contrato,nombre_entidad,valor_del_contrato,departamento,urlproceso&$order=fecha_de_firma%20DESC,id_contrato%20ASC&$limit=5";
const OFFICIAL_CONTRACTS_METADATA = "https://www.datos.gov.co/api/views/metadata/v1/jbjy-vk9h";
const LOCAL_GEOJSON_PATH = "/data/colombia_departments.geojson";

export type ContractsFilters = {
  lang: Lang;
  full?: boolean;
  department?: string;
  risk?: "all" | "high" | "medium" | "low";
  modality?: string;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
};

function hasObjectShape(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasMeaningfulContractsFilter(filters: ContractsFilters & { offset?: number; limit?: number }) {
  return Boolean(
    filters.full ||
      filters.department ||
      (filters.risk && filters.risk !== "all") ||
      filters.modality ||
      filters.query?.trim() ||
      filters.dateFrom ||
      filters.dateTo,
  );
}

function isValidOverviewPayload(value: unknown): value is OverviewPayload {
  if (!hasObjectShape(value)) return false;
  const payload = value as Record<string, unknown>;
  const benchmarks = payload.benchmarks;
  return (
    hasObjectShape(payload.meta) &&
    hasObjectShape(payload.options) &&
    hasObjectShape(payload.map) &&
    hasObjectShape(payload.slice) &&
    Array.isArray(payload.leadCases) &&
    hasObjectShape(benchmarks) &&
    typeof benchmarks.sliceMeanRisk === "number" &&
      typeof benchmarks.nationalMeanRisk === "number"
  );
}

function hasUsableOverviewCounts(payload: OverviewPayload, filters: ContractsFilters) {
  if (hasMeaningfulContractsFilter(filters)) return true;
  return [payload.meta.sourceRows, payload.meta.totalRows, payload.meta.shownRows, payload.slice.totalContracts].some(
    (value) => typeof value === "number" && value > 0,
  );
}

function isValidFreshnessPayload(value: unknown): value is ContractsFreshnessPayload {
  if (!hasObjectShape(value)) return false;
  const payload = value as Record<string, unknown>;
  return hasObjectShape(payload.liveFeed) && Array.isArray(payload.liveFeed.contracts);
}

function isValidTablePayload(
  value: unknown,
  filters: ContractsFilters & { offset?: number; limit?: number },
): value is TablePayload {
  if (!hasObjectShape(value)) return false;
  const payload = value as Record<string, unknown>;
  const total = payload.total;
  const rows = payload.rows;
  if (typeof total !== "number" || !Array.isArray(rows)) return false;
  if (!hasMeaningfulContractsFilter(filters) && total <= 0) return false;
  return true;
}

function isRichPromisesPayload(value: unknown): value is PromisesPayload {
  if (!hasObjectShape(value)) return false;
  const payload = value as Record<string, unknown>;
  return (
    hasObjectShape(payload.meta) &&
    hasObjectShape(payload.options) &&
    hasObjectShape(payload.kpis) &&
    hasObjectShape(payload.scorecard) &&
    Array.isArray(payload.cards) &&
    Array.isArray(payload.sandboxCards) &&
    Array.isArray(payload.options.politicians) &&
    payload.options.politicians.length >= 10 &&
    typeof payload.kpis.promisesTracked === "number" &&
    payload.kpis.promisesTracked >= 48
  );
}

function buildQuery(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  return search.toString();
}

function parseOfficialCurrency(raw: unknown) {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return 0;
  const cleaned = raw.replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

type GeoJsonPayload = {
  features?: Array<Record<string, unknown>>;
};

async function fetchOfficialContractsFallback(lang: Lang) {
  const [summaryResponse, latestResponse, metadataResponse] = await Promise.all([
    fetch(OFFICIAL_CONTRACTS_SUMMARY, { cache: "no-store" }),
    fetch(OFFICIAL_CONTRACTS_LATEST, { cache: "no-store" }),
    fetch(OFFICIAL_CONTRACTS_METADATA, { cache: "no-store" }),
  ]);

  if (!summaryResponse.ok || !latestResponse.ok || !metadataResponse.ok) {
    throw new Error("Official contracts source unavailable");
  }

  const [summary, latest, metadata] = await Promise.all([
    summaryResponse.json(),
    latestResponse.json(),
    metadataResponse.json(),
  ]);

  const latestDate = summary?.[0]?.max_fecha?.slice(0, 10) ?? null;
  const sourceRows = Number(summary?.[0]?.total ?? 0) || null;
  const sourceUpdatedAt = metadata?.dataUpdatedAt ?? null;
  const contracts = Array.isArray(latest)
    ? latest.map((row: Record<string, unknown>) => {
        const value = parseOfficialCurrency(row.valor_del_contrato);
        return {
          id: String(row.id_contrato ?? ""),
          entity: String(row.nombre_entidad ?? ""),
          department: String(row.departamento ?? ""),
          date: String(row.fecha_de_firma ?? "").slice(0, 10),
          value,
          valueLabel: formatCompactCop(value, lang),
          secopUrl:
            typeof row.urlproceso === "string"
              ? row.urlproceso
              : typeof row.urlproceso === "object" && row.urlproceso && "url" in row.urlproceso
                ? String((row.urlproceso as { url?: unknown }).url ?? "")
                : "",
        };
      })
    : [];

  return {
    latestDate,
    sourceRows,
    sourceUpdatedAt,
    contracts,
  };
}

export async function fetchOverview(filters: ContractsFilters): Promise<OverviewPayload> {
  try {
    const query = buildQuery({
      lang: filters.lang,
      full: filters.full ?? false,
      department: filters.department,
      risk: filters.risk ?? "all",
      modality: filters.modality,
      query: filters.query,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
    });
    const response = await fetch(`${API_BASE}/contracts/overview?${query}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Failed to fetch overview");
    const payload = await response.json();
    if (!isValidOverviewPayload(payload)) throw new Error("Incomplete overview payload");
    if (!hasUsableOverviewCounts(payload, filters)) throw new Error("Degenerate overview payload");
    return payload;
  } catch {
    const mock = getMockOverview(filters);
    try {
      const live = await fetchOfficialContractsFallback(filters.lang);
      const scoredDate = mock.meta.latestContractDate;
      const gap =
        scoredDate && live.latestDate
          ? Math.max(
              0,
              Math.round(
                (new Date(`${live.latestDate}T00:00:00Z`).getTime() - new Date(`${scoredDate}T00:00:00Z`).getTime()) /
                  86_400_000,
              ),
            )
          : mock.meta.sourceFreshnessGapDays ?? null;

      return {
        ...mock,
        meta: {
          ...mock.meta,
          sourceLatestContractDate: live.latestDate,
          sourceRows: live.sourceRows,
          sourceUpdatedAt: live.sourceUpdatedAt,
          sourceFreshnessGapDays: gap,
        },
        liveFeed: {
          latestDate: live.latestDate,
          rowsAtSource: live.sourceRows,
          contracts: live.contracts,
        },
      };
    } catch {
      return mock;
    }
  }
}

export async function fetchContractsTable(
  filters: ContractsFilters & { offset?: number; limit?: number },
): Promise<TablePayload> {
  try {
    const query = buildQuery({
      lang: filters.lang,
      full: filters.full ?? false,
      department: filters.department,
      risk: filters.risk ?? "all",
      modality: filters.modality,
      query: filters.query,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      offset: filters.offset ?? 0,
      limit: filters.limit ?? 24,
    });
    const response = await fetch(`${API_BASE}/contracts/table?${query}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Failed to fetch table");
    const payload = await response.json();
    if (!isValidTablePayload(payload, filters)) throw new Error("Incomplete table payload");
    return payload;
  } catch {
    return getMockTable(filters);
  }
}

export async function fetchContractsFreshness(): Promise<ContractsFreshnessPayload> {
  try {
    const response = await fetch(`${API_BASE}/contracts/freshness`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Failed to fetch contracts freshness");
    const payload = await response.json();
    if (!isValidFreshnessPayload(payload)) throw new Error("Incomplete freshness payload");
    return payload;
  } catch {
    const mock = getMockFreshness();
    try {
      const live = await fetchOfficialContractsFallback("es");
      const scoredDate = mock.latestContractDate;
      const gap =
        scoredDate && live.latestDate
          ? Math.max(
              0,
              Math.round(
                (new Date(`${live.latestDate}T00:00:00Z`).getTime() - new Date(`${scoredDate}T00:00:00Z`).getTime()) /
                  86_400_000,
              ),
            )
          : mock.sourceFreshnessGapDays ?? null;

      return {
        ...mock,
        sourceLatestContractDate: live.latestDate,
        sourceRows: live.sourceRows,
        sourceUpdatedAt: live.sourceUpdatedAt,
        sourceFreshnessGapDays: gap,
        liveFeed: {
          latestDate: live.latestDate,
          rowsAtSource: live.sourceRows,
          contracts: live.contracts,
        },
      };
    } catch {
      return mock;
    }
  }
}

export async function fetchGeoJson(): Promise<GeoJsonPayload | null> {
  try {
    const response = await fetch(`${API_BASE}/contracts/geojson`, { cache: "force-cache" });
    if (!response.ok) throw new Error("Failed to fetch geojson");
    return await response.json();
  } catch {
    if (typeof window === "undefined") return null;
    try {
      const localResponse = await fetch(LOCAL_GEOJSON_PATH, { cache: "force-cache" });
      if (!localResponse.ok) throw new Error("Failed to fetch bundled geojson");
      return await localResponse.json();
    } catch {
      return null;
    }
  }
}

export type PromiseFilters = {
  lang: Lang;
  politicianId?: string;
  domain?: string;
  status?: string;
  electionYear?: number;
  chamber?: string;
  query?: string;
  limit?: number;
};

export async function fetchPromisesOverview(filters: PromiseFilters): Promise<PromisesPayload> {
  try {
    const query = buildQuery({
      lang: filters.lang,
      politician_id: filters.politicianId,
      domain: filters.domain ?? "all",
      status: filters.status ?? "all",
      election_year: filters.electionYear ?? 2022,
      chamber: filters.chamber,
      query: filters.query,
      limit: filters.limit ?? 48,
    });
    const response = await fetch(`${API_BASE}/promises/overview?${query}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Failed to fetch promises overview");
    const payload = await response.json();
    if (!isRichPromisesPayload(payload)) throw new Error("Thin promises payload");
    return payload;
  } catch {
    return getMockPromises(filters);
  }
}

// ─── SigueElDinero — Network API ──────────────────────────────────────────────

export type NetworkFilters = {
  lang: Lang;
  limit?: number;
  department?: string;
  minConfidence?: number;
};

function isNetworkPayload(value: unknown): value is NetworkPayload {
  if (!hasObjectShape(value)) return false;
  const p = value as Record<string, unknown>;
  return (
    hasObjectShape(p.meta) &&
    Array.isArray(p.nodes) &&
    Array.isArray(p.edges)
  );
}

export async function fetchNetworkVersion(): Promise<NetworkVersion> {
  try {
    const response = await fetch(`${API_BASE}/network/version`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed");
    return await response.json();
  } catch {
    return getMockNetworkVersion();
  }
}

export async function fetchNetworkOverview(filters: NetworkFilters): Promise<NetworkPayload> {
  try {
    const query = buildQuery({
      lang: filters.lang,
      limit: filters.limit ?? 30,
      department: filters.department,
      min_confidence: filters.minConfidence ?? 40,
    });
    const response = await fetch(`${API_BASE}/network/overview?${query}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to fetch network overview");
    const payload = await response.json();
    if (!isNetworkPayload(payload)) throw new Error("Invalid network payload");
    return payload;
  } catch {
    return getMockNetwork();
  }
}

export async function fetchNetworkSearch(query: string, lang: Lang, minConfidence = 40): Promise<NetworkPayload> {
  try {
    const qs = buildQuery({ q: query, lang, min_confidence: minConfidence });
    const response = await fetch(`${API_BASE}/network/search?${qs}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to fetch network search");
    const payload = await response.json();
    if (!isNetworkPayload(payload)) throw new Error("Invalid network search payload");
    return payload;
  } catch {
    const mock = getMockNetwork();
    // Simulate a filtered result
    const q = query.toUpperCase();
    const matched = mock.nodes.filter((n) => n.label.toUpperCase().includes(q));
    if (!matched.length) return { ...mock, nodes: [], edges: [], meta: { ...mock.meta, found: false, query } };
    return { ...mock, meta: { ...mock.meta, found: true, query, match_label: matched[0].label } };
  }
}

export async function fetchNetworkExpand(nodeId: string, lang: Lang, minConfidence = 40): Promise<NetworkPayload> {
  try {
    const qs = buildQuery({ lang, min_confidence: minConfidence });
    const response = await fetch(`${API_BASE}/network/expand/${nodeId}?${qs}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to fetch network expand");
    const payload = await response.json();
    if (!isNetworkPayload(payload)) throw new Error("Invalid network expand payload");
    return payload;
  } catch {
    return getMockNetwork();
  }
}

export async function fetchNetworkNodeDetail(nodeId: string, lang: Lang): Promise<NetworkNodeDetail> {
  try {
    const qs = buildQuery({ lang });
    const response = await fetch(`${API_BASE}/network/node/${nodeId}?${qs}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to fetch node detail");
    return await response.json();
  } catch {
    return getMockNetworkNodeDetail(nodeId);
  }
}

export async function reportNetworkError(body: ErrorReportBody): Promise<void> {
  try {
    await fetch(`${API_BASE}/network/report-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Silent — error report is best-effort
  }
}
