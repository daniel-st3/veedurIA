import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, formatCop } from "@/lib/supabase-server";
import { departmentFilterVariants, deptDisplayLabel } from "@/lib/colombia-departments";
import { displayEntityName } from "@/lib/format";
import type { TablePayload, TableRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const departmentFilters = departmentFilterVariants(department);

    const sb = createServerSupabase();

    let q = sb
      .from("contracts")
      .select("id, entity, provider, department, modality, date, value, risk_score, risk_bucket, secop_url, object_desc", { count: "exact" })
      .order("risk_score", { ascending: false })
      .order("value", { ascending: false })
      .range(offset, offset + limit - 1);

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

    const { data, count, error } = await q;

    if (error) {
      console.error("[/api/contracts/table]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows: TableRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id ?? ""),
      score: Math.round((r.risk_score as number) * 100),
      riskBand: ((r.risk_bucket as string) === "high" ? "high" : (r.risk_bucket as string) === "medium" ? "medium" : "low") as TableRow["riskBand"],
      entity: displayEntityName(readableText(r.entity, lang === "es" ? "Entidad sin nombre disponible" : "Entity name unavailable")),
      provider: readableText(r.provider, lang === "es" ? "Proveedor no disponible" : "Provider unavailable"),
      department: deptDisplayLabel(String(r.department ?? "")),
      modality: readableText(r.modality, lang === "es" ? "Modalidad no disponible" : "Modality unavailable"),
      date: String(r.date ?? "").slice(0, 10) || (lang === "es" ? "Fecha no disponible" : "Date unavailable"),
      value: Number(r.value ?? 0),
      valueLabel: formatCop(Number(r.value ?? 0), lang),
      secopUrl: readableUrl(r.secop_url),
    }));

    const payload: TablePayload = { total: count ?? 0, rows };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    console.error("[/api/contracts/table]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
