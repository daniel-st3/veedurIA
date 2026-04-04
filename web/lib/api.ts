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
    return await response.json();
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
    return await response.json();
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
    return await response.json();
  } catch {
    return getMockPromises(filters);
  }
}
