import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, formatCop } from "@/lib/supabase-server";
import type { ContractsFreshnessPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOCRATA_SUMMARY =
  "https://www.datos.gov.co/resource/jbjy-vk9h.json" +
  "?$select=max(fecha_de_firma)%20as%20max_fecha,%20count(*)%20as%20total&$limit=1";

const SOCRATA_LATEST =
  "https://www.datos.gov.co/resource/jbjy-vk9h.json" +
  "?$select=fecha_de_firma,id_contrato,nombre_entidad,valor_del_contrato,departamento,urlproceso" +
  "&$order=fecha_de_firma%20DESC,id_contrato%20ASC&$limit=5";

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang") ?? "es";

  // Fetch SECOP live data and local stats in parallel
  const [socrataRes, latestRes, statsRes] = await Promise.allSettled([
    fetch(SOCRATA_SUMMARY, { next: { revalidate: 3600 } }),
    fetch(SOCRATA_LATEST, { next: { revalidate: 3600 } }),
    createServerSupabase()
      .from("contracts_stats")
      .select("data, updated_at")
      .eq("key", "global")
      .single(),
  ]);

  let sourceRows: number | null = null;
  let sourceLatestDate: string | null = null;

  if (socrataRes.status === "fulfilled" && socrataRes.value.ok) {
    try {
      const json = await socrataRes.value.json();
      sourceRows = json?.[0]?.total ? Number(json[0].total) : null;
      sourceLatestDate = json?.[0]?.max_fecha?.slice(0, 10) ?? null;
    } catch { /* ignore */ }
  }

  let liveFeedContracts: ContractsFreshnessPayload["liveFeed"]["contracts"] = [];

  if (latestRes.status === "fulfilled" && latestRes.value.ok) {
    try {
      const rows = await latestRes.value.json();
      liveFeedContracts = (Array.isArray(rows) ? rows : []).slice(0, 5).map((r: Record<string, unknown>) => {
        const urlproceso = r.urlproceso as Record<string, string> | string | null;
        const secopUrl =
          typeof urlproceso === "object" && urlproceso !== null
            ? String(urlproceso.url ?? "")
            : String(urlproceso ?? "");
        const value = Number(String(r.valor_del_contrato ?? "0").replace(/[^\d.-]/g, "") || 0);
        return {
          id: String(r.id_contrato ?? ""),
          entity: String(r.nombre_entidad ?? ""),
          department: String(r.departamento ?? ""),
          date: String(r.fecha_de_firma ?? "").slice(0, 10),
          value,
          valueLabel: formatCop(value, lang),
          secopUrl,
        };
      });
    } catch { /* ignore */ }
  }

  const statsData =
    statsRes.status === "fulfilled" && !statsRes.value.error
      ? (statsRes.value.data?.data as Record<string, unknown>)
      : null;

  const scoredLatestDate = statsData?.latestDate as string | null ?? null;

  // Gap between scored data and SECOP source
  let gapDays: number | null = null;
  if (scoredLatestDate && sourceLatestDate) {
    const diff =
      new Date(`${sourceLatestDate}T00:00:00Z`).getTime() -
      new Date(`${scoredLatestDate}T00:00:00Z`).getTime();
    gapDays = Math.max(0, Math.round(diff / 86_400_000));
  }

  const payload: ContractsFreshnessPayload = {
    latestContractDate: scoredLatestDate,
    sourceLatestContractDate: sourceLatestDate,
    sourceFreshnessGapDays: gapDays,
    sourceRows,
    sourceUpdatedAt: null,
    liveFeed: {
      latestDate: sourceLatestDate,
      rowsAtSource: sourceRows,
      contracts: liveFeedContracts,
    },
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
  });
}
