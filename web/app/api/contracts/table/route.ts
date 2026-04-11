import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, formatCop } from "@/lib/supabase-server";
import type { TablePayload, TableRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const lang = searchParams.get("lang") ?? "es";
    const department = searchParams.get("department") ?? undefined;
    const risk = searchParams.get("risk") ?? "all";
    const modality = searchParams.get("modality") ?? undefined;
    const dateFrom = searchParams.get("date_from") ?? undefined;
    const dateTo = searchParams.get("date_to") ?? undefined;
    const queryText = searchParams.get("query") ?? undefined;
    const offset = Number(searchParams.get("offset") ?? 0);
    const limit = Math.min(Number(searchParams.get("limit") ?? 24), 100);

    const sb = createServerSupabase();

    let q = sb
      .from("contracts")
      .select(
        "id, entity, provider, department, modality, date, value, risk_score, risk_bucket, secop_url",
        { count: "exact" },
      )
      .order("risk_score", { ascending: false })
      .order("value", { ascending: false })
      .range(offset, offset + limit - 1);

    if (department) q = q.eq("department", department);
    if (risk === "high") q = q.eq("risk_bucket", "high");
    else if (risk === "medium") q = q.eq("risk_bucket", "medium");
    if (modality) q = q.eq("modality", modality);
    if (dateFrom) q = q.gte("date", dateFrom);
    if (dateTo) q = q.lte("date", dateTo);
    if (queryText) q = q.ilike("entity", `%${queryText}%`);

    const { data, count, error } = await q;

    if (error) {
      console.error("[/api/contracts/table]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows: TableRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id ?? ""),
      score: Math.round((r.risk_score as number) * 100),
      riskBand: (r.risk_bucket === "high" ? "high" : "medium") as TableRow["riskBand"],
      entity: String(r.entity ?? ""),
      provider: String(r.provider ?? ""),
      department: String(r.department ?? ""),
      modality: String(r.modality ?? ""),
      date: String(r.date ?? ""),
      value: Number(r.value ?? 0),
      valueLabel: formatCop(Number(r.value ?? 0), lang),
      secopUrl: String(r.secop_url ?? ""),
    }));

    const payload: TablePayload = { total: count ?? 0, rows };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[/api/contracts/table]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
