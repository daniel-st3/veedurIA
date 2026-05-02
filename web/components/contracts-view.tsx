"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import {
  ArrowUpRight,
  Bookmark,
  Download,
  Filter,
  LoaderCircle,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { ColombiaMap } from "@/components/colombia-map";
import { ContractsDashboard } from "@/components/contracts-dashboard";
import { LoadingStage } from "@/components/loading-stage";
import { NoticeStack, type NoticeItem } from "@/components/notice-stack";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { fetchContractsFreshness, fetchContractsTable, fetchGeoJson, fetchOverview } from "@/lib/api";
import { contractsCopy } from "@/lib/copy";
import { displayEntityName, formatCompactCop, formatCopValue, normalizeCurrencyPrefix } from "@/lib/format";
import type { ContractsFreshnessPayload, Lang, LeadCase, OverviewPayload, TablePayload } from "@/lib/types";

gsap.registerPlugin(ScrollTrigger);

type FilterState = {
  department?: string;
  risk: "all" | "high" | "medium" | "low";
  modality?: string;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  full: boolean;
};

type ExplorerGroupKey = "department" | "modality" | "entity";

type SavedSearch = {
  id: string;
  label: string;
  filters: FilterState;
  resultCount: number;
};

const INITIAL_FILTERS: FilterState = {
  department: undefined,
  risk: "all",
  modality: undefined,
  query: "",
  dateFrom: "",
  dateTo: "",
  full: false,
};

const MODEL_GROUPS = {
  es: [
    {
      title: "Competencia",
      items: [
        "Número de oferentes",
        "Único oferente habilitado",
        "Modalidad directa frente al patrón típico",
      ],
    },
    {
      title: "Precio y valor",
      items: [
        "Valor del contrato frente a contratos comparables",
        "Relación entre precio y referencia de la entidad",
        "Pagos anticipados atípicos",
      ],
    },
    {
      title: "Concentración",
      items: [
        "Reincidencia proveedor–entidad",
        "Porción del valor que concentra un proveedor",
        "Edad y tamaño relativo del proveedor",
      ],
    },
    {
      title: "Tiempo",
      items: [
        "Ventana preelectoral",
        "Periodo de Ley de Garantías",
        "Cierre fiscal de fin de año",
      ],
    },
  ],
  en: [
    {
      title: "Competition",
      items: [
        "Number of bidders",
        "Single qualified bidder",
        "Direct-award modality against the usual pattern",
      ],
    },
    {
      title: "Price and value",
      items: [
        "Contract value against comparable contracts",
        "Price ratio against entity reference",
        "Atypical advance payments",
      ],
    },
    {
      title: "Concentration",
      items: [
        "Provider–entity recurrence",
        "Share of value concentrated in one provider",
        "Provider age and relative size",
      ],
    },
    {
      title: "Timing",
      items: [
        "Pre-electoral window",
        "Guarantees Law restricted period",
        "Year-end fiscal rush",
      ],
    },
  ],
};

function ContractsLoading({ lang }: { lang: Lang }) {
  const [phase, setPhase] = useState<"loading" | "stuck">("loading");
  useEffect(() => {
    const id = window.setTimeout(() => setPhase("stuck"), 12000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <main className="page cv-page">
      <section className="surface stripe-flag" style={{ marginTop: "1.2rem", padding: "1.2rem" }}>
        <LoadingStage lang={lang} context="contracts" compact />
        <p className="cv-loading-note" role="status">
          {lang === "es"
            ? "ContratoLimpio está cargando la vista interactiva. Si esta pantalla no avanza, revisa la conexión o vuelve a intentarlo. La fuente oficial puede tardar en responder."
            : "ContratoLimpio is loading the interactive view. If this screen does not progress, check your connection or try again. The official source may take time to respond."}
        </p>
        {phase === "stuck" ? (
          <div className="cv-loading-stuck">
            <strong>
              {lang === "es"
                ? "La carga está tardando más de lo normal."
                : "Loading is taking longer than usual."}
            </strong>
            <p>
              {lang === "es"
                ? "Puedes recargar la página, volver al inicio o revisar la metodología y los límites legales mientras se restablece la fuente."
                : "You can reload the page, go back home, or review the methodology and legal limits while the source recovers."}
            </p>
            <div className="cv-loading-stuck__actions">
              <a className="btn-secondary" href={`/?lang=${lang}`}>
                {lang === "es" ? "Volver al inicio" : "Back home"}
              </a>
              <a className="btn-secondary" href={`/metodologia?lang=${lang}`}>
                {lang === "es" ? "Metodología" : "Methodology"}
              </a>
              <a className="btn-secondary" href={`/etica-y-privacidad?lang=${lang}`}>
                {lang === "es" ? "Límites legales" : "Legal limits"}
              </a>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function normalizeIso(raw?: string | null) {
  if (!raw) return "";
  return raw.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
}

function firstPositiveNumber(...values: Array<number | null | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value) && value > 0) ?? null;
}

function formatPortalUpdated(lang: Lang, raw?: string | null) {
  if (!raw) return lang === "es" ? "sin dato" : "no data";
  const date = new Date(normalizeIso(raw));
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(lang === "es" ? "es-CO" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(date).replace(/[\u00a0\u202f]/g, " ");
}

function scoreTone(score: number) {
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function riskSentence(lang: Lang, riskBand: LeadCase["riskBand"]) {
  if (riskBand === "high") {
    return lang === "es"
      ? "Este contrato se aparta con claridad del comportamiento más común del corte y conviene revisarlo primero."
      : "This contract clearly departs from the most common behavior in the slice and should be reviewed first.";
  }
  if (riskBand === "medium") {
    return lang === "es"
      ? "Hay una desviación visible, pero necesita contraste con el resto del corte antes de concluir."
      : "There is a visible deviation, but it needs contrast against the rest of the slice before any conclusion.";
  }
  return lang === "es"
    ? "Se parece más al comportamiento típico del conjunto y sirve como punto de comparación."
    : "It stays closer to the typical behavior of the set and works as a comparison point.";
}

/** Derive visible factors from case data when backend hasn't computed them */
function computeFallbackFactors(lang: Lang, item: LeadCase) {
  const factors: Array<{ key: string; label: string; severity: number }> = [];
  const modal = (item.modality ?? "").toLowerCase();
  const isDirect = modal.includes("directa") || modal.includes("direct") || modal.includes("contratación directa");
  if (isDirect) {
    factors.push({
      key: "direct_award",
      label: lang === "es" ? "Modalidad de contratación directa" : "Direct contracting modality",
      severity: 0.72,
    });
  }
  if (item.score >= 70) {
    factors.push({
      key: "anomaly_score",
      label: lang === "es" ? "Desvío global por encima del umbral de riesgo alto" : "Global deviation above the high-risk threshold",
      severity: Math.min(1, item.score / 100),
    });
  } else if (item.score >= 40) {
    factors.push({
      key: "anomaly_score",
      label: lang === "es" ? "Desvío moderado respecto al patrón típico del corte" : "Moderate deviation from the typical slice pattern",
      severity: Math.min(1, item.score / 100),
    });
  }
  if (item.riskBand === "high") {
    factors.push({
      key: "risk_band",
      label: lang === "es" ? "Clasificado en banda roja por el modelo de anomalías" : "Classified in the red band by the anomaly model",
      severity: 0.65,
    });
  } else if (item.riskBand === "medium") {
    factors.push({
      key: "risk_band",
      label: lang === "es" ? "Clasificado en banda ámbar — revisar con contexto" : "Classified in the amber band — review with context",
      severity: 0.45,
    });
  }
  return factors.slice(0, 3);
}

function bandLabel(lang: Lang, riskBand: LeadCase["riskBand"]) {
  if (riskBand === "high") return lang === "es" ? "Alto" : "High";
  if (riskBand === "medium") return lang === "es" ? "Medio" : "Medium";
  return lang === "es" ? "Bajo" : "Low";
}

function formatMoney(value: number, lang: Lang) {
  return new Intl.NumberFormat(lang === "es" ? "es-CO" : "en-US", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function hasSecopLink(url?: string | null) {
  return Boolean(url && /^https?:\/\//i.test(url));
}

function buildExplorerGroups(rows: TablePayload["rows"], groupBy: ExplorerGroupKey) {
  const labelFor = (row: TablePayload["rows"][number]) => {
    if (groupBy === "department") return row.department;
    if (groupBy === "modality") return row.modality;
    return row.entity;
  };

  const buckets = new Map<
    string,
    {
      label: string;
      count: number;
      totalValue: number;
      meanScore: number;
      peakScore: number;
    }
  >();

  rows.forEach((row) => {
    const label = labelFor(row) || "Sin dato";
    const current = buckets.get(label) ?? {
      label,
      count: 0,
      totalValue: 0,
      meanScore: 0,
      peakScore: 0,
    };
    current.count += 1;
    current.totalValue += row.value;
    current.meanScore += row.score;
    current.peakScore = Math.max(current.peakScore, row.score);
    buckets.set(label, current);
  });

  return [...buckets.values()]
    .map((item) => ({
      ...item,
      meanScore: item.count ? Math.round(item.meanScore / item.count) : 0,
    }))
    .sort((left, right) => right.peakScore - left.peakScore || right.totalValue - left.totalValue);
}

function downloadRows(rows: TablePayload["rows"], lang: Lang) {
  const header =
    lang === "es"
      ? ["id", "puntaje", "riesgo", "entidad", "proveedor", "departamento", "modalidad", "fecha", "valor"]
      : ["id", "score", "risk", "entity", "provider", "department", "modality", "date", "value"];

  const csv = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.score,
        row.riskBand,
        row.entity,
        row.provider,
        row.department,
        row.modality,
        row.date,
        row.value,
      ]
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "veeduria-contratos-corte-visible.csv";
  link.click();
  window.URL.revokeObjectURL(url);
}

function buildFilterQuery(lang: Lang, filters: FilterState) {
  const search = new URLSearchParams();
  if (lang !== "es") search.set("lang", lang);
  if (filters.department) search.set("dept", filters.department);
  if (filters.risk !== "all") search.set("risk", filters.risk);
  if (filters.modality) search.set("modality", filters.modality);
  if (filters.query?.trim()) search.set("q", filters.query.trim());
  if (filters.dateFrom) search.set("from", filters.dateFrom);
  if (filters.dateTo) search.set("to", filters.dateTo);
  if (filters.full) search.set("full", "1");
  return search.toString();
}

function isMeaningfulFilter(filters: FilterState) {
  return Boolean(
    filters.department ||
      filters.modality ||
      filters.query ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.risk !== "all" ||
      filters.full,
  );
}

function highlightText(value: string, query?: string) {
  const term = query?.trim();
  if (!term) return value;
  const matcher = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const segments = value.split(matcher);
  if (segments.length === 1) return value;
  return segments.map((segment, index) =>
    segment.toLowerCase() === term.toLowerCase() ? <mark key={`${segment}-${index}`}>{segment}</mark> : <span key={`${segment}-${index}`}>{segment}</span>,
  );
}

function monthBounds(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, monthIndex] = month.split("-").map(Number);
  const start = `${year}-${String(monthIndex).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year, monthIndex, 0)).toISOString().slice(0, 10);
  return { start, end };
}

function contractValueFlag(value: number | null | undefined, lang: Lang) {
  const { badge } = formatCopValue(value, lang);
  return badge || null;
}

export function ContractsView({
  lang,
  initialOverview,
  initialTable,
  initialGeojson,
  initialFilters = INITIAL_FILTERS,
}: {
  lang: Lang;
  initialOverview?: OverviewPayload | null;
  initialTable?: TablePayload | null;
  initialGeojson?: any | null;
  initialFilters?: FilterState;
}) {
  const scope = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const copy = contractsCopy[lang];
  const [draft, setDraft] = useState<FilterState>(initialFilters);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [overview, setOverview] = useState<OverviewPayload | null>(initialOverview ?? null);
  const [table, setTable] = useState<TablePayload | null>(initialTable ?? null);
  const [geojson, setGeojson] = useState<any>(initialGeojson ?? null);
  const [mapState, setMapState] = useState<"loading" | "ready" | "error">(initialGeojson ? "ready" : "loading");
  const [freshness, setFreshness] = useState<ContractsFreshnessPayload | null>(null);
  const [loading, setLoading] = useState(!initialOverview);
  const [tableLoading, setTableLoading] = useState(!initialTable);
  const [selectedCase, setSelectedCase] = useState<LeadCase | null>(initialOverview?.leadCases?.[0] ?? null);
  const [page, setPage] = useState(0);
  const [overviewInitialized, setOverviewInitialized] = useState(Boolean(initialOverview));
  const [tableInitialized, setTableInitialized] = useState(Boolean(initialTable));
  const [explorerGroup, setExplorerGroup] = useState<ExplorerGroupKey>("department");
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [actionPending, setActionPending] = useState(false);
  const [showGapExplanation, setShowGapExplanation] = useState(false);
  const pendingReason = useRef<"apply" | "reset" | "save" | "map" | "month" | null>(null);
  const syncingUrl = useRef(true);

  const loadGeojson = () => {
    setMapState("loading");
    return fetchGeoJson()
      .then((data) => {
        if (data) {
          setGeojson(data);
          setMapState("ready");
          return;
        }
        setMapState("error");
      })
      .catch(() => {
        setMapState("error");
      });
  };

  const pushNotice = (tone: NoticeItem["tone"], message: string, title?: string) => {
    const id = `${tone}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setNotices((current) => [...current, { id, tone, message, title }]);
    window.setTimeout(() => {
      setNotices((current) => current.filter((item) => item.id !== id));
    }, tone === "error" ? 5000 : 3200);
  };

  useEffect(() => {
    if (geojson) {
      setMapState("ready");
      return;
    }

    let alive = true;
    const timeout = window.setTimeout(() => {
      if (alive && !geojson) {
        setMapState("error");
      }
    }, 5000);

    loadGeojson().finally(() => {
      if (!alive) return;
      window.clearTimeout(timeout);
    });

    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, [geojson]);

  useEffect(() => {
    let alive = true;
    fetchContractsFreshness(lang)
      .then((data) => {
        if (alive) setFreshness(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lang]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("veeduria:saved-contract-slices");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<Partial<SavedSearch> & { name?: string }>;
      if (!Array.isArray(parsed)) return;
      setSavedSearches(
        parsed
          .map((item, index) => ({
            id: String(item.id ?? `saved-${index}`),
            label: String(item.label ?? item.name ?? (lang === "es" ? "Corte guardado" : "Saved slice")),
            filters: {
              ...INITIAL_FILTERS,
              ...(item.filters ?? {}),
              risk:
                item.filters?.risk === "high" || item.filters?.risk === "medium" || item.filters?.risk === "low"
                  ? item.filters.risk
                  : "all" as FilterState["risk"],
            },
            resultCount: typeof item.resultCount === "number" ? item.resultCount : 0,
          }))
          .slice(0, 6),
      );
    } catch {}
  }, [lang]);

  useEffect(() => {
    if (syncingUrl.current) {
      syncingUrl.current = false;
      return;
    }
    const query = buildFilterQuery(lang, filters);
    const href = query ? `${pathname}?${query}` : pathname;
    router.replace(href, { scroll: false });
  }, [filters, lang, pathname, router]);

  useEffect(() => {
    if (!actionPending || loading || tableLoading) return;
    const contracts = firstPositiveNumber(table?.total, overview?.slice.totalContracts, overview?.meta.shownRows) ?? 0;
    if (pendingReason.current === "reset") {
      pushNotice(
        "info",
        lang === "es" ? "Volviste al corte general de Colombia." : "You returned to the national Colombia slice.",
        lang === "es" ? "Filtros limpiados" : "Filters cleared",
      );
    } else {
      pushNotice(
        "success",
        lang === "es"
          ? `${contracts.toLocaleString("es-CO")} contratos quedaron visibles con el corte actual.`
          : `${contracts.toLocaleString("en-US")} contracts remain visible under the current slice.`,
        lang === "es" ? "Corte actualizado" : "Slice updated",
      );
    }
    pendingReason.current = null;
    setActionPending(false);
  }, [actionPending, lang, loading, overview?.meta.shownRows, overview?.slice.totalContracts, table?.total, tableLoading]);

  useGSAP(
    () => {
      const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) return;
      const introTargets = gsap.utils.toArray<HTMLElement>(
        ".cv-hero-panel, .cv-control-panel, .cv-map-stage, .cv-block, .cv-dashboard-card, .explorer-card, .cv-case-chip",
      );
      if (introTargets.length > 0) {
        gsap.fromTo(
          introTargets,
          { autoAlpha: 0, y: 24 },
          { autoAlpha: 1, y: 0, duration: 0.58, stagger: 0.03, ease: "power3.out" },
        );
      }
      gsap.utils.toArray<HTMLElement>(".cv-workbench, .cv-focus-panel, .cv-dashboard, .cv-explorer, .cv-methodology").forEach((section) => {
        gsap.fromTo(
          section,
          { autoAlpha: 0, y: 42 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.75,
            ease: "power3.out",
            scrollTrigger: {
              trigger: section,
              start: "top 84%",
            },
          },
        );
      });
      const barTargets = gsap.utils.toArray<HTMLElement>(
        ".cv-factor-row__bar span, .cv-case-chip__bar span, .cv-sandbox-group__bar span, .table-value__fill",
      );
      if (barTargets.length > 0) {
        gsap.fromTo(
          barTargets,
          { width: 0 },
          {
            width: (_index, target) => target.getAttribute("data-width") || target.getAttribute("style")?.match(/width:\s*([^;]+)/)?.[1] || "100%",
            duration: 1.1,
            ease: "power3.out",
            stagger: 0.03,
            scrollTrigger: {
              trigger: ".cv-page",
              start: "top 75%",
            },
          },
        );
      }
    },
    { scope, dependencies: [table?.rows.length ?? 0, overview?.leadCases.length ?? 0, overview?.slice.totalContracts ?? 0] },
  );

  useEffect(() => {
    if (overviewInitialized) {
      setOverviewInitialized(false);
      return;
    }

    let alive = true;
    setLoading(true);
    fetchOverview({ lang, ...filters })
      .then((data) => {
        if (!alive) return;
        setOverview(data);
        setSelectedCase(data.leadCases[0] ?? null);
      })
      .catch(() => {
        if (!alive) return;
        pushNotice(
          "error",
          lang === "es" ? "No fue posible actualizar el panorama del corte." : "The slice overview could not be refreshed.",
          lang === "es" ? "Error de carga" : "Loading error",
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [filters, lang, overviewInitialized]);

  useEffect(() => {
    if (tableInitialized) {
      setTableInitialized(false);
      return;
    }

    let alive = true;
    setTableLoading(true);
    fetchContractsTable({ lang, ...filters, offset: page * 24, limit: 24 })
      .then((data) => {
        if (!alive) return;
        setTable(data);
      })
      .catch(() => {
        if (!alive) return;
        pushNotice(
          "error",
          lang === "es" ? "No fue posible cargar la tabla del corte actual." : "The current slice table could not be loaded.",
          lang === "es" ? "Error de carga" : "Loading error",
        );
      })
      .finally(() => {
        if (alive) setTableLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [filters, lang, page, tableInitialized]);

  const leadCases = useMemo(
    () =>
      (overview?.leadCases ?? []).map((row) => ({
        ...row,
        entity: displayEntityName(row.entity),
        valueLabel: normalizeCurrencyPrefix(row.valueLabel),
      })),
    [overview?.leadCases],
  );
  const summaryEntities = useMemo(
    () =>
      (overview?.summaries.entities ?? []).map((row) => ({
        ...row,
        nombre_entidad: displayEntityName(row.nombre_entidad),
      })),
    [overview?.summaries.entities],
  );
  const summaryModalities = overview?.summaries.modalities ?? [];
  const tableRows = useMemo(
    () =>
      (table?.rows ?? []).map((row) => ({
        ...row,
        entity: displayEntityName(row.entity),
        valueLabel: normalizeCurrencyPrefix(row.valueLabel),
      })),
    [table?.rows],
  );
  const departmentLabelByGeoName = useMemo(
    () => new Map((overview?.map.departments ?? []).map((item) => [item.geoName, item.label])),
    [overview?.map.departments],
  );
  const activeDepartmentLabel = filters.department
    ? departmentLabelByGeoName.get(filters.department) ?? filters.department
    : null;
  const liveContracts = useMemo(() => {
    const raw = freshness?.liveFeed.contracts?.length ? freshness.liveFeed.contracts : overview?.liveFeed.contracts ?? [];
    return raw.map((row) => ({ ...row, entity: displayEntityName(row.entity) }));
  }, [freshness?.liveFeed.contracts, overview?.liveFeed.contracts]);
  const totalPages = table ? Math.max(1, Math.ceil(table.total / 24)) : 1;
  const isBooting = loading && !overview;
  const leadCaseMax = Math.max(...leadCases.map((item) => item.score), 100);
  const tableValueMax = Math.max(...tableRows.map((row) => row.value), 0);
  const activeSlice = [
    activeDepartmentLabel,
    filters.risk !== "all"
      ? filters.risk === "high"
        ? copy.riskHigh
        : filters.risk === "medium"
          ? copy.riskMedium
          : copy.riskLow
      : null,
    filters.modality,
    filters.query?.trim() ? `"${filters.query.trim()}"` : null,
  ].filter(Boolean) as string[];

  const hasStrongFilters = isMeaningfulFilter(filters);
  const searchSuggestions = useMemo(
    () =>
      [
        ...new Set([
          ...(overview?.options.departments.map((item) => item.label) ?? []),
          ...tableRows.map((row) => row.entity),
          ...tableRows.map((row) => row.provider),
        ]),
      ].slice(0, 24),
    [overview?.options.departments, tableRows],
  );

  const headlineContracts = useMemo(() => {
    if (!hasStrongFilters) {
      // No filters -> show the scored slice count. The full SECOP universe is
      // shown separately only when the live source count is available.
      return (
        firstPositiveNumber(
          overview?.meta.totalRows,
          overview?.meta.shownRows,
          overview?.slice.totalContracts,
          table?.total,
        ) ?? 0
      );
    }
    return firstPositiveNumber(overview?.slice.totalContracts, overview?.meta.shownRows, table?.total) ?? 0;
  }, [hasStrongFilters, overview, table?.total]);
  const visibleContracts = useMemo(() => {
    const bestVisible = firstPositiveNumber(table?.total, overview?.slice.totalContracts, overview?.meta.shownRows);
    if (bestVisible !== null) return bestVisible;
    if (table?.total === 0 && overview?.slice.totalContracts === 0) return 0;
    return 0;
  }, [overview?.meta.shownRows, overview?.slice.totalContracts, table?.total]);
  const sourceContracts =
    firstPositiveNumber(
      freshness?.sourceRows,
      freshness?.liveFeed.rowsAtSource,
      overview?.meta.sourceRows,
      overview?.liveFeed.rowsAtSource,
    ) ?? 0;
  const redAlertsCount =
    firstPositiveNumber(
      overview?.slice.redAlerts,
      leadCases.filter((item) => item.riskBand === "high").length,
      hasStrongFilters ? undefined : Math.round(visibleContracts * 0.05),
    ) ?? 0;
  const filteredContractsNote =
    hasStrongFilters && sourceContracts > visibleContracts
      ? lang === "es"
        ? `filtrado de ${sourceContracts.toLocaleString("es-CO")}`
        : `filtered from ${sourceContracts.toLocaleString("en-US")}`
      : hasStrongFilters
        ? lang === "es"
          ? "corte activo"
          : "active slice"
        : lang === "es"
          ? "fuente nacional"
          : "national source";

  const latestSourceDate = freshness?.sourceLatestContractDate ?? overview?.meta.sourceLatestContractDate ?? (lang === "es" ? "sin dato" : "no data");
  const freshnessGap = freshness?.sourceFreshnessGapDays ?? overview?.meta.sourceFreshnessGapDays ?? null;
  const sourceUpdatedAt = freshness?.sourceUpdatedAt ?? overview?.meta.sourceUpdatedAt ?? null;
  const currentDepartment = filters.department
    ? overview?.map?.departments.find((item) => item.geoName === filters.department)
    : null;
  const explorerGroups = useMemo(() => buildExplorerGroups(tableRows, explorerGroup), [tableRows, explorerGroup]);
  const selectedTone = selectedCase ? scoreTone(selectedCase.score) : "low";
  const scoringRunAt = freshness?.scoringRunAt ?? overview?.meta.lastRunTs ?? null;
  const scoringRunDate = scoringRunAt?.slice(0, 10) ?? (lang === "es" ? "sin dato" : "no data");
  const sourceUpdateDate = sourceUpdatedAt?.slice(0, 10) ?? latestSourceDate;
  const operationalGap = freshness?.operationalGapDays ?? freshnessGap;
  const maxAllowedGap = freshness?.maxAllowedGapDays ?? 2;
  const staleScore = operationalGap !== null && operationalGap >= maxAllowedGap;
  const lastPipelineRun = scoringRunAt ? formatPortalUpdated(lang, scoringRunAt) : null;
  const scoringCadence = lang === "es" ? "corrida diaria completa: descarga SECOP, scoring e importación" : "full daily run: SECOP download, scoring, and import";
  const sliceMeanRisk = overview?.benchmarks?.sliceMeanRisk ?? leadCases.reduce((sum, item) => sum + item.score / 100, 0) / Math.max(leadCases.length, 1);
  const nationalMeanRisk = overview?.benchmarks?.nationalMeanRisk ?? sliceMeanRisk;
  const departmentMeanRisk = overview?.benchmarks?.departmentMeanRisk ?? currentDepartment?.avgRisk ?? null;
  const sliceMeanScore = Math.round(sliceMeanRisk * 100);
  const nationalMeanScore = Math.round(nationalMeanRisk * 100);
  const departmentMeanScore = Math.round((departmentMeanRisk ?? 0) * 100);
  const sliceMedianValue = overview?.benchmarks?.sliceMedianValue ?? 0;
  const summaryHighlights = [
    {
      label: lang === "es" ? "Territorio dominante" : "Dominant territory",
      value: overview?.slice.dominantDepartment ?? (lang === "es" ? "cargando" : "loading"),
      note: lang === "es" ? "mayor volumen dentro del corte actual" : "largest volume inside the current slice",
    },
    {
      label: lang === "es" ? "Entidad más cargada arriba" : "Top entity in the slice",
      value: summaryEntities[0]?.nombre_entidad ?? (lang === "es" ? "sin datos" : "no data"),
      note:
        summaryEntities[0]
          ? `${summaryEntities[0].contracts.toLocaleString("es-CO")} ${lang === "es" ? "contratos" : "contracts"}`
          : lang === "es" ? "amplía el corte" : "widen the slice",
    },
    {
      label: lang === "es" ? "Modalidad más sensible" : "Most sensitive modality",
      value: summaryModalities[0]?.modalidad_de_contratacion ?? (lang === "es" ? "sin datos" : "no data"),
      note:
        summaryModalities[0]
          ? `${Math.round(summaryModalities[0].meanRisk * 100)}/100 ${lang === "es" ? "de intensidad media" : "average intensity"}`
          : lang === "es" ? "amplía el corte" : "widen the slice",
    },
    {
      label: lang === "es" ? "Último contrato oficial" : "Latest official contract",
      value: latestSourceDate,
      note:
        sourceUpdatedAt
          ? `${lang === "es" ? "portal actualizado" : "portal updated"} ${formatPortalUpdated(lang, sourceUpdatedAt)}`
          : lang === "es"
            ? "actualizando en tiempo real"
            : "refreshing in real time",
    },
  ];
  const activeFilterChips = [
    filters.department
      ? {
          key: "department",
          label: lang === "es" ? `Departamento: ${activeDepartmentLabel}` : `Department: ${activeDepartmentLabel}`,
        }
      : null,
    filters.risk !== "all"
      ? {
          key: "risk",
          label:
            lang === "es"
              ? `Riesgo: ${filters.risk === "high" ? "alto" : filters.risk === "medium" ? "medio" : "bajo"}`
              : `Risk: ${filters.risk}`,
        }
      : null,
    filters.modality ? { key: "modality", label: `${lang === "es" ? "Modalidad" : "Modality"}: ${filters.modality}` } : null,
    filters.query?.trim() ? { key: "query", label: `${lang === "es" ? "Búsqueda" : "Search"}: ${filters.query.trim()}` } : null,
    filters.dateFrom ? { key: "dateFrom", label: `${lang === "es" ? "Desde" : "From"}: ${filters.dateFrom}` } : null,
    filters.dateTo ? { key: "dateTo", label: `${lang === "es" ? "Hasta" : "To"}: ${filters.dateTo}` } : null,
  ].filter(Boolean) as Array<{ key: keyof FilterState; label: string }>;
  const mapTooltipData = useMemo(() => {
    return Object.fromEntries(
      (overview?.map.departments ?? []).map((department) => {
        const alerts = leadCases
          .filter((caseItem) => caseItem.department === department.label || caseItem.department === department.geoName)
          .slice(0, 3)
          .map((caseItem) => caseItem.signal || caseItem.pickReason);
        return [
          department.geoName,
          {
            label: department.label,
            contractCount: department.contractCount,
            intensity: Math.round(department.avgRisk * 100),
            alerts: alerts.length
              ? alerts
              : lang === "es"
                ? [
                    "Concentración por encima del promedio del corte",
                    "Mayor presencia de contratación directa",
                    "Más casos para revisar primero",
                  ]
                : [
                    "Concentration above the slice average",
                    "Higher direct-award presence",
                    "More cases worth opening first",
                  ],
            clickHint: lang === "es" ? "Haz clic para filtrar" : "Click to filter",
          },
        ];
      }),
    );
  }, [leadCases, lang, overview?.map.departments]);

  const runFilters = (next: FilterState, reason: "apply" | "reset" | "save" | "map" | "month") => {
    pendingReason.current = reason;
    setActionPending(true);
    setPage(0);
    setDraft(next);
    setFilters(next);
  };

  const resetFilters = () => {
    runFilters(INITIAL_FILTERS, "reset");
  };

  const saveCurrentSearch = () => {
    const defaultLabel =
      lang === "es"
        ? `Corte ${new Date().toLocaleDateString("es-CO", { month: "short", day: "numeric" })}`
        : `Slice ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    const customLabel = window.prompt(
      lang === "es" ? "Nombre para esta búsqueda" : "Name for this saved search",
      defaultLabel,
    );
    if (!customLabel?.trim()) return;
    const saved: SavedSearch = {
      id: `${Date.now()}`,
      label: customLabel.trim(),
      filters,
      resultCount: visibleContracts,
    };
    const next = [saved, ...savedSearches].slice(0, 6);
    setSavedSearches(next);
    window.localStorage.setItem("veeduria:saved-contract-slices", JSON.stringify(next));
    pushNotice(
      "success",
      lang === "es"
        ? `Búsqueda "${saved.label}" guardada con ${visibleContracts.toLocaleString("es-CO")} contratos visibles.`
        : `Saved "${saved.label}" with ${visibleContracts.toLocaleString("en-US")} visible contracts.`,
      lang === "es" ? "Búsqueda guardada" : "Search saved",
    );
  };

  const removeFilterChip = (key: keyof FilterState) => {
    const next: FilterState = { ...filters };
    if (key === "risk") next.risk = "all";
    else if (key === "full") next.full = false;
    else next[key] = undefined;
    runFilters(next, "apply");
  };

  if (isBooting) {
    return (
      <div className="shell" ref={scope}>
        <SiteNav
          lang={lang}
          links={[
            { href: `/contrato-limpio?lang=${lang}`, label: copy.navPhase1 },
            { href: `/votometro?lang=${lang}`, label: copy.navPhase2 },
          ]}
        />
        <ContractsLoading lang={lang} />
      </div>
    );
  }

  return (
    <div className="shell" ref={scope}>
      <SiteNav
        lang={lang}
        links={[
          { href: `/contrato-limpio?lang=${lang}`, label: copy.navPhase1 },
          { href: `/votometro?lang=${lang}`, label: copy.navPhase2 },
        ]}
      />
      <NoticeStack notices={notices} onDismiss={(id) => setNotices((current) => current.filter((item) => item.id !== id))} />

      <main className={`page cv-page${actionPending ? " cv-page--loading" : ""}`}>
        <Link href={`/etica-y-privacidad?lang=${lang}`} className="module-disclaimer">
          {lang === "es"
            ? "Señal analítica, no acusación. Verifica la fuente oficial antes de concluir o publicar."
            : "Analytical signal, not an accusation. Verify the official source before concluding or publishing."}
        </Link>
        <section className="cv-hero-panel surface stripe-flag">
          <div className="cv-hero-panel__top">
            <div>
              <p className="eyebrow">{copy.pageEyebrow}</p>
              <h1>ContratoLimpio</h1>
              <p className="cv-hero-panel__body">
                {lang === "es"
                  ? "Filtra contratos públicos por territorio, modalidad o entidad. El modelo priorizó los más atípicos — úsalos como punto de entrada al expediente oficial en SECOP."
                  : "Filter public contracts by territory, modality, or entity. The model prioritized the most anomalous — use them as your entry point to the official SECOP record."}
              </p>
            </div>

            <div className="cv-hero-signal-tile" aria-label={lang === "es" ? "Estado del corte" : "Slice status"}>
              <div className="cv-hero-signal-tile__copy">
                <span className="cv-hero-signal-tile__kicker">
                  {lang === "es" ? "Estado del corte" : "Slice status"}
                </span>
                <strong>
                  {staleScore
                    ? lang === "es"
                      ? "La actualización completa está fuera de la meta de 2 días"
                      : "The full refresh is outside the 2-day target"
                    : lang === "es"
                      ? "Fuente y scoring dentro de la meta operativa"
                      : "Source and scoring are within the operating target"}
                </strong>
                <p>
                  {lang === "es"
                    ? "La fuente se consulta en vivo; el scoring muestra la última ejecución real del pipeline."
                    : "The source is queried live; scoring shows the real latest pipeline run."}
                </p>
              </div>
              <div className="cv-hero-signal-tile__grid">
                <span>
                  <small>{lang === "es" ? "Fuente" : "Source"}</small>
                  {sourceUpdateDate}
                </span>
                <span>
                  <small>{lang === "es" ? "Scoring" : "Scoring"}</small>
                  {scoringRunDate}
                </span>
                <span>
                  <small>{lang === "es" ? "Brecha" : "Gap"}</small>
                  {operationalGap === null
                    ? "—"
                    : operationalGap === 0
                      ? "0"
                      : `${operationalGap}d`}
                </span>
                <span>
                  <small>{lang === "es" ? "Meta" : "Target"}</small>
                  {`<${maxAllowedGap}d`}
                </span>
              </div>
            </div>

            <div className="cv-hero-kpis">
              <article className="cv-hero-kpi cv-hero-kpi--yellow">
                <span>
                  {hasStrongFilters
                    ? lang === "es" ? "Visibles en el corte" : "Visible in slice"
                    : lang === "es" ? "Contratos analizados" : "Analyzed contracts"}
                </span>
                <strong>
                  {(hasStrongFilters
                    ? visibleContracts
                    : (overview?.meta.totalRows ?? headlineContracts)
                  ).toLocaleString("es-CO")}
                </strong>
                <p>
                  {hasStrongFilters
                    ? lang === "es"
                      ? `${filteredContractsNote} · universo ${(overview?.meta.totalRows ?? 0).toLocaleString("es-CO")} analizados`
                      : `${filteredContractsNote} · universe: ${(overview?.meta.totalRows ?? 0).toLocaleString("en-US")} analyzed`
                    : lang === "es"
                      ? sourceContracts > 0
                        ? `del universo SECOP de ${sourceContracts.toLocaleString("es-CO")} contratos`
                        : "del universo SECOP consultado en vivo"
                      : sourceContracts > 0
                        ? `from the SECOP universe of ${sourceContracts.toLocaleString("en-US")} contracts`
                        : "from the live SECOP universe"}
                </p>
              </article>
              <article className="cv-hero-kpi cv-hero-kpi--red">
                <span>{lang === "es" ? "Alertas altas" : "High alerts"}</span>
                <strong>{redAlertsCount.toLocaleString("es-CO")}</strong>
                <p>{lang === "es" ? "casos priorizados para revisión" : "cases prioritized for review"}</p>
              </article>
            </div>

            {overview?.meta.totalRows ? (
              <div className="cv-model-universe-note">
                <strong>
                  {lang === "es" ? "Universo analizado" : "Analyzed universe"}
                </strong>
                <span>
                  {lang === "es"
                    ? sourceContracts > 0
                      ? `El modelo procesó los ${sourceContracts.toLocaleString("es-CO")} contratos de SECOP II y priorizó ${overview.meta.totalRows.toLocaleString("es-CO")} con señal de riesgo (rojo o amarillo). El resto no generó alerta y no aparece en este tablero.`
                      : `El modelo priorizó ${overview.meta.totalRows.toLocaleString("es-CO")} contratos con señal de riesgo (rojo o amarillo). El total oficial de SECOP se consulta en vivo y no se sustituye por un número local si la fuente tarda en responder.`
                    : sourceContracts > 0
                      ? `The model processed the ${sourceContracts.toLocaleString("en-US")} SECOP II contracts and prioritized ${overview.meta.totalRows.toLocaleString("en-US")} with a risk signal (red or yellow). The rest produced no alert and does not appear here.`
                      : `The model prioritized ${overview.meta.totalRows.toLocaleString("en-US")} contracts with a risk signal (red or yellow). The official SECOP total is queried live and is not replaced with a local number when the source is slow.`}
                </span>
              </div>
            ) : null}
          </div>

          {staleScore ? (
            <div className="cv-status-banner cv-status-banner--warning" role="status">
              <div className="cv-status-banner__copy">
                <strong>
                  {lang === "es"
                    ? `Fuente actualizada al ${sourceUpdateDate}; scoring ejecutado al ${scoringRunDate}.`
                    : `Source updated through ${sourceUpdateDate}; scoring run through ${scoringRunDate}.`}
                </strong>
                <span>
                  {lang === "es"
                    ? `La brecha operativa es de ${operationalGap} días y debe mantenerse por debajo de ${maxAllowedGap}. GET /api/contracts/freshness consulta SECOP en vivo; última ejecución completa: ${lastPipelineRun ?? "pendiente de registro"}.`
                    : `The operating gap is ${operationalGap} days and must stay below ${maxAllowedGap}. GET /api/contracts/freshness queries live SECOP; latest full run: ${lastPipelineRun ?? "not recorded yet"}.`}
                </span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setShowGapExplanation((current) => !current)}
                >
                  {lang === "es" ? "¿Por qué hay brecha?" : "Why is there a gap?"}
                </button>
              </div>
              {showGapExplanation ? (
                <div className="cv-gap-explanation">
                  <p>
                    {lang === "es"
                      ? "El refresh diario debe hacer la cadena completa: descargar SECOP, recalcular scoring e importar la tabla. Si cualquiera de esos pasos no actualiza la fila global, el tablero muestra la brecha operativa."
                      : "The daily refresh must run the full chain: download SECOP, recompute scoring, and import the table. If any step fails to update the global row, the board shows the operating gap."}
                  </p>
                  <p>
                    <strong>{lang === "es" ? "Cadencia objetivo del refresh:" : "Target refresh cadence:"}</strong>{" "}
                    {scoringCadence}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="cv-status-banner cv-status-banner--live" role="status">
              <div className="cv-status-banner__copy">
                <strong>
                  {lang === "es"
                    ? `Scoring ejecutado al ${scoringRunDate}; fuente actualizada al ${sourceUpdateDate}.`
                    : `Scoring run through ${scoringRunDate}; source updated through ${sourceUpdateDate}.`}
                </strong>
                <span>
                  {lang === "es"
                    ? `La brecha operativa está dentro de la meta de menos de ${maxAllowedGap} días. Los números visibles vienen de la API y de la fila global importada por el pipeline.`
                    : `The operating gap is within the less-than-${maxAllowedGap}-day target. Visible numbers come from the API and the global row imported by the pipeline.`}
                </span>
              </div>
            </div>
          )}

          <div className="cv-workbench">
            <section className="cv-control-panel surface-soft">
              <div className="cv-control-panel__head">
                <div>
                  <p className="eyebrow">{lang === "es" ? "Filtra los datos" : "Filter the data"}</p>
                  <h2>{lang === "es" ? "Filtra primero, compara después" : "Filter first, compare next"}</h2>
                </div>
                <p>
                  {lang === "es"
                    ? "1. Ajusta filtros. 2. Mira el cambio territorial. 3. Baja al caso principal y al explorador para abrir evidencia."
                    : "1. Adjust filters. 2. Read the territorial shift. 3. Move into the lead case and the explorer to open evidence."}
                </p>
              </div>

              <div className="cv-context-strip">
                <article className="cv-context-card cv-context-card--dynamic">
                  <span>{lang === "es" ? "Sí cambia con tus filtros" : "Changes with your filters"}</span>
                  <strong>{activeSlice.length ? activeSlice.join(" · ") : copy.currentSliceDefault}</strong>
                  <p>
                    {lang === "es"
                      ? `${visibleContracts.toLocaleString("es-CO")} contratos visibles y lectura territorial del corte activo.`
                      : `${visibleContracts.toLocaleString("en-US")} visible contracts and territorial readout for the active slice.`}
                  </p>
                </article>
                <article className="cv-context-card cv-context-card--static">
                  <span>{lang === "es" ? "Dato oficial del portal" : "Official portal data"}</span>
                  <strong>{lang === "es" ? `Fuente publicada al ${latestSourceDate}` : `Source published through ${latestSourceDate}`}</strong>
                  <p>
                    {sourceUpdatedAt
                      ? `${lang === "es" ? "Actualización diaria del portal" : "Daily portal refresh"}: ${formatPortalUpdated(lang, sourceUpdatedAt)}`
                      : lang === "es"
                        ? "Sin hora oficial visible"
                        : "No official timestamp visible"}
                  </p>
                </article>
              </div>

              <div className="cv-filter-grid cv-filter-grid--tight">
                <label className="filter-field cv-filter-grid__wide">
                  <span className="label">
                    <Search size={13} style={{ verticalAlign: "middle", marginRight: 5 }} aria-hidden={true} />
                    {copy.searchLabel}
                  </span>
                  <input
                    list="contracts-search-suggestions"
                    value={draft.query ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, query: event.target.value }))}
                    placeholder={copy.searchPlaceholder}
                  />
                  <datalist id="contracts-search-suggestions">
                    {searchSuggestions.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </label>

                <label className="filter-field">
                  <span className="label">{copy.filterDepartment}</span>
                  <select
                    value={draft.department ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, department: event.target.value || undefined }))}
                  >
                    <option value="">{copy.filterAll}</option>
                    {(overview?.options.departments ?? []).map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="filter-field">
                  <span className="label">{copy.filterRisk}</span>
                  <select
                    value={draft.risk}
                    onChange={(event) => setDraft((prev) => ({ ...prev, risk: event.target.value as FilterState["risk"] }))}
                  >
                    <option value="all">{copy.riskAll}</option>
                    <option value="high">{copy.riskHigh}</option>
                    <option value="medium">{copy.riskMedium}</option>
                    <option value="low">{copy.riskLow}</option>
                  </select>
                </label>

                <label className="filter-field">
                  <span className="label">{copy.filterModality}</span>
                  <select
                    value={draft.modality ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, modality: event.target.value || undefined }))}
                  >
                    <option value="">{copy.filterAll}</option>
                    {(overview?.options.modalities ?? []).map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="cv-date-range">
                  <label className="filter-field">
                    <span className="label">{copy.filterDateFrom}</span>
                    <input
                      type="date"
                      value={draft.dateFrom ?? ""}
                      onChange={(event) => setDraft((prev) => ({ ...prev, dateFrom: event.target.value }))}
                    />
                  </label>

                  <label className="filter-field">
                    <span className="label">{copy.filterDateTo}</span>
                    <input
                      type="date"
                      value={draft.dateTo ?? ""}
                      onChange={(event) => setDraft((prev) => ({ ...prev, dateTo: event.target.value }))}
                    />
                  </label>
                </div>
              </div>

              <div className="cv-control-panel__actions">
                <button
                  type="button"
                  className="btn-primary cv-filter-action"
                  onClick={() => {
                    runFilters(draft, "apply");
                  }}
                >
                  {actionPending || loading || tableLoading ? <LoaderCircle size={15} className="is-spinning" aria-hidden={true} /> : <Filter size={15} aria-hidden={true} />}
                  {lang === "es" ? "Filtrar contratos" : "Filter contracts"}
                  <ArrowUpRight size={14} aria-hidden={true} />
                </button>

                <button type="button" className="btn-secondary cv-filter-action" onClick={resetFilters}>
                  <RotateCcw size={15} aria-hidden={true} />
                  {lang === "es" ? "Limpiar filtros" : "Clear filters"}
                </button>

                <button
                  type="button"
                  className="btn-secondary cv-filter-action"
                  onClick={saveCurrentSearch}
                  disabled={!isMeaningfulFilter(filters)}
                >
                  <Bookmark size={15} />
                  {lang === "es" ? "Guardar búsqueda" : "Save search"}
                </button>
              </div>

              <div className="cv-saved-search-row">
                <label className="filter-field">
                  <span className="label">{lang === "es" ? "Búsquedas guardadas" : "Saved searches"}</span>
                  {savedSearches.length ? (
                    <select
                      value=""
                      onChange={(event) => {
                        const selected = savedSearches.find((item) => item.id === event.target.value);
                        if (!selected) return;
                        runFilters(selected.filters, "apply");
                      }}
                    >
                      <option value="">{lang === "es" ? "Elegir corte guardado" : "Choose a saved slice"}</option>
                      {savedSearches.map((item) => (
                        <option key={item.id} value={item.id}>
                          {`${item.label} (${item.resultCount.toLocaleString("es-CO")} ${lang === "es" ? "contratos" : "contracts"})`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="cv-saved-search-empty">
                      <select disabled>
                        <option>{lang === "es" ? "No tienes búsquedas guardadas" : "You have no saved searches"}</option>
                      </select>
                      <p>
                        {lang === "es"
                          ? 'Aplica filtros y haz clic en "Guardar búsqueda" para crear un acceso rápido.'
                          : 'Apply filters and click "Save search" to create a quick access point.'}
                      </p>
                    </div>
                  )}
                </label>
              </div>

              {activeFilterChips.length ? (
                <div className="cv-filter-chips">
                  {activeFilterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      className="cv-filter-chip"
                      onClick={() => removeFilterChip(chip.key)}
                    >
                      <span>{chip.label}</span>
                      <X size={14} />
                    </button>
                  ))}
                </div>
              ) : null}

              <p className="cv-helper-copy cv-helper-copy--compact">
                {lang === "es"
                  ? "Los filtros recalculan el corte con el universo cargado del parquet puntuado. La tabla visible es una ventana de lectura, no el total del corte."
                  : "Filters recalculate the slice from the loaded scored parquet universe. The visible table is a reading window, not the full slice total."}
              </p>
            </section>

            <section className="cv-map-stage surface">
              <div className="cv-map-stage__head">
                <div>
                  <p className="eyebrow">{lang === "es" ? "Mapa de riesgo" : "Risk map"}</p>
                  <h2>{lang === "es" ? "Patrón territorial del corte" : "Territorial pattern of the slice"}</h2>
                </div>
                <p>
                  {lang === "es"
                    ? "Haz clic en un departamento para ver sus contratos. Lo que aparece abajo usa esa misma selección."
                    : "Click a department to view its contracts. Everything below uses that same selection."}
                </p>
              </div>

              <div className="cv-map-insight-row" key={filters.department ?? "all"}>
                <article className="cv-map-insight">
                  <span>{lang === "es" ? "Departamento activo" : "Active department"}</span>
                  <strong>{currentDepartment?.label ?? (lang === "es" ? "Colombia completa" : "Whole Colombia")}</strong>
                </article>
                <article className="cv-map-insight">
                  <span>{lang === "es" ? "Contratos visibles" : "Visible contracts"}</span>
                  <strong>{visibleContracts.toLocaleString("es-CO")}</strong>
                  <small>{filteredContractsNote}</small>
                </article>
                <article className="cv-map-insight">
                  <span>{lang === "es" ? "Intensidad media" : "Average intensity"}</span>
                  <strong>{currentDepartment ? `${Math.round(currentDepartment.avgRisk * 100)}/100` : `${sliceMeanScore}/100`}</strong>
                  <small>{lang === "es" ? "recalculada con el corte visible" : "recalculated from the visible slice"}</small>
                </article>
              </div>

              <div className="cv-map-legend-compact">
                <span className="cv-map-legend-item">
                  <span className="cv-map-legend-dot cv-map-legend-dot--low" />
                  {lang === "es" ? "Bajo" : "Low"}
                </span>
                <span className="cv-map-legend-item">
                  <span className="cv-map-legend-dot cv-map-legend-dot--mid" />
                  {lang === "es" ? "Ámbar" : "Amber"}
                </span>
                <span className="cv-map-legend-item">
                  <span className="cv-map-legend-dot cv-map-legend-dot--high" />
                  {lang === "es" ? "Alto" : "High"}
                </span>
              </div>

              <div className="cv-map-frame cv-map-frame--compact cv-map-frame--workbench">
                {geojson && overview && mapState === "ready" ? (
                  <ColombiaMap
                    geojson={geojson}
                    departments={overview.map.departments}
                    activeDepartment={filters.department}
                    tooltipData={mapTooltipData}
                    showCaption={false}
                    onSelect={(department) => {
                      const next = { ...filters, department: department === filters.department ? undefined : department };
                      runFilters(next, "map");
                    }}
                  />
                ) : mapState === "error" ? (
                  <div className="cv-map-placeholder cv-map-placeholder--error">
                    <strong>
                      {lang === "es"
                        ? "El mapa no está disponible en este momento."
                        : "The map is not available right now."}
                    </strong>
                    <p>
                      {lang === "es"
                        ? "Por favor, recarga la página o vuelve a intentarlo en unos minutos."
                        : "Please reload the page or try again in a few minutes."}
                    </p>
                    <button type="button" className="btn-secondary" onClick={() => void loadGeojson()}>
                      {lang === "es" ? "Reintentar" : "Retry"}
                    </button>
                  </div>
                ) : (
                  <div className="cv-map-placeholder" aria-live="polite">
                    <span className="cv-spinner" aria-hidden="true" />
                    <span className="label">{lang === "es" ? "Cargando el mapa territorial" : "Loading the territorial map"}</span>
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>

        <ContractsDashboard
          lang={lang}
          departments={overview?.map.departments ?? []}
          rows={tableRows}
          summaryEntities={summaryEntities}
          summaryModalities={summaryModalities}
          analytics={overview?.analytics}
          activeDepartmentLabel={activeDepartmentLabel}
          onDepartmentPick={(department) => {
            const next = { ...filters, department };
            runFilters(next, "map");
          }}
          onMonthPick={(month) => {
            const bounds = monthBounds(month);
            if (!bounds) return;
            const next = { ...filters, dateFrom: bounds.start, dateTo: bounds.end };
            runFilters(next, "month");
          }}
        />

        <section className={`cv-block surface stripe-${selectedTone === "high" ? "red" : selectedTone === "medium" ? "yellow" : "green"}`}>
          <div className="cv-block__header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Caso principal" : "Lead case"}</p>
              <h2>{lang === "es" ? "Contrato de referencia para este corte" : "Reference contract for this slice"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "Este bloque resume el caso que mejor muestra el patrón del corte y dónde conviene abrir el expediente."
                : "This block summarizes the most useful case to open the record, understand the pattern, and compare it against the rest."}
            </p>
          </div>

          {selectedCase ? (
            <>
              <div className="cv-focus-head">
                <div>
                  <span className={`cv-focus-head__kicker cv-focus-head__kicker--${selectedTone}`}>{selectedCase.pickReason}</span>
                  <h3>{displayEntityName(selectedCase.entity)}</h3>
                  <p>{selectedCase.signal}</p>
                </div>
                <div className={`cv-score-badge cv-score-badge--${selectedTone}`}>
                  <span>{bandLabel(lang, selectedCase.riskBand)}</span>
                  <div className="cv-score-badge__row">
                    <strong>{selectedCase.score}</strong>
                    <small>/100</small>
                  </div>
                </div>
              </div>

              <div className="cv-focus-comparison">
                <article className="cv-focus-compare-card">
                  <span>{lang === "es" ? "Caso actual" : "Current case"}</span>
                  <strong>{selectedCase.score}/100</strong>
                </article>
                <article className="cv-focus-compare-card">
                  <span>{lang === "es" ? "Promedio del corte" : "Slice average"}</span>
                  <strong>{sliceMeanScore}/100</strong>
                </article>
                <article className="cv-focus-compare-card">
                  <span>{lang === "es" ? "Promedio nacional cargado" : "Loaded national average"}</span>
                  <strong>{nationalMeanScore}/100</strong>
                </article>
                <article className="cv-focus-compare-card">
                  <span>{lang === "es" ? "Referencia territorial" : "Territorial reference"}</span>
                  <strong>
                    {filters.department && departmentMeanRisk !== null
                      ? `${departmentMeanScore}/100`
                      : lang === "es" ? "Nacional" : "National"}
                  </strong>
                </article>
              </div>

              <div className="cv-focus-meta">
                <div>
                  <span>{lang === "es" ? "Departamento" : "Department"}</span>
                  <strong>{selectedCase.department}</strong>
                </div>
                <div>
                  <span>{lang === "es" ? "Proveedor" : "Provider"}</span>
                  <strong>{selectedCase.provider}</strong>
                </div>
                <div>
                  <span>{lang === "es" ? "Modalidad" : "Modality"}</span>
                  <strong>{selectedCase.modality}</strong>
                </div>
                <div>
                  <span>{lang === "es" ? "Valor" : "Value"}</span>
                  <strong>{formatCompactCop(selectedCase.value, lang)}</strong>
                  {contractValueFlag(selectedCase.value, lang) ? (
                    <small className="value-flag">{contractValueFlag(selectedCase.value, lang)}</small>
                  ) : null}
                </div>
              </div>

              <div className="cv-focus-summary">
                <p>
                  {riskSentence(lang, selectedCase.riskBand)}{" "}
                  {sliceMedianValue > 0
                    ? lang === "es"
                      ? `Su valor se compara con una mediana de ${formatMoney(sliceMedianValue, lang)} dentro del corte visible.`
                      : `Its value is compared against a slice median of ${formatMoney(sliceMedianValue, lang)}.`
                    : null}
                </p>
                <Link href={selectedCase.secopUrl || "#"} target="_blank" className="btn-secondary">
                  {copy.verify} <ArrowUpRight size={16} aria-hidden={true} />
                </Link>
              </div>

              <div className="cv-factor-list">
                {(selectedCase.factors.length ? selectedCase.factors : computeFallbackFactors(lang, selectedCase)).map((factor) => (
                  <article key={factor.key} className="cv-factor-row">
                    <div>
                      <strong>{factor.label}</strong>
                      <span>{lang === "es" ? "señal detectada en este contrato" : "signal detected in this contract"}</span>
                    </div>
                    <div className="cv-factor-row__bar">
                      <span
                        data-width={`${Math.max(8, factor.severity * 100)}%`}
                        style={{ width: `${Math.max(8, factor.severity * 100)}%` }}
                      />
                    </div>
                    <strong>{Math.round(factor.severity * 100)}</strong>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="surface-soft" style={{ padding: "1rem" }}>
              {lang === "es" ? "No hay casos para este corte." : "No cases for this slice."}
            </div>
          )}
        </section>

        <section className="cv-block surface-soft">
          <div className="cv-block__header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Casos guía" : "Guide cases"}</p>
              <h2>{lang === "es" ? "Comparativos rápidos del mismo corte" : "Quick comparisons inside the same slice"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "Estos casos cambian con territorio, riesgo, fechas y búsqueda. Sirven para abrir contraste, no para congelar un ranking."
                : "These cases change with territory, risk, dates, and search. They are meant to contrast cases, not freeze a ranking."}
            </p>
          </div>

          {leadCases.length ? (
            <div className="cv-case-grid">
              {leadCases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`cv-case-chip cv-case-chip--${scoreTone(item.score)} ${selectedCase?.id === item.id ? "cv-case-chip--active" : ""}`}
                  onClick={() => setSelectedCase(item)}
                >
                  <div className="cv-case-chip__top">
                    <span>{item.department}</span>
                    <strong>{item.score}</strong>
                  </div>
                  <h3>{item.entity}</h3>
                  <p>{formatCompactCop(item.value, lang)}</p>
                  {contractValueFlag(item.value, lang) ? (
                    <small className="value-flag">{contractValueFlag(item.value, lang)}</small>
                  ) : null}
                  <div className="cv-case-chip__bar">
                    <span
                      data-width={`${Math.max(14, (item.score / leadCaseMax) * 100)}%`}
                      style={{ width: `${Math.max(14, (item.score / leadCaseMax) * 100)}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="surface" style={{ padding: "1rem" }}>{copy.noCases}</div>
          )}
        </section>

        <section className="cv-block surface">
          <details className="cv-collapsible cv-collapsible--desktop-open">
            <summary>
              <span>{lang === "es" ? "Resumen ejecutivo: hallazgos concretos del corte" : "Executive summary: concrete findings from this slice"}</span>
            </summary>

            <div className="cv-summary-grid cv-summary-grid--compact">
              {summaryHighlights.map((item) => (
                <article key={item.label} className="cv-summary-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.note}</p>
                </article>
              ))}
            </div>
          </details>
        </section>

        <section className="cv-block surface stripe-green">
          <details className="cv-collapsible">
            <summary>
              <span>
                {lang === "es"
                  ? `Ver contratos recientes (${liveContracts.length} en la vista rápida)`
                  : `View recent contracts (${liveContracts.length} in the quick view)`}
              </span>
            </summary>

            <div className="cv-fresh-headline">
              <div className="cv-fresh-card">
                <span>{lang === "es" ? "Portal actualizado" : "Portal updated"}</span>
                <strong>{formatPortalUpdated(lang, sourceUpdatedAt)}</strong>
              </div>
              <div className="cv-fresh-card">
                <span>{lang === "es" ? "Brecha analítica" : "Analytical gap"}</span>
                <strong>
                  {freshnessGap === null || freshnessGap === undefined
                    ? lang === "es" ? "al día" : "up to date"
                    : freshnessGap === 0
                      ? lang === "es" ? "sin brecha" : "no gap"
                      : `${freshnessGap} ${lang === "es" ? "días" : "days"}`}
                </strong>
              </div>
              <div className="cv-fresh-card">
                <span>{lang === "es" ? "Filas en fuente" : "Rows at source"}</span>
                <strong>{sourceContracts.toLocaleString("es-CO")}</strong>
              </div>
            </div>

            {liveContracts.length ? (
              <div className="contract-freshness__feed">
                {liveContracts.map((row) => (
                  hasSecopLink(row.secopUrl) ? (
                    <Link key={row.id} href={row.secopUrl} target="_blank" className="contract-freshness__item">
                      <div>
                        <div className="label" style={{ marginBottom: "0.2rem" }}>{row.department}</div>
                        <strong>{row.entity}</strong>
                      </div>
                      <div className="contract-freshness__item-meta">
                        <span>{row.date}</span>
                        <span>{formatCompactCop(row.value, lang)}</span>
                      </div>
                    </Link>
                  ) : (
                    <div key={row.id} className="contract-freshness__item contract-freshness__item--disabled">
                      <div>
                        <div className="label" style={{ marginBottom: "0.2rem" }}>{row.department}</div>
                        <strong>{row.entity}</strong>
                      </div>
                      <div className="contract-freshness__item-meta">
                        <span>{row.date}</span>
                        <span>{formatCompactCop(row.value, lang)}</span>
                        <span>{lang === "es" ? "Sin enlace oficial visible" : "No visible official link"}</span>
                      </div>
                    </div>
                  )
                ))}
              </div>
            ) : (
              <div className="cv-empty-state surface-soft">
                <strong>
                  {lang === "es"
                    ? "No hay contratos recientes cargados en esta ventana."
                    : "No recent contracts are loaded in this window."}
                </strong>
                <p>
                  {lang === "es"
                    ? "La fuente oficial está actualizada, pero la vista rápida no recibió registros para mostrar. Filas en fuente y última fecha se mantienen como referencia separada."
                    : "The official source is updated, but the quick view did not receive records to display. Rows at source and latest date remain as separate references."}
                </p>
              </div>
            )}
          </details>
        </section>

        <section className="cv-block surface">
          <div className="cv-block__header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Sandbox del corte" : "Slice sandbox"}</p>
              <h2>{lang === "es" ? "Agrupa, contrasta y exporta" : "Group, contrast, and export"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "Este tablero trabaja sobre el corte visible del explorador. Agrupa rápido por territorio, modalidad o entidad y descarga la tabla actual en CSV."
                : "This board works on the visible explorer slice. Group quickly by territory, modality, or entity and download the current table as CSV."}
            </p>
          </div>

          <details open className="cv-collapsible">
            <summary>
              <span>{lang === "es" ? "Sandbox: agrupa y descarga" : "Sandbox: group and download"}</span>
            </summary>

            <div className="cv-sandbox-toolbar">
              <label className="filter-field">
                <span className="label">
                  <SlidersHorizontal size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />
                  {lang === "es" ? "Agrupar por" : "Group by"}
                </span>
                <select value={explorerGroup} onChange={(event) => setExplorerGroup(event.target.value as ExplorerGroupKey)}>
                  <option value="department">{lang === "es" ? "Departamento" : "Department"}</option>
                  <option value="modality">{lang === "es" ? "Modalidad" : "Modality"}</option>
                  <option value="entity">{lang === "es" ? "Entidad" : "Entity"}</option>
                </select>
              </label>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  pushNotice(
                    "info",
                    lang === "es"
                      ? `Descargando ${tableRows.length.toLocaleString("es-CO")} registros del corte visible.`
                      : `Downloading ${tableRows.length.toLocaleString("en-US")} visible slice records.`,
                    lang === "es" ? "Exportación iniciada" : "Export started",
                  );
                  downloadRows(tableRows, lang);
                }}
              >
                <Download size={15} aria-hidden={true} />
                {lang === "es" ? "Descargar datos ↓" : "Download data ↓"}
              </button>
            </div>

            {tableLoading ? (
              <LoadingStage lang={lang} context="table" compact />
            ) : (
              <div className="cv-sandbox-groups">
                {explorerGroups.slice(0, 6).map((group) => (
                  <article key={group.label} className="cv-sandbox-group">
                    <div className="cv-sandbox-group__head">
                      <strong>{group.label}</strong>
                      <span>{group.peakScore}/100</span>
                    </div>
                    <p>{group.count.toLocaleString("es-CO")} {lang === "es" ? "registros visibles" : "visible records"}</p>
                    <div className="cv-sandbox-group__bar">
                      <span data-width={`${Math.max(14, group.peakScore)}%`} style={{ width: `${Math.max(14, group.peakScore)}%` }} />
                    </div>
                    <small>{formatMoney(group.totalValue, lang)}</small>
                  </article>
                ))}
              </div>
            )}
          </details>

          {tableRows.length ? (
            <div className="cv-explorer-grid">
              {tableRows.map((row) => (
                <article
                  key={row.id}
                  className={`explorer-card explorer-card--${row.riskBand}`}
                >
                  <div className="explorer-card__top">
                    <div>
                      <div className="label" style={{ marginBottom: "0.3rem" }}>{row.department}</div>
                      <div className="explorer-card__title">{highlightText(row.entity, filters.query)}</div>
                    </div>
                    <div className={`score risk-${row.riskBand}`} style={{ fontSize: "1.5rem" }}>{row.score}</div>
                  </div>
                  <div className="body-copy" style={{ fontSize: "0.82rem", marginBottom: "0.7rem" }}>{highlightText(row.provider, filters.query)}</div>
                  <div className="explorer-card__metrics">
                    <div>
                      <div className="label" style={{ marginBottom: "0.3rem" }}>{copy.tableValue}</div>
                      <strong>{formatCompactCop(row.value, lang)}</strong>
                      {contractValueFlag(row.value, lang) ? (
                        <small className="value-flag">{contractValueFlag(row.value, lang)}</small>
                      ) : null}
                      <div className="table-value__track" style={{ marginTop: 6 }}>
                        <span
                          className="table-value__fill"
                          data-width={`${tableValueMax > 0 ? Math.max(10, (row.value / tableValueMax) * 100) : 10}%`}
                          style={{ width: `${tableValueMax > 0 ? Math.max(10, (row.value / tableValueMax) * 100) : 10}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="label" style={{ marginBottom: "0.3rem" }}>{lang === "es" ? "Fecha" : "Date"}</div>
                      <strong>{row.date}</strong>
                    </div>
                  </div>
                  <div className="explorer-card__footer">
                    <span>{row.modality}</span>
                    {hasSecopLink(row.secopUrl) ? (
                      <Link href={row.secopUrl} target="_blank" className="btn-secondary">
                        {copy.verify} <ArrowUpRight size={14} aria-hidden={true} />
                      </Link>
                    ) : (
                      <span className="btn-secondary cv-link-disabled">
                        {lang === "es" ? "Sin enlace SECOP" : "No SECOP link"}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="cv-empty-state surface-soft">
              {lang === "es"
                ? `Muestra de tabla cargada: 0 filas. Contratos en el slice activo: ${visibleContracts.toLocaleString("es-CO")}. Prueba cargar otra página, ampliar la búsqueda o quitar algún filtro.`
                : `Loaded table sample: 0 rows. Active slice contracts: ${visibleContracts.toLocaleString("en-US")}. Try another page, widening the search, or removing a filter.`}
            </div>
          )}

          <div className="cv-pagination">
            <button
              type="button"
              className="btn-secondary"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              {copy.previous}
            </button>
            <span className="label">
              {lang === "es"
                ? `Página ${page + 1} de ${totalPages}`
                : `Page ${page + 1} of ${totalPages}`}
            </span>
            <button
              type="button"
              className="btn-secondary"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
            >
              {copy.next}
            </button>
          </div>
        </section>

        <section className="cv-block surface-soft">
          <details className="cv-collapsible">
            <summary>
              <span>{lang === "es" ? "ℹ Metodología del scoring: clic para expandir" : "ℹ Scoring methodology: click to expand"}</span>
            </summary>

            <div className="cv-methodology-groups">
              {MODEL_GROUPS[lang].map((group) => (
                <article key={group.title} className="cv-methodology-card">
                  <strong>{group.title}</strong>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="cv-methodology">
              <p>
                {lang === "es"
                  ? `El modelo actual trabaja con ${overview?.methodology.nFeatures ?? 14} variables y marca como rojo los contratos por encima de ${Math.round((overview?.methodology.redThreshold ?? 0.7) * 100)}/100. La familia técnica del modelo es ${overview?.methodology.modelType ?? "modelo de anomalías"}, pero aquí lo importante es su función: comparar cada contrato contra pares parecidos para detectar desvíos relevantes.`
                  : `The current model works with ${overview?.methodology.nFeatures ?? 14} variables and flags as red the contracts above ${Math.round((overview?.methodology.redThreshold ?? 0.7) * 100)}/100. The technical family is ${overview?.methodology.modelType ?? "anomaly model"}, but what matters here is its function: compare each contract against similar peers to detect relevant deviations.`}
              </p>
              <div className="cv-methodology__note">
                <span>{lang === "es" ? "Entrenado" : "Trained"}: {overview?.methodology.trainedAt ?? (lang === "es" ? "último ciclo diario" : "last daily cycle")}</span>
                <span>{lang === "es" ? "Ámbar desde" : "Amber from"}: {Math.round((overview?.methodology.yellowThreshold ?? 0.4) * 100)}/100</span>
                <span>{lang === "es" ? "Rojo desde" : "Red from"}: {Math.round((overview?.methodology.redThreshold ?? 0.7) * 100)}/100</span>
                <span>{lang === "es" ? "Estimadores" : "Estimators"}: {overview?.methodology.nEstimators ?? 100}</span>
              </div>
            </div>
          </details>
        </section>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
