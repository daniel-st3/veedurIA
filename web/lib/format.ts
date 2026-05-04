import type { Lang } from "@/lib/types";

const COP_PREFIX = "$";

function isMissing(value: number | null | undefined): boolean {
  return value === null || value === undefined || typeof value !== "number" || !Number.isFinite(value);
}

/**
 * Single-source COP value formatter. Returns one currency prefix only —
 * never produces "$$" because callers must not prepend "$" themselves.
 *
 *   missing  -> "Sin dato" / "No data"
 *   0        -> "$ 0" / "COP $0"
 *   1        -> "$ 1" / "COP $1"
 *   <1k      -> e.g. "$850" / "COP $850"
 *   <1M      -> e.g. "$25.300" / "COP $25,300"
 *   <1B      -> "$924.9 millones COP" / "COP $924.9M"
 *   <1T      -> "$30.0 mil millones COP" / "COP $30.0B"
 *   ≥1T      -> "$1.2 billones COP" / "COP $1.2T"
 */
export function formatCompactCop(value: number | null | undefined, lang: Lang): string {
  if (isMissing(value)) {
    return lang === "es" ? "Sin dato" : "No data";
  }
  const v = value as number;
  // 0 and 1 are SECOP sentinel/missing values, not meaningful contract amounts.
  // Surface them as "no value on record" rather than misleading "$0" / "$1".
  if (v === 0 || v === 1) {
    return lang === "es" ? "Sin valor registrado" : "No value on record";
  }
  if (v < 0) {
    return lang === "es" ? "Sin dato" : "No data";
  }

  if (v >= 1_000_000_000_000) {
    return lang === "es"
      ? `${COP_PREFIX}${(v / 1_000_000_000_000).toFixed(1)} billones COP`
      : `COP ${COP_PREFIX}${(v / 1_000_000_000_000).toFixed(1)}T`;
  }
  if (v >= 1_000_000_000) {
    return lang === "es"
      ? `${COP_PREFIX}${(v / 1_000_000_000).toFixed(1)} mil millones COP`
      : `COP ${COP_PREFIX}${(v / 1_000_000_000).toFixed(1)}B`;
  }
  if (v >= 1_000_000) {
    return lang === "es"
      ? `${COP_PREFIX}${(v / 1_000_000).toFixed(1)} millones COP`
      : `COP ${COP_PREFIX}${(v / 1_000_000).toFixed(1)}M`;
  }

  const intl = new Intl.NumberFormat(lang === "es" ? "es-CO" : "en-US", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v);
  return lang === "es" ? intl : `COP ${intl.replace(/^COP\s*/, "")}`;
}

export type CopBadgeKind = "missing" | "zero" | "one" | "high" | "none";

export interface CopValue {
  label: string;
  badge: string;
  badgeKind: CopBadgeKind;
}

const HIGH_VALUE_THRESHOLD = 1_000_000_000_000; // ≥ 1 trillion COP

export function formatCopValue(value: number | null | undefined, lang: Lang): CopValue {
  const label = formatCompactCop(value, lang);
  if (isMissing(value)) {
    return {
      label,
      badge: lang === "es" ? "Valor no disponible en campo importado" : "Value unavailable in imported field",
      badgeKind: "missing",
    };
  }
  const v = value as number;
  if (v === 0) {
    return {
      label,
      badge: lang === "es" ? "Valor reportado como cero en fuente oficial" : "Reported as zero in official source",
      badgeKind: "zero",
    };
  }
  if (v === 1) {
    return {
      label,
      badge: lang === "es" ? "Valor reportado en fuente oficial" : "Reported in official source",
      badgeKind: "one",
    };
  }
  if (v >= HIGH_VALUE_THRESHOLD) {
    return {
      label,
      badge: lang === "es" ? "Valor alto: revisar expediente" : "High value: check official record",
      badgeKind: "high",
    };
  }
  return { label, badge: "", badgeKind: "none" };
}

/**
 * Defensive: collapse any "$$" / "$$$" anywhere in the string to a single "$".
 * Use this when serializing labels to RSC props or rendering legacy preformatted
 * fields that might already have a "$" prefix, to ensure the public surface
 * never shows "$$25.2 millones COP".
 */
export function normalizeCurrencyPrefix(label: string | null | undefined): string {
  if (!label) return "";
  return label
    .replace(/\${2,}/g, "$")
    .replace(/COP\s*\$\s*\$/g, "COP $")
    .replace(/\s+/g, " ")
    .trim();
}

// Backwards-compatible alias.
export const normalizeCurrencyLabel = normalizeCurrencyPrefix;

/**
 * Normalize a public entity name for display, stripping accidental
 * trailing artifacts that appear in the imported SECOP feed:
 *   "DEPARTAMENTO DE ANTIOQUIA//"   -> "DEPARTAMENTO DE ANTIOQUIA"
 *   "GOBERNACIÓN DE BOLÍVAR//"      -> "GOBERNACIÓN DE BOLÍVAR"
 *   "FONDO ROTATORIO**"             -> "FONDO ROTATORIO"
 *   "INDER ENVIGADO1"               -> "INDER ENVIGADO"
 *   "MUNICIPIO DE ENVIGADO*"        -> "MUNICIPIO DE ENVIGADO"
 *   "BATALLON ... No 4"             -> unchanged (No is meaningful)
 *
 * Keep the raw value internally for traceability and source matching.
 */
export function displayEntityName(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw).trim();
  // strip trailing whitespace + slashes, asterisks, pipes (common scrape junk)
  s = s.replace(/[\s/*|]+$/g, "");
  // strip a single accidental numeric suffix glued to an all-caps token,
  // e.g. "INDER ENVIGADO1" or "PUERTO CARREÑO1". Only apply when the
  // suffix is 1-3 digits attached directly to a letter and the preceding
  // word is at least 3 chars and uppercase. Do NOT strip "No 4" / "BATALLON 4".
  s = s.replace(/(?<=[A-ZÁÉÍÓÚÑ]{3,})\d{1,3}$/u, "");
  return s.replace(/\s+/g, " ").trim();
}
