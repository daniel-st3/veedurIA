"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ArrowUpRight, Database, Filter, Search } from "lucide-react";

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

const INITIAL_FILTERS: FilterState = {
  department: undefined,
  risk: "all",
  modality: undefined,
  query: "",
  dateFrom: "",
  dateTo: "",
  full: false,
};

function ContractsLoading() {
  return (
    <main className="page cv-page">
      <section className="surface stripe-flag" style={{ marginTop: "1.2rem", padding: "2rem" }}>
        <div className="skeleton skeleton--pill" style={{ width: 160, marginBottom: 16 }} />
        <div className="skeleton skeleton--title" style={{ width: "58%", marginBottom: 10 }} />
        <div className="skeleton skeleton--line" style={{ width: "78%" }} />
      </section>
    </main>
  );
}

function formatGapDays(lang: Lang, gapDays?: number | null) {
  if (gapDays === null || gapDays === undefined) {
    return lang === "es" ? "sin dato" : "no data";
  }
  if (gapDays <= 0) {
    return lang === "es" ? "al día" : "up to date";
  }
  return lang === "es" ? `${gapDays} días` : `${gapDays} days`;
}

function riskSentence(lang: Lang, riskBand: LeadCase["riskBand"]) {
  if (riskBand === "high") {
    return lang === "es"
      ? "Se aparta con fuerza del patrón típico y conviene revisarlo primero."
      : "It strongly deviates from the typical pattern and should be reviewed first.";
  }
  if (riskBand === "medium") {
    return lang === "es"
      ? "Rompe parcialmente el patrón y necesita contexto antes de concluir."
      : "It partially breaks the pattern and needs context before any conclusion.";
  }
  return lang === "es"
    ? "Se mantiene más cerca del patrón histórico y sirve para contrastar."
    : "It stays closer to the historical pattern and is useful for contrast.";
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
  const liveContracts = freshness?.liveFeed.contracts ?? [];
  const totalPages = table ? Math.max(1, Math.ceil(table.total / 24)) : 1;
  const isBooting = loading && !overview;
  const leadCaseMax = leadCases.reduce((max, item) => Math.max(max, item.score), 100);
  const tableValueMax = tableRows.reduce((max, row) => Math.max(max, row.value), 0);
  const activeSlice = [
    filters.department,
    filters.risk !== "all" ? (filters.risk === "high" ? copy.riskHigh : filters.risk === "medium" ? copy.riskMedium : copy.riskLow) : null,
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
    if (!hasStrongFilters && overview?.meta.totalRows) return overview.meta.totalRows;
    return overview?.slice.totalContracts ?? 0;
  }, [hasStrongFilters, overview]);

  const latestScoredDate = overview?.meta.latestContractDate ?? "—";
  const latestSourceDate = freshness?.sourceLatestContractDate ?? overview?.meta.sourceLatestContractDate ?? "—";
  const freshnessGap = freshness?.sourceFreshnessGapDays ?? overview?.meta.sourceFreshnessGapDays ?? null;
  const currentDepartment = filters.department ? overview?.map.departments.find((item) => item.geoName === filters.department) : null;

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
              <h1>{lang === "es" ? "Lee primero lo que merece revisión" : "Read what deserves review first"}</h1>
              <p className="cv-hero-panel__body">
                {lang === "es"
                  ? "Contrato Limpio deja de parecer una hoja de cálculo gigante. Ahora arranca con un corte claro, un mapa legible y una lista corta de casos que sí ayudan a entender el riesgo."
                  : "Contrato Limpio no starts like a giant spreadsheet. It now begins with a clear slice, a legible map, and a short case list that actually helps explain risk."}
              </p>
            </div>

            <div className="cv-hero-metric">
              <span className="cv-hero-metric__label">
                {hasStrongFilters
                  ? lang === "es" ? "Contratos en este corte" : "Contracts in this slice"
                  : lang === "es" ? "Universo nacional cargado" : "Loaded national universe"}
              </span>
              <strong>{headlineContracts.toLocaleString("es-CO")}</strong>
              <p>
                {hasStrongFilters
                  ? lang === "es"
                    ? "La cifra ya responde a tus filtros activos."
                    : "This number already reflects your active filters."
                  : lang === "es"
                    ? "Usamos el número grande del histórico disponible para que la lectura nacional no se vea recortada a 50 mil."
                    : "The national view uses the full historical universe instead of an artificial 50k ceiling."}
              </p>
            </div>
          </div>

          <div className="cv-slice-row">
            <div className="cv-slice-pill">
              <span>{lang === "es" ? "Lectura actual" : "Current read"}</span>
              <strong>{activeSlice.length ? activeSlice.join(" · ") : copy.currentSliceDefault}</strong>
            </div>
            <div className="cv-slice-pill">
              <span>{lang === "es" ? "Señales altas" : "High-priority cases"}</span>
              <strong>{(overview?.slice.redAlerts ?? 0).toLocaleString("es-CO")}</strong>
            </div>
            <div className="cv-slice-pill">
              <span>{lang === "es" ? "Valor bajo revisión" : "Value under review"}</span>
              <strong>{overview?.slice.prioritizedValueLabel ?? "—"}</strong>
            </div>
            <div className="cv-slice-pill">
              <span>{lang === "es" ? "Último contrato puntuado" : "Latest scored contract"}</span>
              <strong>{latestScoredDate}</strong>
            </div>
          </div>

          <div className="cv-filter-grid">
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

          <p className="cv-helper-copy">
            {draft.full
              ? lang === "es"
                ? "Historial completo activo. La lectura puede tardar más, pero ya no depende de la muestra rápida."
                : "Full history active. Reading may take longer, but it no longer depends on the quick sample."
              : lang === "es"
                ? "La muestra rápida sirve para velocidad. Cuando no hay filtros fuertes, el titular usa el universo histórico real para no subrepresentar el país."
                : "Quick mode keeps the interaction fast. Without strong filters, the headline uses the real historical universe so the country is not underrepresented."}
          </p>
        </section>

        <section className="cv-block surface">
          <div className="cv-block__header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Mapa de riesgo" : "Risk map"}</p>
              <h2>{lang === "es" ? "Dónde conviene mirar primero" : "Where review should start"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "El mapa ya no compite con otra columna. Queda solo, con una escala más contrastada para que el patrón territorial sí se vea."
                : "The map no longer competes with a second column. It stands on its own with a more contrasted scale so the territorial pattern is visible."}
            </p>
          </div>

          <div className="cv-map-guide">
            <article>
              <strong>{lang === "es" ? "Azul" : "Blue"}</strong>
              <p>{lang === "es" ? "Territorios más cerca de la línea base del conjunto observado." : "Territories that stay closer to the observed baseline."}</p>
            </article>
            <article>
              <strong>{lang === "es" ? "Amarillo" : "Yellow"}</strong>
              <p>{lang === "es" ? "Territorios intermedios donde conviene abrir casos y comparar." : "Intermediate territories where cases should be opened and compared."}</p>
            </article>
            <article>
              <strong>{lang === "es" ? "Rojo" : "Red"}</strong>
              <p>{lang === "es" ? "Territorios que concentran la señal más fuerte del corte visible." : "Territories concentrating the strongest visible signal."}</p>
            </article>
          </div>

          <div className="cv-map-frame">
            {geojson && overview ? (
              <ColombiaMap
                geojson={geojson}
                departments={overview.map.departments}
                activeDepartment={filters.department}
                showCaption
                captionTitle={lang === "es" ? "Territorio enfocado" : "Focused territory"}
                captionBody={
                  currentDepartment
                    ? `${currentDepartment.contractCount.toLocaleString("es-CO")} ${lang === "es" ? "contratos visibles" : "visible contracts"} · ${Math.round(currentDepartment.avgRisk * 100)}/100 ${lang === "es" ? "de intensidad" : "intensity"}`
                    : undefined
                }
                onSelect={(department) => {
                  const next = { ...filters, department: department === filters.department ? undefined : department };
                  setDraft(next);
                  setFilters(next);
                  setPage(0);
                }}
              />
            ) : (
              <div className="surface" style={{ height: 420, display: "grid", placeItems: "center" }}>
                <span className="label">{copy.loading}</span>
              </div>
            )}
          </div>

          <div className="cv-territory-chips">
            {(overview?.map.departments ?? [])
              .sort((left, right) => right.avgRisk - left.avgRisk)
              .slice(0, 8)
              .map((department) => (
                <button
                  key={department.geoName}
                  type="button"
                  className={`territory-chip ${department.geoName === filters.department ? "territory-chip--active" : ""}`}
                  onClick={() => {
                    const next = {
                      ...filters,
                      department: department.geoName === filters.department ? undefined : department.geoName,
                    };
                    setDraft(next);
                    setFilters(next);
                    setPage(0);
                  }}
                >
                  <span>{department.label}</span>
                  <span className="territory-chip__meter" style={{ width: `${Math.max(16, department.avgRisk * 100)}%` }} />
                </button>
              ))}
          </div>
        </section>

        <section className="cv-block surface stripe-red">
          <div className="cv-block__header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Caso principal" : "Lead case"}</p>
              <h2>{lang === "es" ? "El contrato que mejor resume este corte" : "The contract that best summarizes this slice"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "Aquí se abre la lectura principal. No es una acusación automática: es el caso que mejor combina señal, monto, contexto y verificabilidad."
                : "This is the main reading point. It is not an automatic accusation: it is the case combining signal, value, context, and verifiability most clearly."}
            </p>
          </div>

          {selectedCase ? (
            <>
              <div className="cv-focus-head">
                <div>
                  <span className="cv-focus-head__kicker">{selectedCase.pickReason}</span>
                  <h3>{selectedCase.entity}</h3>
                  <p>{selectedCase.signal}</p>
                </div>
                <div className="cv-score-badge">
                  <strong>{selectedCase.score}</strong>
                  <span>/100</span>
                </div>
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
                <p>{riskSentence(lang, selectedCase.riskBand)}</p>
                <Link href={selectedCase.secopUrl || "#"} target="_blank" className="btn-secondary">
                  {copy.verify} <ArrowUpRight size={16} />
                </Link>
              </div>

              <div className="cv-factor-list">
                {selectedCase.factors.map((factor) => (
                  <article key={factor.key} className="cv-factor-row">
                    <div>
                      <strong>{factor.label}</strong>
                      <span>{lang === "es" ? "peso en la señal" : "weight in the signal"}</span>
                    </div>
                    <div className="cv-factor-row__bar">
                      <span style={{ width: `${Math.max(8, factor.severity * 100)}%` }} />
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
              <p className="eyebrow">{lang === "es" ? "Casos para contrastar" : "Contrast cases"}</p>
              <h2>
                {lang === "es"
                  ? `${leadCases.length} casos guía que cambian con el corte`
                  : `${leadCases.length} guide cases that change with the slice`}
              </h2>
            </div>
            <p>
              {lang === "es"
                ? "Cada vez que cambias territorio, riesgo o fechas, esta lista se rehace. La idea es contrastar patrones, no leer un ranking congelado."
                : "Whenever you change territory, risk, or dates, this list is rebuilt. The goal is to contrast patterns, not read a frozen ranking."}
            </p>
          </div>

          {leadCases.length ? (
            <div className="cv-case-grid">
              {leadCases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`cv-case-chip ${selectedCase?.id === item.id ? "cv-case-chip--active" : ""}`}
                  onClick={() => setSelectedCase(item)}
                >
                  <div className="cv-case-chip__top">
                    <span>{item.pickReason}</span>
                    <strong>{item.score}</strong>
                  </div>
                  <h3>{item.entity}</h3>
                  <p>{item.department} · {item.valueLabel}</p>
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
              <h2>{lang === "es" ? "Qué se repite en este corte" : "What repeats in this slice"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "Antes de bajar al explorador completo, aquí quedan las entidades y modalidades que más ayudan a entender el patrón."
                : "Before dropping into the full explorer, these are the entities and modalities that best explain the pattern."}
            </p>
          </div>

          <div className="cv-summary-grid">
            <article className="cv-summary-card">
              <h3>{lang === "es" ? "Entidades que suben primero" : "Entities rising first"}</h3>
              <div className="cv-summary-list">
                {summaryEntities.map((item) => (
                  <div key={item.nombre_entidad} className="cv-summary-row">
                    <div>
                      <strong>{item.nombre_entidad}</strong>
                      <span>{item.contracts} {copy.summaryContracts}</span>
                    </div>
                    <div className="cv-summary-row__meter">
                      <span style={{ width: `${Math.max(14, item.maxRisk * 100)}%` }} />
                    </div>
                    <strong>{Math.round(item.maxRisk * 100)}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="cv-summary-card">
              <h3>{lang === "es" ? "Modalidades que más concentran señal" : "Modalities concentrating the signal"}</h3>
              <div className="cv-summary-list">
                {summaryModalities.map((item) => (
                  <div key={item.modalidad_de_contratacion} className="cv-summary-row">
                    <div>
                      <strong>{item.modalidad_de_contratacion}</strong>
                      <span>{item.contracts} {copy.summaryContracts}</span>
                    </div>
                    <div className="cv-summary-row__meter">
                      <span style={{ width: `${Math.max(14, item.meanRisk * 100)}%` }} />
                    </div>
                    <strong>{Math.round(item.meanRisk * 100)}</strong>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="cv-block surface stripe-blue">
          <div className="cv-block__header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Evidencia y contexto" : "Evidence and context"}</p>
              <h2>{lang === "es" ? "Cómo leer la señal sin exagerarla" : "How to read the signal without overstating it"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "Esta zona queda entre el resumen, el explorador y la metodología para no romper la lectura principal."
                : "This section now sits between the summary, the explorer, and the methodology to keep the main reading intact."}
            </p>
          </div>

          <div className="cv-context-grid">
            <article>
              <strong>{lang === "es" ? "Qué significa una señal alta" : "What a high signal means"}</strong>
              <p>{lang === "es" ? "Que el contrato se aparta del comportamiento más común del conjunto observado por monto, competencia, proveedor, tiempo o combinación de esos factores." : "It means the contract departs from the most common behavior in the observed set through value, competition, provider, timing, or a combination of those factors."}</p>
            </article>
            <article>
              <strong>{lang === "es" ? "Qué no significa" : "What it does not mean"}</strong>
              <p>{lang === "es" ? "No demuestra ilegalidad ni reemplaza una investigación. Sirve para priorizar revisión humana y volver a la fuente oficial con una hipótesis más clara." : "It does not prove illegality or replace an investigation. It prioritizes human review and sends the reader back to the official source with a clearer hypothesis."}</p>
            </article>
            <article>
              <strong>{lang === "es" ? "Qué hacer después" : "What to do next"}</strong>
              <p>{lang === "es" ? "Comparar con otros casos del mismo territorio, abrir el expediente en SECOP II y revisar si la señal se sostiene al mirar documentos, plazos y antecedentes." : "Compare against similar cases in the same territory, open the record in SECOP II, and check whether the signal still holds once documents, timing, and history are reviewed."}</p>
            </article>
          </div>
        </section>

        <section className="cv-block surface stripe-green">
          <div className="cv-block__header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Diferencia de actualización" : "Update gap"}</p>
              <h2>{lang === "es" ? "Qué ya fue puntuado y qué acaba de entrar" : "What has been scored and what just arrived"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "La frescura del dato ahora queda explicada en términos simples: una fecha para la capa analítica, otra para SECOP y una brecha fácil de leer."
                : "Data freshness is now explained in simple terms: one date for the analysis layer, one for SECOP, and an easy-to-read gap."}
            </p>
          </div>

          <div className="cv-fresh-grid">
            <article className="cv-fresh-card">
              <span>{lang === "es" ? "Capa analítica" : "Analysis layer"}</span>
              <strong>{latestScoredDate}</strong>
            </article>
            <article className="cv-fresh-card">
              <span>{lang === "es" ? "SECOP oficial" : "Official SECOP"}</span>
              <strong>{latestSourceDate}</strong>
            </article>
            <article className="cv-fresh-card">
              <span>{lang === "es" ? "Brecha visible" : "Visible gap"}</span>
              <strong>{formatGapDays(lang, freshnessGap)}</strong>
            </article>
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
              {lang === "es"
                ? "No hay una muestra en vivo disponible en este momento."
                : "No live sample is available right now."}
            </div>
          )}
        </section>

        <section className="cv-block surface">
          <div className="cv-block__header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Explorador" : "Explorer"}</p>
              <h2>{lang === "es" ? "La evidencia completa del corte" : "The full evidence for this slice"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "Aquí sí entra el explorador completo, después del mapa, el caso principal y el contexto."
                : "The full explorer comes here, after the map, the lead case, and the context."}
            </p>
          </div>

          {tableLoading ? (
            <div className="surface-soft" style={{ padding: "1.2rem", textAlign: "center" }}>{copy.loading}</div>
          ) : (
            <>
              <div className="cv-explorer-grid">
                {tableRows.map((row) => (
                  <article
                    key={row.id}
                    className={`explorer-card stripe-${row.riskBand === "high" ? "red" : row.riskBand === "medium" ? "yellow" : "green"}`}
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
                        <div className="label" style={{ marginBottom: "0.3rem" }}>{copy.tableModality}</div>
                        <div className="body-copy" style={{ fontSize: "0.82rem" }}>{row.modality}</div>
                      </div>
                    </div>
                    <div className="explorer-card__footer">
                      <span className="tiny-pill">{row.date}</span>
                      <Link href={row.secopUrl || "#"} target="_blank" className="btn-secondary" style={{ padding: "0.5rem 0.8rem" }}>
                        <ArrowUpRight size={15} /> SECOP
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              <div className="cv-pagination">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={page === 0}
                  style={{ opacity: page === 0 ? 0.5 : 1 }}
                >
                  {copy.previous}
                </button>
                <div className="label">{page + 1} / {totalPages}</div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                  disabled={page >= totalPages - 1}
                  style={{ opacity: page >= totalPages - 1 ? 0.5 : 1 }}
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
              <h2>{lang === "es" ? "Explicación formal, sin jerga innecesaria" : "Formal explanation without unnecessary jargon"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "La metodología queda escrita para cualquier persona, no solo para alguien que ya sabe modelos de anomalía."
                : "The methodology is written for any reader, not only for someone who already knows anomaly models."}
            </p>
          </div>

          <div className="cv-methodology">
            <p>
              {lang === "es"
                ? "El sistema compara cada contrato con miles de contratos parecidos usando variables legibles: valor, modalidad, competencia, concentración del proveedor y momento de firma. A partir de esa comparación calcula qué tan lejos está del comportamiento más frecuente."
                : "The system compares each contract with thousands of similar contracts using readable variables: value, modality, competition, provider concentration, and signing date. From that comparison it calculates how far the contract is from the most frequent behavior."}
            </p>
            <p>
              {lang === "es"
                ? "Cuando un contrato se aleja mucho del patrón observado, su puntaje sube. Ese puntaje sirve para ordenar revisión humana. No reemplaza una auditoría, una denuncia ni una conclusión jurídica."
                : "When a contract moves far away from the observed pattern, its score goes up. That score is meant to order human review. It does not replace an audit, a complaint, or a legal conclusion."}
            </p>
            <p>
              {lang === "es"
                ? "Las barras que ves en cada caso explican por qué subió: por ejemplo, poca competencia, precio fuera de rango, proveedor recurrente o una combinación de varios factores al mismo tiempo."
                : "The bars shown in each case explain why it rose: for example, low competition, out-of-range pricing, a recurrent provider, or a combination of several factors at once."}
            </p>
            <div className="cv-methodology__note">
              <span>{overview?.methodology.nFeatures ?? 25} {lang === "es" ? "variables explicables" : "explainable variables"}</span>
              <span>{lang === "es" ? "entrenamiento más reciente" : "latest training"}: {overview?.methodology.trainedAt ?? "—"}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
