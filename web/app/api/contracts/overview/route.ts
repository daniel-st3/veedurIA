import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, formatCop } from "@/lib/supabase-server";
import { departmentFilterVariants, deptDisplayLabel, deptGeoName, getAllGeoNames } from "@/lib/colombia-departments";
import { displayEntityName } from "@/lib/format";
import type { OverviewPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Official SECOP Socrata endpoint for live source count
const SOCRATA_SUMMARY =
  "https://www.datos.gov.co/resource/jbjy-vk9h.json" +
  "?$select=max(fecha_de_firma)%20as%20max_fecha,%20count(*)%20as%20total&$limit=1";
const SOCRATA_LATEST =
  "https://www.datos.gov.co/resource/jbjy-vk9h.json" +
  "?$where=fecha_de_firma%20IS%20NOT%20NULL" +
  "&$select=fecha_de_firma" +
  "&$order=fecha_de_firma%20DESC,id_contrato%20ASC&$limit=1";
const SOCRATA_METADATA = "https://www.datos.gov.co/api/views/metadata/v1/jbjy-vk9h";
const SOURCE_FETCH_TIMEOUT_MS = 10_000;

function daysBetween(later: string | null, earlier: string | null) {
  if (!later || !earlier) return null;
  const left = new Date(`${later.slice(0, 10)}T00:00:00Z`).getTime();
  const right = new Date(`${earlier.slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.max(0, Math.round((left - right) / 86_400_000));
}

const CONTRACT_SLICE_AGGREGATE_COLUMNS = "department, entity, modality, date, value, risk_score, risk_bucket";
const CONTRACT_SLICE_LEAD_COLUMNS =
  "id, entity, provider, department, modality, date, value, risk_score, risk_bucket, secop_url, object_desc";
const CONTRACT_SLICE_PAGE_SIZE = 1000;

type SliceRow = {
  id: string | null;
  entity: string | null;
  provider: string | null;
  department: string | null;
  modality: string | null;
  date: string | null;
  value: number | string | null;
  risk_score: number | string | null;
  risk_bucket: string | null;
  secop_url: string | null;
  object_desc: string | null;
};

function searchableClause(raw: string) {
  const term = raw.trim().replace(/[%(),]/g, " ");
  if (!term) return null;
  return [
    `entity.ilike.%${term}%`,
    `provider.ilike.%${term}%`,
    `id.ilike.%${term}%`,
    `modality.ilike.%${term}%`,
    `object_desc.ilike.%${term}%`,
  ].join(",");
}

function readableText(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function readableUrl(value: unknown) {
  return String(value ?? "").trim();
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function bucketRisk(value: unknown): "high" | "medium" | "low" {
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  return "low";
}

function normalizeGroupKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function buildLeadCases(rows: SliceRow[], lang: "es" | "en", limit = 48): OverviewPayload["leadCases"] {
  return rows.slice(0, limit).map((row) => {
    const value = numericValue(row.value);
    return {
      id: String(row.id ?? ""),
      score: Math.round(numericValue(row.risk_score) * 100),
      riskBand: bucketRisk(row.risk_bucket),
      entity: displayEntityName(readableText(row.entity, lang === "es" ? "Entidad sin nombre disponible" : "Entity name unavailable")),
      provider: readableText(row.provider, lang === "es" ? "Proveedor no disponible" : "Provider unavailable"),
      department: deptDisplayLabel(String(row.department ?? "")),
      modality: readableText(row.modality, lang === "es" ? "Modalidad no disponible" : "Modality unavailable"),
      date: String(row.date ?? ""),
      value,
      valueLabel: formatCop(value, lang),
      secopUrl: readableUrl(row.secop_url),
      pickReason: "",
      signal: "",
      factors: [],
    };
  });
}

function buildSliceDepartments(rows: SliceRow[]) {
  const byGeoName = new Map<string, { key: string; label: string; geoName: string; avgRisk: number; contractCount: number }>();

  rows.forEach((row) => {
    const rawDepartment = String(row.department ?? "").trim();
    if (!rawDepartment) return;
    const geoName = deptGeoName(rawDepartment);
    const current = byGeoName.get(geoName) ?? {
      key: geoName,
      label: deptDisplayLabel(rawDepartment),
      geoName,
      avgRisk: 0,
      contractCount: 0,
    };
    current.contractCount += 1;
    current.avgRisk += numericValue(row.risk_score);
    byGeoName.set(geoName, current);
  });

  for (const item of byGeoName.values()) {
    item.avgRisk = item.contractCount ? item.avgRisk / item.contractCount : 0;
  }

  for (const geoName of getAllGeoNames()) {
    if (!byGeoName.has(geoName)) {
      byGeoName.set(geoName, {
        key: geoName,
        label: deptDisplayLabel(geoName),
        geoName,
        avgRisk: 0,
        contractCount: 0,
      });
    }
  }

  return [...byGeoName.values()].filter((department) => department.geoName !== "NO DEFINIDO");
}

function buildTopEntities(rows: SliceRow[]): OverviewPayload["summaries"]["entities"] {
  const buckets = new Map<string, { nombre_entidad: string; contracts: number; totalRisk: number; maxRisk: number }>();

  rows.forEach((row) => {
    const label = displayEntityName(readableText(row.entity, "Entidad sin dato"));
    const key = normalizeGroupKey(label);
    const current = buckets.get(key) ?? {
      nombre_entidad: label,
      contracts: 0,
      totalRisk: 0,
      maxRisk: 0,
    };
    const risk = numericValue(row.risk_score);
    current.contracts += 1;
    current.totalRisk += risk;
    current.maxRisk = Math.max(current.maxRisk, risk);
    buckets.set(key, current);
  });

  return [...buckets.values()]
    .map((item) => ({
      nombre_entidad: item.nombre_entidad,
      contracts: item.contracts,
      meanRisk: item.contracts ? Number((item.totalRisk / item.contracts).toFixed(4)) : 0,
      maxRisk: Number(item.maxRisk.toFixed(4)),
    }))
    .sort((left, right) => right.contracts - left.contracts || right.meanRisk - left.meanRisk)
    .slice(0, 24);
}

function buildTopModalities(rows: SliceRow[]): OverviewPayload["summaries"]["modalities"] {
  const buckets = new Map<string, { modalidad_de_contratacion: string; contracts: number; totalRisk: number }>();

  rows.forEach((row) => {
    const label = readableText(row.modality, "Modalidad sin dato");
    const key = normalizeGroupKey(label);
    const current = buckets.get(key) ?? {
      modalidad_de_contratacion: label,
      contracts: 0,
      totalRisk: 0,
    };
    current.contracts += 1;
    current.totalRisk += numericValue(row.risk_score);
    buckets.set(key, current);
  });

  return [...buckets.values()]
    .map((item) => ({
      modalidad_de_contratacion: item.modalidad_de_contratacion,
      contracts: item.contracts,
      meanRisk: item.contracts ? Number((item.totalRisk / item.contracts).toFixed(4)) : 0,
    }))
    .sort((left, right) => right.contracts - left.contracts || right.meanRisk - left.meanRisk)
    .slice(0, 12);
}

function buildMonthlyAnalytics(rows: SliceRow[]): OverviewPayload["analytics"]["months"] {
  const buckets = new Map<string, { month: string; contracts: number; totalRisk: number }>();

  rows.forEach((row) => {
    const month = String(row.date ?? "").slice(0, 7);
    if (!month) return;
    const current = buckets.get(month) ?? { month, contracts: 0, totalRisk: 0 };
    current.contracts += 1;
    current.totalRisk += numericValue(row.risk_score);
    buckets.set(month, current);
  });

  return [...buckets.values()]
    .map((item) => ({
      month: item.month,
      contracts: item.contracts,
      meanRisk: item.contracts ? Number((item.totalRisk / item.contracts).toFixed(4)) : 0,
    }))
    .sort((left, right) => left.month.localeCompare(right.month))
    .slice(-24);
}

function buildRiskBands(rows: SliceRow[]): OverviewPayload["analytics"]["riskBands"] {
  const buckets = new Map<"high" | "medium" | "low", { contracts: number; totalRisk: number }>([
    ["high", { contracts: 0, totalRisk: 0 }],
    ["medium", { contracts: 0, totalRisk: 0 }],
    ["low", { contracts: 0, totalRisk: 0 }],
  ]);

  rows.forEach((row) => {
    const band = bucketRisk(row.risk_bucket);
    const current = buckets.get(band)!;
    current.contracts += 1;
    current.totalRisk += numericValue(row.risk_score);
  });

  return (["high", "medium", "low"] as const)
    .map((riskBand) => {
      const current = buckets.get(riskBand)!;
      return {
        riskBand,
        contracts: current.contracts,
        meanRisk: current.contracts ? Number((current.totalRisk / current.contracts).toFixed(4)) : 0,
      };
    })
    .filter((item) => item.contracts > 0);
}

function dominantDepartment(rows: SliceRow[]) {
  const buckets = new Map<string, number>();
  rows.forEach((row) => {
    const rawDepartment = String(row.department ?? "").trim();
    if (!rawDepartment) return;
    const label = deptDisplayLabel(rawDepartment);
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  });

  return [...buckets.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "Colombia";
}

function meanRisk(rows: SliceRow[]) {
  if (!rows.length) return 0;
  const total = rows.reduce((sum, row) => sum + numericValue(row.risk_score), 0);
  return total / rows.length;
}

function medianValue(rows: SliceRow[]) {
  if (!rows.length) return 0;
  const values = rows.map((row) => numericValue(row.value)).sort((left, right) => left - right);
  const midpoint = Math.floor(values.length / 2);
  if (values.length % 2 === 0) {
    return Math.round((values[midpoint - 1] + values[midpoint]) / 2);
  }
  return Math.round(values[midpoint] ?? 0);
}

function applyContractFilters<T>(query: T, args: {
  departmentFilters: string[];
  risk: string;
  modality?: string;
  dateFrom?: string;
  dateTo?: string;
  queryText?: string;
}) {
  let next = query as any;
  if (args.departmentFilters.length) next = next.in("department", args.departmentFilters);
  if (args.risk === "high") next = next.eq("risk_bucket", "high");
  else if (args.risk === "medium") next = next.eq("risk_bucket", "medium");
  else if (args.risk === "low") next = next.eq("risk_bucket", "low");
  if (args.modality) next = next.eq("modality", args.modality);
  if (args.dateFrom) next = next.gte("date", args.dateFrom);
  if (args.dateTo) next = next.lte("date", args.dateTo);
  if (args.queryText) {
    const clause = searchableClause(args.queryText);
    if (clause) next = next.or(clause);
  }
  return next as T;
}

async function fetchSliceRows(
  sb: ReturnType<typeof createServerSupabase>,
  args: {
    departmentFilters: string[];
    risk: string;
    modality?: string;
    dateFrom?: string;
    dateTo?: string;
    queryText?: string;
  },
) {
  const rows: SliceRow[] = [];
  let countQuery = sb.from("contracts").select("id", { count: "exact", head: true });
  countQuery = applyContractFilters(countQuery, args);

  let leadQuery = sb
    .from("contracts")
    .select(CONTRACT_SLICE_LEAD_COLUMNS)
    .order("risk_score", { ascending: false })
    .order("id", { ascending: true })
    .limit(48);
  leadQuery = applyContractFilters(leadQuery, args);

  const [{ count, error: countError }, { data: leadRows, error: leadError }] = await Promise.all([
    countQuery,
    leadQuery,
  ]);

  if (countError) throw countError;
  if (leadError) throw leadError;

  const totalCount = count ?? 0;
  if (totalCount === 0) {
    return { rows, totalCount, leadRows: [] as SliceRow[] };
  }

  for (let offset = 0; offset < totalCount; offset += CONTRACT_SLICE_PAGE_SIZE) {
    let pageQuery = sb
      .from("contracts")
      .select(CONTRACT_SLICE_AGGREGATE_COLUMNS)
      .range(offset, offset + CONTRACT_SLICE_PAGE_SIZE - 1);

    pageQuery = applyContractFilters(pageQuery, args);

    const { data, error } = await pageQuery;
    if (error) throw error;

    const pageRows = (data ?? []) as SliceRow[];
    rows.push(...pageRows);

    if (pageRows.length < CONTRACT_SLICE_PAGE_SIZE) break;
  }

  return { rows, totalCount, leadRows: (leadRows ?? []) as SliceRow[] };
}

async function fetchSourceStatus(): Promise<{ rows: number | null; latestDate: string | null; updatedAt: string | null }> {
  const fetchJson = async (url: string) => {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`SECOP request failed: ${response.status}`);
    return response.json();
  };

  const [summaryRes, latestRes, metadataRes] = await Promise.allSettled([
    fetchJson(SOCRATA_SUMMARY),
    fetchJson(SOCRATA_LATEST),
    fetchJson(SOCRATA_METADATA),
  ]);

  let rows: number | null = null;
  let latestDate: string | null = null;
  let updatedAt: string | null = null;

  if (summaryRes.status === "fulfilled") {
    rows = summaryRes.value?.[0]?.total ? Number(summaryRes.value[0].total) : null;
    latestDate = summaryRes.value?.[0]?.max_fecha?.slice(0, 10) ?? null;
  }

  if (latestRes.status === "fulfilled") {
    latestDate ??= latestRes.value?.[0]?.fecha_de_firma?.slice(0, 10) ?? null;
  }

  if (metadataRes.status === "fulfilled") {
    updatedAt = metadataRes.value?.dataUpdatedAt ?? null;
  }

  return { rows, latestDate, updatedAt };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const lang = (searchParams.get("lang") ?? "es") as "es" | "en";
    const department = searchParams.get("department") ?? undefined;
    const risk = searchParams.get("risk") ?? "all";
    const modality = searchParams.get("modality") ?? undefined;
    const dateFrom = searchParams.get("date_from") ?? undefined;
    const dateTo = searchParams.get("date_to") ?? undefined;
    const queryText = searchParams.get("query") ?? undefined;
    const departmentFilters = departmentFilterVariants(department);
    const activeDepartmentGeoName = deptGeoName(department);

    const hasFilters = !!(department || (risk && risk !== "all") || modality || dateFrom || dateTo || queryText);

    const sb = createServerSupabase();

    // ── 1. Read pre-computed global stats ────────────────────────────────────
    const { data: statsRow, error: statsErr } = await sb
      .from("contracts_stats")
      .select("data, updated_at")
      .eq("key", "global")
      .single();

    if (statsErr || !statsRow) {
      return NextResponse.json({ error: "Stats not yet computed. Run the import script." }, { status: 503 });
    }

    const g = statsRow.data as Record<string, unknown>;

    // ── 2. If filters, run a slice query for filtered counts/lead cases ──────
    let sliceTotal = g.totalRows as number;
    let sliceRed = g.redAlerts as number;
    let sliceMean = g.meanRisk as number;
    let sliceMedian = g.medianValue as number;
    let sliceDominant = g.dominantDepartment as string;
    let filteredLeadCases = g.leadCases as OverviewPayload["leadCases"];
    let filteredDepartments: OverviewPayload["analytics"]["departments"] | null = null;
    let filteredEntities: OverviewPayload["summaries"]["entities"] | null = null;
    let filteredModalities: OverviewPayload["summaries"]["modalities"] | null = null;
    let filteredMonths: OverviewPayload["analytics"]["months"] | null = null;
    let filteredRiskBands: OverviewPayload["analytics"]["riskBands"] | null = null;

    if (hasFilters) {
      const { rows, totalCount, leadRows } = await fetchSliceRows(sb, {
        departmentFilters,
        risk,
        modality,
        dateFrom,
        dateTo,
        queryText,
      });

      sliceTotal = totalCount;
      sliceRed = rows.filter((row) => bucketRisk(row.risk_bucket) === "high").length;

      if (rows.length > 0) {
        sliceMean = meanRisk(rows);
        sliceMedian = medianValue(rows);
        sliceDominant = dominantDepartment(rows);
        filteredLeadCases = buildLeadCases(leadRows, lang);
        filteredDepartments = buildSliceDepartments(rows);
        filteredEntities = buildTopEntities(rows);
        filteredModalities = buildTopModalities(rows);
        filteredMonths = buildMonthlyAnalytics(rows);
        filteredRiskBands = buildRiskBands(rows);
      } else {
        sliceTotal = 0;
        sliceRed = 0;
        sliceMean = 0;
        sliceMedian = 0;
        sliceDominant = "Colombia";
        filteredLeadCases = [];
        filteredDepartments = buildSliceDepartments([]);
        filteredEntities = [];
        filteredModalities = [];
        filteredMonths = [];
        filteredRiskBands = [];
      }
    }

    // ── 3. Fetch live SECOP source count (non-blocking) ──────────────────────
    const sourceData = await fetchSourceStatus();

    // ── 4. Build departments from global stats ───────────────────────────────
    const allDepts = ((g.departments as Array<{
      key: string; label: string; geoName: string; avgRisk: number; contractCount: number;
    }>) ?? []).map((department) => {
      const geoName = deptGeoName(department.geoName || department.key);
      return {
        key: geoName,
        label: deptDisplayLabel(department.label || department.key),
        geoName,
        avgRisk: department.avgRisk,
        contractCount: department.contractCount,
      };
    });

    // Pad every canonical GeoJSON department so the map always paints all 33 regions.
    // The import script only stores departments that have flagged (red/yellow) contracts,
    // so departments with only low-risk contracts would be missing without this padding.
    const allDeptsByGeoName = new Map(allDepts.map((d) => [d.geoName, d]));
    for (const geoName of getAllGeoNames()) {
      if (!allDeptsByGeoName.has(geoName)) {
        allDeptsByGeoName.set(geoName, {
          key: geoName,
          label: deptDisplayLabel(geoName),
          geoName,
          avgRisk: 0,
          contractCount: 0,
        });
      }
    }
    const paddedAllDepts = [...allDeptsByGeoName.values()];

    const effectiveDepartments = hasFilters && filteredDepartments ? filteredDepartments : paddedAllDepts;
    const filteredDepts = (activeDepartmentGeoName
      ? effectiveDepartments.filter((d) => d.geoName === activeDepartmentGeoName)
      : effectiveDepartments).filter((department) => department.geoName !== "NO DEFINIDO");

    const departmentOptions = [...new Map(
      (((g.deptOptions as string[]) ?? []) as string[])
        .map((rawDepartment) => {
          const geoName = deptGeoName(rawDepartment);
          return [
            geoName,
            {
              value: geoName,
              label: deptDisplayLabel(rawDepartment),
            },
          ] as const;
        }),
    ).values()];

    const scoredSnapshotDate = (g.latestDate as string | null) ?? null;
    const sourceFreshnessGapDays = daysBetween(sourceData.latestDate, scoredSnapshotDate);

    // ── 5. Compose OverviewPayload ───────────────────────────────────────────
    const payload: OverviewPayload = {
      meta: {
        lang,
        fullDataset: true,
        totalRows: g.totalRows as number,
        shownRows: hasFilters ? sliceTotal : (g.totalRows as number),
        previewRows: Math.min(hasFilters ? sliceTotal : (g.totalRows as number), 48),
        latestContractDate: scoredSnapshotDate,
        sourceLatestContractDate: sourceData.latestDate,
        sourceRows: sourceData.rows,
        sourceFreshnessGapDays,
        sourceUpdatedAt: sourceData.updatedAt,
        lastRunTs: statsRow.updated_at as string,
      },
      options: {
        departments: departmentOptions,
        modalities: ((g.modalityOptions as string[]) ?? []).map((m) => ({ value: m, label: m })),
      },
      map: {
        departments: filteredDepts.map((d) => ({
          key: d.key,
          label: d.label,
          geoName: d.geoName,
          avgRisk: d.avgRisk,
          contractCount: d.contractCount,
        })),
      },
      slice: {
        totalContracts: sliceTotal,
        redAlerts: sliceRed,
        prioritizedValue: sliceMedian,
        prioritizedValueLabel: formatCop(sliceMedian, lang),
        dominantDepartment: deptDisplayLabel(sliceDominant),
      },
      benchmarks: {
        nationalMeanRisk: g.meanRisk as number,
        sliceMeanRisk: sliceMean,
        departmentMeanRisk: activeDepartmentGeoName
          ? effectiveDepartments.find((department) => department.geoName === activeDepartmentGeoName)?.avgRisk ?? null
          : null,
        sliceMedianValue: sliceMedian,
      },
      leadCases: filteredLeadCases,
      summaries: {
        entities: hasFilters ? filteredEntities ?? [] : (g.entities as OverviewPayload["summaries"]["entities"]) ?? [],
        modalities: hasFilters ? filteredModalities ?? [] : (g.modalities as OverviewPayload["summaries"]["modalities"]) ?? [],
      },
      analytics: {
        departments: (hasFilters ? effectiveDepartments : paddedAllDepts).filter((department) => department.geoName !== "NO DEFINIDO"),
        modalities: hasFilters ? filteredModalities ?? [] : (g.modalities as OverviewPayload["analytics"]["modalities"]) ?? [],
        entities: hasFilters ? filteredEntities ?? [] : (g.entities as OverviewPayload["analytics"]["entities"]) ?? [],
        months: hasFilters ? filteredMonths ?? [] : (g.months as OverviewPayload["analytics"]["months"]) ?? [],
        riskBands: hasFilters ? filteredRiskBands ?? [] : (g.riskBands as OverviewPayload["analytics"]["riskBands"]) ?? [],
      },
      methodology: {
        modelType: "IsolationForest",
        nEstimators: 100,
        contamination: 0.05,
        nFeatures: 25,
        trainedAt: null,
        redThreshold: 0.7,
        yellowThreshold: 0.4,
      },
      liveFeed: {
        latestDate: sourceData.latestDate,
        rowsAtSource: sourceData.rows,
        contracts: [],
      },
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    console.error("[/api/contracts/overview]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
