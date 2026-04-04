import type {
  ContractsFreshnessPayload,
  Lang,
  OverviewPayload,
  PromisesPayload,
  TablePayload,
} from "@/lib/types";
import { getMockFreshness, getMockOverview, getMockPromises, getMockTable } from "@/lib/mock-data";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

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

function isValidFreshnessPayload(value: unknown): value is ContractsFreshnessPayload {
  if (!hasObjectShape(value)) return false;
  const payload = value as Record<string, unknown>;
  return hasObjectShape(payload.liveFeed) && Array.isArray(payload.liveFeed.contracts);
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
    Array.isArray(payload.options.politicians) &&
    payload.options.politicians.length >= 8 &&
    typeof payload.kpis.promisesTracked === "number" &&
    payload.kpis.promisesTracked >= 24
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
    return payload;
  } catch {
    return getMockOverview(filters);
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
    return await response.json();
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
    return getMockFreshness();
  }
}

export async function fetchGeoJson(): Promise<GeoJSON.GeoJSON | null> {
  try {
    const response = await fetch(`${API_BASE}/contracts/geojson`, { cache: "force-cache" });
    if (!response.ok) throw new Error("Failed to fetch geojson");
    return await response.json();
  } catch {
    return null;
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
      query: filters.query,
      limit: filters.limit ?? 18,
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
