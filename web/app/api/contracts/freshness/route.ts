import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, formatCop } from "@/lib/supabase-server";
import { deptDisplayLabel } from "@/lib/colombia-departments";
import type { ContractsFreshnessPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOCRATA_SUMMARY =
  "https://www.datos.gov.co/resource/jbjy-vk9h.json" +
  "?$select=max(fecha_de_firma)%20as%20max_fecha,%20count(*)%20as%20total&$limit=1";

const SOCRATA_LATEST =
  "https://www.datos.gov.co/resource/jbjy-vk9h.json" +
  "?$where=fecha_de_firma%20IS%20NOT%20NULL%20AND%20nombre_entidad%20IS%20NOT%20NULL%20AND%20departamento%20IS%20NOT%20NULL" +
  "&$select=fecha_de_firma,id_contrato,nombre_entidad,valor_del_contrato,departamento,urlproceso" +
  "&$order=fecha_de_firma%20DESC,id_contrato%20ASC&$limit=5";
const SOCRATA_METADATA = "https://www.datos.gov.co/api/views/metadata/v1/jbjy-vk9h";
const SOURCE_FETCH_TIMEOUT_MS = 4000;

function readableText(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang") ?? "es";
  const signal = AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS);

  // Fetch SECOP live data and local stats in parallel
  const [socrataRes, latestRes, metadataRes, statsRes] = await Promise.allSettled([
    fetch(SOCRATA_SUMMARY, { cache: "no-store", signal }),
    fetch(SOCRATA_LATEST, { cache: "no-store", signal }),
    fetch(SOCRATA_METADATA, { cache: "no-store", signal }),
    createServerSupabase()
      .from("contracts_stats")
      .select("data, updated_at")
      .eq("key", "global")
      .single(),
  ]);

  let sourceRows: number | null = null;
  let sourceLatestDate: string | null = null;
  let sourceUpdatedAt: string | null = null;

  if (socrataRes.status === "fulfilled" && socrataRes.value.ok) {
    try {
      const json = await socrataRes.value.json();
      sourceRows = json?.[0]?.total ? Number(json[0].total) : null;
      sourceLatestDate = json?.[0]?.max_fecha?.slice(0, 10) ?? null;
    } catch { /* ignore */ }
  }

  if (metadataRes.status === "fulfilled" && metadataRes.value.ok) {
    try {
      const metadata = await metadataRes.value.json();
      sourceUpdatedAt = metadata?.dataUpdatedAt ?? null;
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
          entity: readableText(r.nombre_entidad, lang === "es" ? "Entidad sin nombre disponible" : "Entity name unavailable"),
          department: deptDisplayLabel(String(r.departamento ?? "")),
          date: r.fecha_de_firma ? String(r.fecha_de_firma).slice(0, 10) : (lang === "es" ? "Sin fecha" : "No date"),
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

  const scoredLatestDate = (statsData?.latestDate as string | null) ?? null;
  const effectiveLatestDate = scoredLatestDate ?? sourceLatestDate;
  const sourceFreshnessGapDays =
    scoredLatestDate && sourceLatestDate
      ? Math.max(
          0,
          Math.round(
            (new Date(`${sourceLatestDate}T00:00:00Z`).getTime() -
              new Date(`${scoredLatestDate}T00:00:00Z`).getTime()) /
              86_400_000,
          ),
        )
      : null;

  const payload: ContractsFreshnessPayload = {
    latestContractDate: effectiveLatestDate,
    sourceLatestContractDate: sourceLatestDate,
    sourceFreshnessGapDays,
    sourceRows,
    sourceUpdatedAt,
    liveFeed: {
      latestDate: sourceLatestDate,
      rowsAtSource: sourceRows,
      contracts: liveFeedContracts,
    },
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
