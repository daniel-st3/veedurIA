import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, deptGeoName, formatCop } from "@/lib/supabase-server";
import type { OverviewPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Official SECOP Socrata endpoint for live source count
const SOCRATA_SUMMARY =
  "https://www.datos.gov.co/resource/jbjy-vk9h.json" +
  "?$select=max(fecha_de_firma)%20as%20max_fecha,%20count(*)%20as%20total&$limit=1";

async function fetchSourceCount(): Promise<{ rows: number | null; latestDate: string | null }> {
  try {
    const res = await fetch(SOCRATA_SUMMARY, { next: { revalidate: 3600 } });
    if (!res.ok) return { rows: null, latestDate: null };
    const json = await res.json();
    return {
      rows: json?.[0]?.total ? Number(json[0].total) : null,
      latestDate: json?.[0]?.max_fecha?.slice(0, 10) ?? null,
    };
  } catch {
    return { rows: null, latestDate: null };
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

      if (department) q = q.eq("department", department);
      if (risk === "high") q = q.eq("risk_bucket", "high");
      else if (risk === "medium") q = q.eq("risk_bucket", "medium");
      if (modality) q = q.eq("modality", modality);
      if (dateFrom) q = q.gte("date", dateFrom);
      if (dateTo) q = q.lte("date", dateTo);
      if (queryText) q = q.ilike("entity", `%${queryText}%`);

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
        riskBand: (r.risk_bucket === "high" ? "high" : "medium") as "high" | "medium" | "low",
        entity: String(r.entity ?? ""),
        provider: String(r.provider ?? ""),
        department: String(r.department ?? ""),
        modality: String(r.modality ?? ""),
        date: String(r.date ?? ""),
        value: Number(r.value ?? 0),
        valueLabel: formatCop(Number(r.value ?? 0), lang),
        secopUrl: String(r.secop_url ?? ""),
        pickReason: "",
        signal: "",
        factors: [],
      }));
    }

    // ── 3. Fetch live SECOP source count (non-blocking) ──────────────────────
    const sourceData = await fetchSourceCount();

    // ── 4. Build departments from global stats ───────────────────────────────
    const allDepts = (g.departments as Array<{
      key: string; label: string; geoName: string; avgRisk: number; contractCount: number;
    }>) ?? [];

    const filteredDepts = department
      ? allDepts.filter((d) => d.key === department)
      : allDepts;

    // ── 5. Compose OverviewPayload ───────────────────────────────────────────
    const payload: OverviewPayload = {
      meta: {
        lang,
        fullDataset: true,
        totalRows: g.totalRows as number,
        shownRows: g.totalRows as number,
        previewRows: Math.min(g.totalRows as number, 48),
        latestContractDate: g.latestDate as string | null,
        sourceLatestContractDate: sourceData.latestDate,
        sourceRows: sourceData.rows,
        sourceFreshnessGapDays: null,
        sourceUpdatedAt: null,
        lastRunTs: statsRow.updated_at as string,
      },
      options: {
        departments: ((g.deptOptions as string[]) ?? []).map((d) => ({ value: d, label: d.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) })),
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
        dominantDepartment: sliceDominant,
      },
      benchmarks: {
        nationalMeanRisk: g.meanRisk as number,
        sliceMeanRisk: sliceMean,
        sliceMedianValue: sliceMedian,
      },
      leadCases: filteredLeadCases,
      summaries: {
        entities: (g.entities as OverviewPayload["summaries"]["entities"]) ?? [],
        modalities: (g.modalities as OverviewPayload["summaries"]["modalities"]) ?? [],
      },
      analytics: {
        departments: allDepts,
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
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error("[/api/contracts/overview]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
