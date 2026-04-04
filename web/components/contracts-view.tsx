"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  ArrowUpRight,
  Database,
  Download,
  Filter,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { ColombiaMap } from "@/components/colombia-map";
import { SiteNav } from "@/components/site-nav";
import { fetchContractsFreshness, fetchContractsTable, fetchGeoJson, fetchOverview } from "@/lib/api";
import { contractsCopy } from "@/lib/copy";
import type { ContractsFreshnessPayload, Lang, LeadCase, OverviewPayload, TablePayload } from "@/lib/types";

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

function ContractsLoading() {
  return (
    <main className="page cv-page">
      <section className="surface stripe-flag" style={{ marginTop: "1.2rem", padding: "2rem" }}>
        <div className="skeleton skeleton--pill" style={{ width: 180, marginBottom: 16 }} />
        <div className="skeleton skeleton--title" style={{ width: "62%", marginBottom: 10 }} />
        <div className="skeleton skeleton--line" style={{ width: "78%" }} />
      </section>
    </main>
  );
}

function normalizeIso(raw?: string | null) {
  if (!raw) return "";
  return raw.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
}

function formatPortalUpdated(lang: Lang, raw?: string | null) {
  if (!raw) return lang === "es" ? "sin dato" : "no data";
  const date = new Date(normalizeIso(raw));
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(lang === "es" ? "es-CO" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(date);
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

export function ContractsView({
  lang,
  initialOverview,
  initialTable,
  initialGeojson,
}: {
  lang: Lang;
  initialOverview?: OverviewPayload | null;
  initialTable?: TablePayload | null;
  initialGeojson?: any | null;
}) {
  const copy = contractsCopy[lang];
  const [draft, setDraft] = useState<FilterState>(INITIAL_FILTERS);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [overview, setOverview] = useState<OverviewPayload | null>(initialOverview ?? null);
  const [table, setTable] = useState<TablePayload | null>(initialTable ?? null);
  const [geojson, setGeojson] = useState<any>(initialGeojson ?? null);
  const [freshness, setFreshness] = useState<ContractsFreshnessPayload | null>(null);
  const [loading, setLoading] = useState(!initialOverview);
  const [tableLoading, setTableLoading] = useState(!initialTable);
  const [selectedCase, setSelectedCase] = useState<LeadCase | null>(initialOverview?.leadCases?.[0] ?? null);
  const [page, setPage] = useState(0);
  const [overviewInitialized, setOverviewInitialized] = useState(Boolean(initialOverview));
  const [tableInitialized, setTableInitialized] = useState(Boolean(initialTable));
  const [explorerGroup, setExplorerGroup] = useState<ExplorerGroupKey>("department");

  useEffect(() => {
    if (geojson) return;
    fetchGeoJson()
      .then((data) => {
        if (data) setGeojson(data);
      })
      .catch(() => {});
  }, [geojson]);

  useEffect(() => {
    let alive = true;
    fetchContractsFreshness()
      .then((data) => {
        if (alive) setFreshness(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

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
      .finally(() => {
        if (alive) setTableLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [filters, lang, page, tableInitialized]);

  const leadCases = overview?.leadCases ?? [];
  const summaryEntities = overview?.summaries.entities ?? [];
  const summaryModalities = overview?.summaries.modalities ?? [];
  const tableRows = table?.rows ?? [];
  const liveContracts = freshness?.liveFeed.contracts?.length ? freshness.liveFeed.contracts : overview?.liveFeed.contracts ?? [];
  const totalPages = table ? Math.max(1, Math.ceil(table.total / 24)) : 1;
  const isBooting = loading && !overview;
  const leadCaseMax = Math.max(...leadCases.map((item) => item.score), 100);
  const tableValueMax = Math.max(...tableRows.map((row) => row.value), 0);
  const activeSlice = [
    filters.department,
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

  const hasStrongFilters = Boolean(
    filters.department ||
      filters.modality ||
      filters.query ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.risk !== "all",
  );

  const headlineContracts = useMemo(() => {
    if (!hasStrongFilters && freshness?.sourceRows) return freshness.sourceRows;
    if (!hasStrongFilters && overview?.meta.sourceRows) return overview.meta.sourceRows;
    if (!hasStrongFilters && overview?.meta.totalRows) return overview.meta.totalRows;
    return overview?.slice.totalContracts ?? 0;
  }, [freshness?.sourceRows, hasStrongFilters, overview]);

  const latestScoredDate = overview?.meta.latestContractDate ?? freshness?.latestContractDate ?? "—";
  const latestSourceDate = freshness?.sourceLatestContractDate ?? overview?.meta.sourceLatestContractDate ?? "—";
  const freshnessGap = freshness?.sourceFreshnessGapDays ?? overview?.meta.sourceFreshnessGapDays ?? null;
  const sourceUpdatedAt = freshness?.sourceUpdatedAt ?? overview?.meta.sourceUpdatedAt ?? null;
  const currentDepartment = filters.department
    ? overview?.map?.departments.find((item) => item.geoName === filters.department)
    : null;
  const explorerGroups = useMemo(() => buildExplorerGroups(tableRows, explorerGroup), [tableRows, explorerGroup]);
  const selectedTone = selectedCase ? scoreTone(selectedCase.score) : "low";
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
      value: overview?.slice.dominantDepartment ?? "—",
      note: lang === "es" ? "mayor volumen dentro del corte actual" : "largest volume inside the current slice",
    },
    {
      label: lang === "es" ? "Entidad más cargada arriba" : "Top entity in the slice",
      value: summaryEntities[0]?.nombre_entidad ?? "—",
      note:
        summaryEntities[0]
          ? `${summaryEntities[0].contracts.toLocaleString("es-CO")} ${lang === "es" ? "contratos" : "contracts"}`
          : "—",
    },
    {
      label: lang === "es" ? "Modalidad más sensible" : "Most sensitive modality",
      value: summaryModalities[0]?.modalidad_de_contratacion ?? "—",
      note:
        summaryModalities[0]
          ? `${Math.round(summaryModalities[0].meanRisk * 100)}/100 ${lang === "es" ? "de intensidad media" : "average intensity"}`
          : "—",
    },
    {
      label: lang === "es" ? "Último contrato oficial" : "Latest official contract",
      value: latestSourceDate,
      note:
        sourceUpdatedAt
          ? `${lang === "es" ? "portal actualizado" : "portal updated"} ${formatPortalUpdated(lang, sourceUpdatedAt)}`
          : lang === "es"
            ? "sin hora oficial visible"
            : "no visible official timestamp",
    },
  ];

  if (isBooting) {
    return (
      <div className="shell">
        <SiteNav
          lang={lang}
          links={[
            { href: `/contrato-limpio?lang=${lang}`, label: copy.navPhase1 },
            { href: `/promesmetro?lang=${lang}`, label: copy.navPhase2 },
            { href: `/sigue-el-dinero?lang=${lang}`, label: copy.navPhase3 },
          ]}
        />
        <ContractsLoading />
      </div>
    );
  }

  return (
    <div className="shell">
      <SiteNav
        lang={lang}
        links={[
          { href: `/contrato-limpio?lang=${lang}`, label: copy.navPhase1 },
          { href: `/promesmetro?lang=${lang}`, label: copy.navPhase2 },
          { href: `/sigue-el-dinero?lang=${lang}`, label: copy.navPhase3 },
        ]}
      />

      <main className="page cv-page">
        <section className="cv-hero-panel surface stripe-flag">
          <div className="cv-hero-panel__top">
            <div>
              <p className="eyebrow">{copy.pageEyebrow}</p>
              <h1>{lang === "es" ? "Contratos que vale la pena abrir primero" : "Contracts worth opening first"}</h1>
              <p className="cv-hero-panel__body">
                {lang === "es"
                  ? "Usa el filtro, mira el patrón territorial y baja al caso principal. Lo que cambia con tu corte queda separado de la información fija de la fuente para que no se mezcle."
                  : "Use the filters, read the territorial pattern, and move down into the lead case. What changes with your slice is separated from the fixed source information so they do not get mixed."}
              </p>
            </div>

            <div className="cv-hero-kpis">
              <article className="cv-hero-kpi cv-hero-kpi--yellow">
                <span>{hasStrongFilters ? (lang === "es" ? "Corte actual" : "Current slice") : lang === "es" ? "Fuente oficial" : "Official source"}</span>
                <strong>{headlineContracts.toLocaleString("es-CO")}</strong>
                <p>
                  {hasStrongFilters
                    ? lang === "es"
                      ? "contratos visibles con tus filtros activos"
                      : "visible contracts under your active filters"
                    : lang === "es"
                      ? "registros disponibles en la fuente nacional"
                      : "records available in the national source"}
                </p>
              </article>
              <article className="cv-hero-kpi cv-hero-kpi--red">
                <span>{lang === "es" ? "Alertas altas" : "High alerts"}</span>
                <strong>{(overview?.slice.redAlerts ?? 0).toLocaleString("es-CO")}</strong>
                <p>{lang === "es" ? "casos priorizados para revisar" : "prioritized cases to review"}</p>
              </article>
            </div>
          </div>

          <div className="cv-workbench">
            <section className="cv-control-panel surface-soft">
              <div className="cv-control-panel__head">
                <div>
                  <p className="eyebrow">{lang === "es" ? "Arma tu corte" : "Set your slice"}</p>
                  <h2>{lang === "es" ? "Filtra primero, compara después" : "Filter first, compare next"}</h2>
                </div>
                <p>
                  {lang === "es"
                    ? "1. Ajusta filtros. 2. Mira cómo cambia el mapa. 3. Baja al caso principal y al explorador para revisar evidencia."
                    : "1. Adjust filters. 2. Watch the map change. 3. Move down into the lead case and explorer to inspect evidence."}
                </p>
              </div>

              <div className="cv-context-strip">
                <article className="cv-context-card cv-context-card--dynamic">
                  <span>{lang === "es" ? "Sí cambia con tus filtros" : "Changes with your filters"}</span>
                  <strong>{activeSlice.length ? activeSlice.join(" · ") : copy.currentSliceDefault}</strong>
                  <p>
                    {lang === "es"
                      ? `${(overview?.slice.totalContracts ?? 0).toLocaleString("es-CO")} contratos visibles y lectura territorial del corte activo.`
                      : `${(overview?.slice.totalContracts ?? 0).toLocaleString("en-US")} visible contracts and territorial readout for the active slice.`}
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
                    <Search size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />
                    {copy.searchLabel}
                  </span>
                  <input
                    value={draft.query ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, query: event.target.value }))}
                    placeholder={copy.searchPlaceholder}
                  />
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

              <div className="cv-control-panel__actions">
                <button
                  type="button"
                  className="btn-primary cv-filter-action"
                  onClick={() => {
                    setPage(0);
                    setFilters(draft);
                  }}
                >
                  <Filter size={15} />
                  {copy.applyFilters}
                </button>

                <button
                  type="button"
                  className="btn-secondary cv-filter-action"
                  onClick={() => {
                    const next = { ...draft, full: !draft.full };
                    setDraft(next);
                    setPage(0);
                    setFilters(next);
                  }}
                >
                  <Database size={15} />
                  {draft.full ? copy.togglePreview : copy.toggleFull}
                </button>
              </div>

              <p className="cv-helper-copy cv-helper-copy--compact">
                {draft.full
                  ? lang === "es"
                    ? "Historial completo activo. La consulta tarda más, pero deja de depender de la muestra rápida."
                    : "Full history is active. The query takes longer, but no longer depends on the quick sample."
                  : lang === "es"
                    ? "La interacción rápida trabaja sobre la muestra priorizada; el titular principal sigue mostrando el tamaño real de la fuente cuando no hay filtros fuertes."
                    : "Fast interaction uses the prioritized sample; the headline still shows the real source size when there are no strong filters."}
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
                    ? "Haz clic en un departamento para cambiar el corte. Lo que ves abajo usa esa misma selección."
                    : "Click a department to change the slice. What you see below uses that same selection."}
                </p>
              </div>

              <div className="cv-map-insight-row">
                <article className="cv-map-insight">
                  <span>{lang === "es" ? "Departamento activo" : "Active department"}</span>
                  <strong>{currentDepartment?.label ?? (lang === "es" ? "Colombia completa" : "Whole Colombia")}</strong>
                </article>
                <article className="cv-map-insight">
                  <span>{lang === "es" ? "Contratos visibles" : "Visible contracts"}</span>
                  <strong>{currentDepartment?.contractCount?.toLocaleString("es-CO") ?? (overview?.slice.totalContracts ?? 0).toLocaleString("es-CO")}</strong>
                </article>
                <article className="cv-map-insight">
                  <span>{lang === "es" ? "Intensidad media" : "Average intensity"}</span>
                  <strong>{currentDepartment ? `${Math.round(currentDepartment.avgRisk * 100)}/100` : `${sliceMeanScore}/100`}</strong>
                </article>
              </div>

              <div className="cv-map-guide cv-map-guide--inline">
                <article>
                  <strong>{lang === "es" ? "Azul" : "Blue"}</strong>
                  <p>{lang === "es" ? "Más cerca del patrón típico del corte." : "Closer to the slice's usual pattern."}</p>
                </article>
                <article>
                  <strong>{lang === "es" ? "Ámbar" : "Amber"}</strong>
                  <p>{lang === "es" ? "Territorio para contrastar con casos concretos." : "A territory worth contrasting with concrete cases."}</p>
                </article>
                <article>
                  <strong>{lang === "es" ? "Rojo" : "Red"}</strong>
                  <p>{lang === "es" ? "Concentra la señal más fuerte del corte visible." : "Concentrates the strongest signal in the visible slice."}</p>
                </article>
              </div>

              <div className="cv-map-frame cv-map-frame--compact cv-map-frame--workbench">
                {geojson && overview ? (
                  <ColombiaMap
                    geojson={geojson}
                    departments={overview.map.departments}
                    activeDepartment={filters.department}
                    showCaption
                    captionTitle={lang === "es" ? "Lectura actual" : "Current readout"}
                    captionBody={
                      currentDepartment
                        ? `${currentDepartment.contractCount.toLocaleString("es-CO")} ${lang === "es" ? "contratos visibles" : "visible contracts"} · ${Math.round(currentDepartment.avgRisk * 100)}/100 ${lang === "es" ? "de intensidad" : "intensity"}`
                        : `${(overview?.slice.totalContracts ?? 0).toLocaleString("es-CO")} ${lang === "es" ? "contratos visibles" : "visible contracts"} · ${sliceMeanScore}/100`
                    }
                    onSelect={(department) => {
                      const next = { ...filters, department: department === filters.department ? undefined : department };
                      setDraft(next);
                      setFilters(next);
                      setPage(0);
                    }}
                  />
                ) : (
                  <div className="surface" style={{ height: 360, display: "grid", placeItems: "center" }}>
                    <span className="label">{copy.loading}</span>
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>

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
                  <h3>{selectedCase.entity}</h3>
                  <p>{selectedCase.signal}</p>
                </div>
                <div className={`cv-score-badge cv-score-badge--${selectedTone}`}>
                  <span>{bandLabel(lang, selectedCase.riskBand)}</span>
                  <strong>{selectedCase.score}</strong>
                  <small>/100</small>
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
                  <strong>{filters.department && departmentMeanRisk !== null ? `${departmentMeanScore}/100` : "—"}</strong>
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
                  <strong>{selectedCase.valueLabel}</strong>
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
                  {copy.verify} <ArrowUpRight size={16} />
                </Link>
              </div>

              <div className="cv-factor-list">
                {selectedCase.factors.length ? (
                  selectedCase.factors.map((factor) => (
                    <article key={factor.key} className="cv-factor-row">
                      <div>
                        <strong>{factor.label}</strong>
                        <span>{lang === "es" ? "aporte estimado al puntaje de este caso" : "estimated contribution to this case score"}</span>
                      </div>
                      <div className="cv-factor-row__bar">
                        <span style={{ width: `${Math.max(8, factor.severity * 100)}%` }} />
                      </div>
                      <strong>{Math.round(factor.severity * 100)}</strong>
                    </article>
                  ))
                ) : (
                  <div className="surface-soft" style={{ padding: "1rem" }}>
                    {lang === "es" ? "No hay factores detallados para este caso." : "No detailed factors for this case."}
                  </div>
                )}
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
                  <p>{item.valueLabel}</p>
                  <div className="cv-case-chip__bar">
                    <span style={{ width: `${Math.max(14, (item.score / leadCaseMax) * 100)}%` }} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="surface" style={{ padding: "1rem" }}>{copy.noCases}</div>
          )}
        </section>

        <section className="cv-block surface">
          <div className="cv-block__header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Resumen ejecutivo" : "Executive summary"}</p>
              <h2>{lang === "es" ? "Hallazgos concretos del corte" : "Concrete findings from this slice"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "Cuatro señales rápidas para entender qué se concentra aquí antes de abrir el explorador completo."
                : "Four quick signals to understand what is concentrating here before opening the full explorer."}
            </p>
          </div>

          <div className="cv-summary-grid cv-summary-grid--compact">
            {summaryHighlights.map((item) => (
              <article key={item.label} className="cv-summary-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cv-block surface stripe-green">
          <div className="cv-block__header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Últimos contratos vistos" : "Latest contracts seen"}</p>
              <h2>{lang === "es" ? "Qué acaba de aparecer en la fuente oficial" : "What just appeared in the official source"}</h2>
            </div>
            <p>
              {lang === "es"
                ? `La fuente oficial publica cortes diarios. Hoy reporta contratos hasta ${latestSourceDate} y la última actualización visible del portal es ${formatPortalUpdated(lang, sourceUpdatedAt)}. La capa analítica se compara contra ese corte y hoy está puntuada hasta ${latestScoredDate}.`
                : `The official source publishes daily cuts. Today it reports contracts through ${latestSourceDate}, and the latest visible portal update is ${formatPortalUpdated(lang, sourceUpdatedAt)}. The analytical layer is compared against that cut and is currently scored through ${latestScoredDate}.`}
            </p>
          </div>

          <div className="cv-fresh-headline">
            <div className="cv-fresh-card">
              <span>{lang === "es" ? "Portal actualizado" : "Portal updated"}</span>
              <strong>{formatPortalUpdated(lang, sourceUpdatedAt)}</strong>
            </div>
            <div className="cv-fresh-card">
              <span>{lang === "es" ? "Brecha analítica" : "Analytical gap"}</span>
              <strong>{freshnessGap === null || freshnessGap === undefined ? "—" : `${freshnessGap} ${lang === "es" ? "días" : "days"}`}</strong>
            </div>
            <div className="cv-fresh-card">
              <span>{lang === "es" ? "Filas en fuente" : "Rows at source"}</span>
              <strong>{(freshness?.sourceRows ?? overview?.meta.sourceRows ?? 0).toLocaleString("es-CO")}</strong>
            </div>
          </div>

          {liveContracts.length ? (
            <div className="contract-freshness__feed">
              {liveContracts.map((row) => (
                <Link key={row.id} href={row.secopUrl || "#"} target="_blank" className="contract-freshness__item">
                  <div>
                    <div className="label" style={{ marginBottom: "0.2rem" }}>{row.department}</div>
                    <strong>{row.entity}</strong>
                  </div>
                  <div className="contract-freshness__item-meta">
                    <span>{row.date}</span>
                    <span>{row.valueLabel}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="surface-soft" style={{ padding: "1rem" }}>
              {lang === "es" ? "No hay una muestra en vivo disponible en este momento." : "No live sample is available right now."}
            </div>
          )}
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

            <button type="button" className="btn-secondary" onClick={() => downloadRows(tableRows, lang)}>
              <Download size={15} />
              {lang === "es" ? "Exportar CSV" : "Export CSV"}
            </button>
          </div>

          {tableLoading ? (
            <div className="surface-soft" style={{ padding: "1.2rem", textAlign: "center" }}>{copy.loading}</div>
          ) : (
            <>
              <div className="cv-sandbox-groups">
                {explorerGroups.slice(0, 6).map((group) => (
                  <article key={group.label} className="cv-sandbox-group">
                    <div className="cv-sandbox-group__head">
                      <strong>{group.label}</strong>
                      <span>{group.peakScore}/100</span>
                    </div>
                    <p>{group.count.toLocaleString("es-CO")} {lang === "es" ? "registros visibles" : "visible records"}</p>
                    <div className="cv-sandbox-group__bar">
                      <span style={{ width: `${Math.max(14, group.peakScore)}%` }} />
                    </div>
                    <small>{formatMoney(group.totalValue, lang)}</small>
                  </article>
                ))}
              </div>

              <div className="cv-explorer-grid">
                {tableRows.map((row) => (
                  <article
                    key={row.id}
                    className={`explorer-card explorer-card--${row.riskBand}`}
                  >
                    <div className="explorer-card__top">
                      <div>
                        <div className="label" style={{ marginBottom: "0.3rem" }}>{row.department}</div>
                        <div className="explorer-card__title">{row.entity}</div>
                      </div>
                      <div className={`score risk-${row.riskBand}`} style={{ fontSize: "1.5rem" }}>{row.score}</div>
                    </div>
                    <div className="body-copy" style={{ fontSize: "0.82rem", marginBottom: "0.7rem" }}>{row.provider}</div>
                    <div className="explorer-card__metrics">
                      <div>
                        <div className="label" style={{ marginBottom: "0.3rem" }}>{copy.tableValue}</div>
                        <strong>{row.valueLabel}</strong>
                        <div className="table-value__track" style={{ marginTop: 6 }}>
                          <span
                            className="table-value__fill"
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
                      <Link href={row.secopUrl || "#"} target="_blank" className="btn-secondary">
                        {copy.verify} <ArrowUpRight size={14} />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

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
            </>
          )}
        </section>

        <section className="cv-block surface-soft">
          <div className="cv-block__header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Cómo se construye el puntaje" : "How the score is built"}</p>
              <h2>{lang === "es" ? "Variables que más mueven la señal" : "Variables that move the signal most"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "El puntaje va de 0 a 100. Sube cuando un contrato se aparta del patrón común de su contexto por competencia, precio, concentración o momento de firma."
                : "The score runs from 0 to 100. It does not depend on a single rule: it combines observable variables to find contracts that depart from the common pattern in their context."}
            </p>
          </div>

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
              <span>{lang === "es" ? "Entrenado" : "Trained"}: {overview?.methodology.trainedAt ?? "—"}</span>
              <span>{lang === "es" ? "Ámbar desde" : "Amber from"}: {Math.round((overview?.methodology.yellowThreshold ?? 0.4) * 100)}/100</span>
              <span>{lang === "es" ? "Rojo desde" : "Red from"}: {Math.round((overview?.methodology.redThreshold ?? 0.7) * 100)}/100</span>
              <span>{lang === "es" ? "Estimadores" : "Estimators"}: {overview?.methodology.nEstimators ?? "—"}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
