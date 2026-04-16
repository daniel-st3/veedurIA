import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, formatCop } from "@/lib/supabase-server";
import { departmentFilterVariants, deptDisplayLabel, deptGeoName, getAllGeoNames } from "@/lib/colombia-departments";
import type { OverviewPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Official SECOP Socrata endpoint for live source count
const SOCRATA_SUMMARY =
  "https://www.datos.gov.co/resource/jbjy-vk9h.json" +
  "?$select=max(fecha_de_firma)%20as%20max_fecha,%20count(*)%20as%20total&$limit=1";
const SOCRATA_METADATA = "https://www.datos.gov.co/api/views/metadata/v1/jbjy-vk9h";

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

async function fetchSourceStatus(): Promise<{ rows: number | null; latestDate: string | null; updatedAt: string | null }> {
  try {
    const [summaryRes, metadataRes] = await Promise.all([
      fetch(SOCRATA_SUMMARY, { cache: "no-store" }),
      fetch(SOCRATA_METADATA, { cache: "no-store" }),
    ]);
    if (!summaryRes.ok || !metadataRes.ok) {
      return { rows: null, latestDate: null, updatedAt: null };
    }
    const [json, metadata] = await Promise.all([summaryRes.json(), metadataRes.json()]);
    return {
      rows: json?.[0]?.total ? Number(json[0].total) : null,
      latestDate: json?.[0]?.max_fecha?.slice(0, 10) ?? null,
      updatedAt: metadata?.dataUpdatedAt ?? null,
    };
  } catch {
    return { rows: null, latestDate: null, updatedAt: null };
  }
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

    if (hasFilters) {
      let q = sb
        .from("contracts")
        .select("id, entity, provider, department, modality, date, value, risk_score, risk_bucket, secop_url, object_desc", { count: "exact" })
        .order("risk_score", { ascending: false })
        .limit(48);

      if (departmentFilters.length) q = q.in("department", departmentFilters);
      if (risk === "high") q = q.eq("risk_bucket", "high");
      else if (risk === "medium") q = q.eq("risk_bucket", "medium");
      else if (risk === "low") q = q.eq("risk_bucket", "low");
      if (modality) q = q.eq("modality", modality);
      if (dateFrom) q = q.gte("date", dateFrom);
      if (dateTo) q = q.lte("date", dateTo);
      if (queryText) {
        const clause = searchableClause(queryText);
        if (clause) q = q.or(clause);
      }

      const { data: rows, count } = await q;

      sliceTotal = count ?? 0;
      sliceRed = rows?.filter((r: { risk_bucket: string }) => r.risk_bucket === "high").length ?? 0;

      if (rows && rows.length > 0) {
        const scores = rows.map((r: { risk_score: number }) => r.risk_score);
        sliceMean = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        const vals = rows.map((r: { value: number }) => r.value ?? 0).sort((a: number, b: number) => a - b);
        sliceMedian = vals[Math.floor(vals.length / 2)] ?? 0;
        const depts = rows.map((r: { department: string }) => r.department).filter(Boolean);
        const deptFreq: Record<string, number> = {};
        for (const d of depts) deptFreq[d] = (deptFreq[d] ?? 0) + 1;
        sliceDominant = Object.entries(deptFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Colombia";
      } else {
        sliceTotal = 0;
        sliceRed = 0;
        sliceMean = 0;
        sliceMedian = 0;
      }

      filteredLeadCases = (rows ?? []).slice(0, 48).map((r: Record<string, unknown>) => ({
        id: String(r.id ?? ""),
        score: Math.round((r.risk_score as number) * 100),
        riskBand: ((r.risk_bucket as string) === "high" ? "high" : (r.risk_bucket as string) === "medium" ? "medium" : "low") as "high" | "medium" | "low",
        entity: readableText(r.entity, lang === "es" ? "Entidad sin nombre disponible" : "Entity name unavailable"),
        provider: readableText(r.provider, lang === "es" ? "Proveedor no disponible" : "Provider unavailable"),
        department: deptDisplayLabel(String(r.department ?? "")),
        modality: readableText(r.modality, lang === "es" ? "Modalidad no disponible" : "Modality unavailable"),
        date: String(r.date ?? ""),
        value: Number(r.value ?? 0),
        valueLabel: formatCop(Number(r.value ?? 0), lang),
        secopUrl: readableUrl(r.secop_url),
        pickReason: "",
        signal: "",
        factors: [],
      }));
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

    const filteredDepts = (activeDepartmentGeoName
      ? paddedAllDepts.filter((d) => d.geoName === activeDepartmentGeoName)
      : paddedAllDepts).filter((department) => department.geoName !== "NO DEFINIDO");

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

    const sourceFreshnessGapDays =
      (g.latestDate as string | null) && sourceData.latestDate
        ? Math.max(
            0,
            Math.round(
              (new Date(`${sourceData.latestDate}T00:00:00Z`).getTime() -
                new Date(`${g.latestDate as string}T00:00:00Z`).getTime()) /
                86_400_000,
            ),
          )
        : null;

    // ── 5. Compose OverviewPayload ───────────────────────────────────────────
    const payload: OverviewPayload = {
      meta: {
        lang,
        fullDataset: true,
        totalRows: g.totalRows as number,
        shownRows: hasFilters ? sliceTotal : (g.totalRows as number),
        previewRows: Math.min(hasFilters ? sliceTotal : (g.totalRows as number), 48),
        latestContractDate: g.latestDate as string | null,
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
          ? allDepts.find((department) => department.geoName === activeDepartmentGeoName)?.avgRisk ?? null
          : null,
        sliceMedianValue: sliceMedian,
      },
      leadCases: filteredLeadCases,
      summaries: {
        entities: (g.entities as OverviewPayload["summaries"]["entities"]) ?? [],
        modalities: (g.modalities as OverviewPayload["summaries"]["modalities"]) ?? [],
      },
      analytics: {
        departments: paddedAllDepts.filter((department) => department.geoName !== "NO DEFINIDO"),
        modalities: (g.modalities as OverviewPayload["analytics"]["modalities"]) ?? [],
        entities: (g.entities as OverviewPayload["analytics"]["entities"]) ?? [],
        months: (g.months as OverviewPayload["analytics"]["months"]) ?? [],
        riskBands: (g.riskBands as OverviewPayload["analytics"]["riskBands"]) ?? [],
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
