/**
 * SSR/RSC sanitizer for contract data.
 *
 * Runs server-side BEFORE the OverviewPayload / TablePayload / freshness
 * payload is serialized into the React Server Component stream. Cleans:
 *   - currency labels (collapse "$$" → "$"; recompute from numeric value
 *     when present, so stale Supabase-cached strings can never leak)
 *   - public-facing entity names (strip trailing "//", "**", "*", accidental
 *     numeric suffix glued to all-caps tokens)
 *
 * Does NOT touch:
 *   - numeric values, scores, risk bands
 *   - SECOP URLs / contract IDs (raw fields used for official-source matching)
 *   - dates
 *
 * Note: a single Supabase row (`contracts_stats.global`) caches pre-computed
 * leadCases with their `valueLabel` strings. When the central formatter
 * changes, those cached strings drift until the import script re-runs. The
 * sanitizer authoritatively re-derives every `valueLabel` and
 * `prioritizedValueLabel` from its numeric counterpart, so a public payload
 * cannot ship a label that disagrees with the current `formatCompactCop`.
 */
import { displayEntityName, formatCompactCop, normalizeCurrencyPrefix } from "@/lib/format";
import type {
  ContractsFreshnessPayload,
  Lang,
  LeadCase,
  OverviewPayload,
  TablePayload,
  TableRow,
} from "@/lib/types";

function safeCurrencyLabel(value: number | null | undefined, fallback: string, lang: Lang): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return formatCompactCop(value, lang);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return formatCompactCop(parsed, lang);
  }
  return normalizeCurrencyPrefix(fallback);
}

function cleanLeadCase(row: LeadCase, lang: Lang): LeadCase {
  return {
    ...row,
    entity: displayEntityName(row.entity),
    provider: displayEntityName(row.provider),
    valueLabel: safeCurrencyLabel(row.value, row.valueLabel, lang),
  };
}

function cleanTableRow(row: TableRow, lang: Lang): TableRow {
  return {
    ...row,
    entity: displayEntityName(row.entity),
    provider: displayEntityName(row.provider),
    valueLabel: safeCurrencyLabel(row.value, row.valueLabel, lang),
  };
}

export function sanitizeContractOverviewForPublic(
  input: OverviewPayload,
  lang: Lang = "es",
): OverviewPayload {
  return {
    ...input,
    slice: {
      ...input.slice,
      prioritizedValueLabel: safeCurrencyLabel(
        input.slice.prioritizedValue,
        input.slice.prioritizedValueLabel,
        lang,
      ),
      dominantDepartment: input.slice.dominantDepartment,
    },
    leadCases: (input.leadCases ?? []).map((row) => cleanLeadCase(row, lang)),
    summaries: {
      entities: (input.summaries?.entities ?? []).map((row) => ({
        ...row,
        nombre_entidad: displayEntityName(row.nombre_entidad),
      })),
      modalities: input.summaries?.modalities ?? [],
    },
    analytics: {
      ...input.analytics,
      entities: (input.analytics?.entities ?? []).map((row) => ({
        ...row,
        nombre_entidad: displayEntityName(row.nombre_entidad),
      })),
    },
    liveFeed: {
      ...input.liveFeed,
      contracts: (input.liveFeed?.contracts ?? []).map((row) => ({
        ...row,
        entity: displayEntityName(row.entity),
        valueLabel: safeCurrencyLabel(row.value, row.valueLabel, lang),
      })),
    },
  };
}

export function sanitizeContractsTableForPublic(
  input: TablePayload,
  lang: Lang = "es",
): TablePayload {
  return {
    total: input.total,
    rows: (input.rows ?? []).map((row) => cleanTableRow(row, lang)),
  };
}

export function sanitizeFreshnessForPublic(
  input: ContractsFreshnessPayload,
  lang: Lang = "es",
): ContractsFreshnessPayload {
  return {
    ...input,
    liveFeed: {
      ...input.liveFeed,
      contracts: (input.liveFeed?.contracts ?? []).map((row) => ({
        ...row,
        entity: displayEntityName(row.entity),
        valueLabel: safeCurrencyLabel(row.value, row.valueLabel, lang),
      })),
    },
  };
}
