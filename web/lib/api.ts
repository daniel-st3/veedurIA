import type { Lang, OverviewPayload, TablePayload } from "@/lib/types";

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
  if (!response.ok) {
    throw new Error("Failed to fetch overview");
  }
  return response.json();
}

export async function fetchContractsTable(
  filters: ContractsFilters & { offset?: number; limit?: number },
): Promise<TablePayload> {
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
  if (!response.ok) {
    throw new Error("Failed to fetch table");
  }
  return response.json();
}

export async function fetchGeoJson(): Promise<GeoJSON.GeoJSON> {
  const response = await fetch(`${API_BASE}/contracts/geojson`, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error("Failed to fetch geojson");
  }
  return response.json();
}
