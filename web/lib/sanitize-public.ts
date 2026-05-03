/**
 * SSR/RSC sanitizer for contract data.
 *
 * Runs server-side BEFORE the OverviewPayload / TablePayload / freshness
 * payload is serialized into the React Server Component stream. Cleans:
 *   - currency labels (collapse "$$" → "$")
 *   - public-facing entity names (strip trailing "//", "**", "*", accidental
 *     numeric suffix glued to all-caps tokens)
 *
 * Does NOT touch:
 *   - numeric values, scores, risk bands
 *   - SECOP URLs / contract IDs (raw fields used for official-source matching)
 *   - dates
 */
import { displayEntityName, normalizeCurrencyPrefix } from "@/lib/format";
import type {
  ContractsFreshnessPayload,
  LeadCase,
  OverviewPayload,
  TablePayload,
  TableRow,
} from "@/lib/types";

function cleanLeadCase(row: LeadCase): LeadCase {
  return {
    ...row,
    entity: displayEntityName(row.entity),
    provider: displayEntityName(row.provider),
    valueLabel: normalizeCurrencyPrefix(row.valueLabel),
  };
}

function cleanTableRow(row: TableRow): TableRow {
  return {
    ...row,
    entity: displayEntityName(row.entity),
    provider: displayEntityName(row.provider),
    valueLabel: normalizeCurrencyPrefix(row.valueLabel),
  };
}

export function sanitizeContractOverviewForPublic(
  input: OverviewPayload,
): OverviewPayload {
  return {
    ...input,
    slice: {
      ...input.slice,
      prioritizedValueLabel: normalizeCurrencyPrefix(input.slice.prioritizedValueLabel),
      dominantDepartment: input.slice.dominantDepartment,
    },
    leadCases: (input.leadCases ?? []).map(cleanLeadCase),
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
        valueLabel: normalizeCurrencyPrefix(row.valueLabel),
      })),
    },
  };
}

export function sanitizeContractsTableForPublic(input: TablePayload): TablePayload {
  return {
    total: input.total,
    rows: (input.rows ?? []).map(cleanTableRow),
  };
}

export function sanitizeFreshnessForPublic(
  input: ContractsFreshnessPayload,
): ContractsFreshnessPayload {
  return {
    ...input,
    liveFeed: {
      ...input.liveFeed,
      contracts: (input.liveFeed?.contracts ?? []).map((row) => ({
        ...row,
        entity: displayEntityName(row.entity),
        valueLabel: normalizeCurrencyPrefix(row.valueLabel),
      })),
    },
  };
}
