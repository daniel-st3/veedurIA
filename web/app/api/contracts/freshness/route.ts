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
const SOURCE_FETCH_TIMEOUT_MS = 10_000;
const MAX_ALLOWED_GAP_DAYS = 2;

async function fetchJson(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`SECOP request failed: ${response.status}`);
  return response.json();
}

function daysBetween(later: string | null, earlier: string | null) {
  if (!later || !earlier) return null;
  const left = new Date(`${later.slice(0, 10)}T00:00:00Z`).getTime();
  const right = new Date(`${earlier.slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.max(0, Math.round((left - right) / 86_400_000));
}

function isoDate(raw: string | null | undefined) {
  if (!raw) return null;
  const normalized = raw.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function readableText(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang") ?? "es";

  // Fetch each SECOP request with its own timeout so a slow count query does
  // not cancel the lighter latest-contract feed.
  const [socrataRes, latestRes, metadataRes, statsRes] = await Promise.allSettled([
    fetchJson(SOCRATA_SUMMARY),
    fetchJson(SOCRATA_LATEST),
    fetchJson(SOCRATA_METADATA),
    createServerSupabase()
      .from("contracts_stats")
      .select("data, updated_at")
      .eq("key", "global")
      .single(),
  ]);

  let sourceRows: number | null = null;
  let sourceLatestDate: string | null = null;
  let sourceUpdatedAt: string | null = null;

  if (socrataRes.status === "fulfilled") {
    try {
      const json = socrataRes.value;
      sourceRows = json?.[0]?.total ? Number(json[0].total) : null;
      sourceLatestDate = json?.[0]?.max_fecha?.slice(0, 10) ?? null;
    } catch { /* ignore */ }
  }

  if (metadataRes.status === "fulfilled") {
    try {
      const metadata = metadataRes.value;
      sourceUpdatedAt = metadata?.dataUpdatedAt ?? null;
    } catch { /* ignore */ }
  }

  let liveFeedContracts: ContractsFreshnessPayload["liveFeed"]["contracts"] = [];

  if (latestRes.status === "fulfilled") {
    try {
      const rows = latestRes.value;
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
      sourceLatestDate ??= liveFeedContracts.find((contract) => contract.date && contract.date !== "Sin fecha" && contract.date !== "No date")?.date ?? null;
    } catch { /* ignore */ }
  }

  const statsData =
    statsRes.status === "fulfilled" && !statsRes.value.error
      ? (statsRes.value.data?.data as Record<string, unknown>)
      : null;

  const scoredLatestDate = (statsData?.latestDate as string | null) ?? null;
  const scoringRunAt =
    statsRes.status === "fulfilled" && !statsRes.value.error
      ? (statsRes.value.data?.updated_at as string | null)
      : null;
  const sourceFreshnessGapDays = daysBetween(sourceLatestDate, scoredLatestDate);
  const operationalGapDays = daysBetween(
    isoDate(sourceUpdatedAt) ?? sourceLatestDate,
    isoDate(scoringRunAt) ?? scoredLatestDate,
  );

  const payload: ContractsFreshnessPayload = {
    latestContractDate: scoredLatestDate,
    sourceLatestContractDate: sourceLatestDate,
    sourceFreshnessGapDays,
    scoringRunAt,
    operationalGapDays,
    maxAllowedGapDays: MAX_ALLOWED_GAP_DAYS,
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
