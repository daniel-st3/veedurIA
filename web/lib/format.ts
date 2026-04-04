import type { Lang } from "@/lib/types";

export function formatCompactCop(value: number, lang: Lang): string {
  if (!Number.isFinite(value) || value <= 0) {
    return lang === "es" ? "Sin dato" : "No data";
  }

  if (value >= 1_000_000_000_000) {
    return lang === "es"
      ? `$${(value / 1_000_000_000_000).toFixed(1)} billones COP`
      : `$${(value / 1_000_000_000_000).toFixed(1)}T COP`;
  }

  if (value >= 1_000_000_000) {
    return lang === "es"
      ? `$${(value / 1_000_000_000).toFixed(1)} mil millones COP`
      : `$${(value / 1_000_000_000).toFixed(1)}B COP`;
  }

  if (value >= 1_000_000) {
    return lang === "es"
      ? `$${(value / 1_000_000).toFixed(1)} millones COP`
      : `$${(value / 1_000_000).toFixed(1)}M COP`;
  }

  return new Intl.NumberFormat(lang === "es" ? "es-CO" : "en-US", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function normalizeCurrencyLabel(label: string | null | undefined): string {
  if (!label) return "";
  return label.replace(/^\$+/, "$").replace(/\s+/g, " ").trim();
}
