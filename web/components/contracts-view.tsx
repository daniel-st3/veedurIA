"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowUpRight,
  Database,
  Filter,
  Landmark,
  Network,
  Search,
  ShieldAlert,
  Waypoints,
} from "lucide-react";

import { ColombiaMap } from "@/components/colombia-map";
import { SiteNav } from "@/components/site-nav";
import { fetchContractsTable, fetchGeoJson, fetchOverview } from "@/lib/api";
import { contractsCopy } from "@/lib/copy";
import type { Lang, LeadCase, OverviewPayload, TablePayload } from "@/lib/types";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type FilterState = {
  department?: string;
  risk: "all" | "high" | "medium" | "low";
  modality?: string;
  query?: string;
  full: boolean;
};

type AnalysisTab = "entities" | "modalities" | "explorer" | "methodology";

const INITIAL_FILTERS: FilterState = {
  department: undefined,
  risk: "all",
  modality: undefined,
  query: "",
  full: false,
};

type ContractsCopy = (typeof contractsCopy)[Lang];

function ContractsLoading({ copy }: { copy: ContractsCopy }) {
  return (
    <main className="page">
      <section className="overview-card stripe-flag contracts-loader" style={{ margin: "1.4rem 0 1rem", padding: "1.5rem 1.6rem" }}>
        <div className="contracts-loader__hero">
          <div>
            <div className="skeleton skeleton--pill" style={{ width: 150, marginBottom: 14 }} />
            <div className="skeleton skeleton--title" style={{ width: "78%", marginBottom: 10 }} />
            <div className="skeleton skeleton--title" style={{ width: "62%", marginBottom: 18 }} />
            <div className="skeleton skeleton--line" style={{ width: "88%", marginBottom: 10 }} />
            <div className="skeleton skeleton--line" style={{ width: "76%" }} />
          </div>
          <div className="contracts-loader__metrics">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="contracts-loader__metric">
                <div className="skeleton skeleton--pill" style={{ width: 92, marginBottom: 12 }} />
                <div className="skeleton skeleton--metric" style={{ width: `${58 + index * 8}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="contracts-loader__body">
          <div className="contracts-loader__map">
            <div className="contracts-loader__map-core" />
            <div className="contracts-loader__map-ring contracts-loader__map-ring--1" />
            <div className="contracts-loader__map-ring contracts-loader__map-ring--2" />
            <div className="contracts-loader__map-ring contracts-loader__map-ring--3" />
          </div>
          <div className="contracts-loader__rail">
            <div className="label" style={{ marginBottom: "0.55rem" }}>{copy.loading}</div>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="contracts-loader__card">
                <div className="skeleton skeleton--line" style={{ width: `${72 - index * 4}%`, marginBottom: 10 }} />
                <div className="skeleton skeleton--line" style={{ width: `${54 + index * 6}%`, marginBottom: 8 }} />
                <div className="skeleton skeleton--meter" style={{ width: `${48 + index * 9}%` }} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
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
  const scope = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<FilterState>(INITIAL_FILTERS);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [overview, setOverview] = useState<OverviewPayload | null>(initialOverview ?? null);
  const [table, setTable] = useState<TablePayload | null>(initialTable ?? null);
  const [geojson, setGeojson] = useState<any>(initialGeojson ?? null);
  const [loading, setLoading] = useState(!initialOverview);
  const [tableLoading, setTableLoading] = useState(!initialTable);
  const [selectedCase, setSelectedCase] = useState<LeadCase | null>(initialOverview?.leadCases?.[0] ?? null);
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>("explorer");
  const [page, setPage] = useState(0);
  const skipFirstOverview = useRef(Boolean(initialOverview));
  const skipFirstTable = useRef(Boolean(initialTable));

  useEffect(() => {
    if (geojson) return;
    fetchGeoJson().then(setGeojson).catch(console.error);
  }, [geojson]);

  useEffect(() => {
    if (skipFirstOverview.current) {
      skipFirstOverview.current = false;
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
  }, [filters, lang]);

  useEffect(() => {
    if (skipFirstTable.current) {
      skipFirstTable.current = false;
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
  }, [filters, lang, page]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".page-hero, .map-panel, .side-panel, .summary-card, .table-card, .accordion",
          { autoAlpha: 0, y: 30 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.78,
            stagger: 0.08,
            ease: "power3.out",
          },
        );

        gsap.fromTo(
          ".command-shell .metric-shell, .command-shell .filter-field, .command-shell .slice-chip, .command-shell .action-row",
          { autoAlpha: 0, y: 22 },
          { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.05, ease: "power3.out", delay: 0.2 },
        );

        gsap.fromTo(
          ".case-card",
          { autoAlpha: 0, x: 28, scale: 0.98 },
          { autoAlpha: 1, x: 0, scale: 1, duration: 0.58, stagger: 0.08, ease: "power3.out" },
        );

        gsap.fromTo(
          ".protocol-strip__item, .reading-deck__fact, .metric-shell",
          { autoAlpha: 0, y: 24 },
          { autoAlpha: 1, y: 0, duration: 0.62, stagger: 0.06, ease: "power3.out", delay: 0.12 },
        );

        gsap.fromTo(
          ".signal-bar",
          { scaleY: 0.15 },
          {
            scaleY: 1,
            duration: 0.8,
            stagger: 0.04,
            ease: "power3.out",
            transformOrigin: "center bottom",
            delay: 0.28,
          },
        );

        gsap.fromTo(
          ".factor-fill",
          { scaleX: 0.15, autoAlpha: 0.45 },
          { scaleX: 1, autoAlpha: 1, duration: 0.68, stagger: 0.06, ease: "power3.out", transformOrigin: "left center" },
        );

        gsap.fromTo(
          ".focus-card__headline, .focus-card__factor-lead",
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08, ease: "power3.out", delay: 0.18 },
        );

        gsap.to(".map-glow", {
          xPercent: 12,
          yPercent: -8,
          duration: 5.2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });

        ScrollTrigger.batch(".summary-card, .accordion, .table-card", {
          start: "top 90%",
          once: true,
          onEnter: (batch) => {
            gsap.fromTo(
              batch,
              { autoAlpha: 0, y: 38, scale: 0.98 },
              { autoAlpha: 1, y: 0, scale: 1, duration: 0.72, stagger: 0.08, ease: "power3.out" },
            );
          },
        });

        ScrollTrigger.batch(".territory-chip", {
          start: "top 92%",
          once: true,
          onEnter: (batch) => {
            gsap.fromTo(
              batch,
              { autoAlpha: 0, x: -22 },
              { autoAlpha: 1, x: 0, duration: 0.58, stagger: 0.05, ease: "power3.out" },
            );
          },
        });

        ScrollTrigger.batch(".analysis-tab", {
          start: "top 90%",
          once: true,
          onEnter: (batch) => {
            gsap.fromTo(
              batch,
              { autoAlpha: 0, y: 16 },
              { autoAlpha: 1, y: 0, duration: 0.48, stagger: 0.05, ease: "power2.out" },
            );
          },
        });

        ScrollTrigger.batch(".analysis-panel, .explorer-card, .explorer-raw", {
          start: "top 90%",
          once: true,
          onEnter: (batch) => {
            gsap.fromTo(
              batch,
              { autoAlpha: 0, y: 34, scale: 0.985 },
              { autoAlpha: 1, y: 0, scale: 1, duration: 0.68, stagger: 0.06, ease: "power3.out" },
            );
          },
        });

        ScrollTrigger.batch(".meter-row__fill, .table-value__fill, .territory-chip__meter", {
          start: "top 92%",
          once: true,
          onEnter: (batch) => {
            gsap.fromTo(
              batch,
              { scaleX: 0.08, autoAlpha: 0.5 },
              { scaleX: 1, autoAlpha: 1, duration: 0.72, stagger: 0.04, ease: "power3.out", transformOrigin: "left center" },
            );
          },
        });

        gsap.utils.toArray<HTMLElement>(".map-panel, .analysis-suite").forEach((section) => {
          gsap.fromTo(
            section,
            { y: 0 },
            {
              y: -10,
              ease: "none",
              scrollTrigger: {
                trigger: section,
                start: "top bottom",
                end: "bottom top",
                scrub: 1,
              },
            },
          );
        });
      });

      return () => mm.revert();
    },
    { scope, dependencies: [overview?.leadCases.length ?? 0, selectedCase?.id], revertOnUpdate: true },
  );

  const totalPages = table ? Math.max(1, Math.ceil(table.total / 24)) : 1;
  const isBooting = loading && (!overview || !geojson);
  const activeRiskLabel =
    filters.risk === "all"
      ? null
      : filters.risk === "high"
        ? copy.riskHigh
        : filters.risk === "medium"
          ? copy.riskMedium
          : copy.riskLow;
  const activeSlice = [filters.department, activeRiskLabel, filters.modality].filter(Boolean) as string[];
  const topDepartments = overview
    ? [...overview.map.departments].sort((a, b) => b.avgRisk - a.avgRisk).slice(0, 5)
    : [];
  const topDepartmentMax = topDepartments[0]?.avgRisk ?? 1;
  const leadCases = overview?.leadCases ?? [];
  const leadCaseMax = leadCases.reduce((max, item) => Math.max(max, item.score), 100);
  const tableValueMax = table?.rows.reduce((max, row) => Math.max(max, row.value), 0) ?? 0;
  const latestDataPoint = overview?.meta.latestContractDate ?? overview?.meta.lastRunTs?.slice(0, 10) ?? "—";
  const topFactor = selectedCase?.factors?.[0];
  const caseCountLabel = lang === "es" ? `${leadCases.length} casos guía` : `${leadCases.length} guide cases`;

  if (isBooting) {
    return (
      <div ref={scope} className="shell">
        <SiteNav
          lang={lang}
          links={[
            { href: `/contrato-limpio?lang=${lang}`, label: copy.navPhase1 },
            { href: `/promesmetro?lang=${lang}`, label: copy.navPhase2 },
            { href: `/sigue-el-dinero?lang=${lang}`, label: copy.navPhase3 },
          ]}
        />
        <ContractsLoading copy={copy} />
      </div>
    );
  }

  return (
    <div ref={scope} className="shell">
      <SiteNav
        lang={lang}
        links={[
          { href: `/contrato-limpio?lang=${lang}`, label: copy.navPhase1 },
          { href: `/promesmetro?lang=${lang}`, label: copy.navPhase2 },
          { href: `/sigue-el-dinero?lang=${lang}`, label: copy.navPhase3 },
        ]}
      />

      <main className="page">
        <section className="overview-card stripe-flag page-hero command-shell contract-stage" style={{ position: "relative", padding: "1.6rem 1.7rem", margin: "1.4rem 0 1rem", overflow: "hidden" }}>
          <div className="command-shell__wash" />
          <div className="reading-deck" style={{ position: "relative", zIndex: 1, marginBottom: "1rem" }}>
            <div className="reading-deck__intro">
              <p className="eyebrow">{copy.pageEyebrow}</p>
              <h1 className="phase-title" style={{ fontSize: "clamp(2.3rem,4.8vw,4.1rem)", margin: "0 0 0.7rem" }}>
                {copy.pageTitle}
              </h1>
              <p className="section-copy" style={{ maxWidth: 720, marginBottom: "1rem" }}>
                {copy.pageBody}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
                <span className="tiny-pill slice-chip">{copy.currentSlice}</span>
                {(activeSlice.length ? activeSlice : [copy.currentSliceDefault]).map((item) => (
                  <span key={item} className="tiny-pill slice-chip slice-chip--active">
                    {item}
                  </span>
                ))}
              </div>
              <div className="protocol-strip">
                <div className="protocol-strip__item">
                  <span className="protocol-strip__index">01</span>
                  <span>{copy.guideStepTerritory}</span>
                </div>
                <div className="protocol-strip__item">
                  <span className="protocol-strip__index">02</span>
                  <span>{copy.guideStepSignal}</span>
                </div>
                <div className="protocol-strip__item">
                  <span className="protocol-strip__index">03</span>
                  <span>{copy.guideStepVerify}</span>
                </div>
              </div>
            </div>
            <div className="reading-deck__aside surface-soft stripe-blue">
              <div className="label" style={{ marginBottom: "0.45rem" }}>
                {copy.guideTitle}
              </div>
              <p className="body-copy reading-deck__aside-copy">
                {copy.guideBody}
              </p>
              <div className="reading-deck__stack">
                <article className="reading-deck__fact">
                  <div className="label">{copy.metricSlice}</div>
                  <strong>{overview?.meta.shownRows?.toLocaleString() ?? "—"}</strong>
                  <span>{filters.full ? copy.toggleFull : copy.togglePreview}</span>
                </article>
                <article className="reading-deck__fact">
                  <div className="label">{copy.metricModel}</div>
                  <strong>{latestDataPoint}</strong>
                  <span>{overview?.methodology.modelType ?? "IsolationForest"}</span>
                </article>
                <article className="reading-deck__fact">
                  <div className="label">{copy.currentSlice}</div>
                  <strong>{overview?.slice.dominantDepartment ?? copy.currentSliceDefault}</strong>
                  <span>{copy.modelHonesty}</span>
                </article>
              </div>
            </div>
          </div>

          <div className="filter-bar page-controls" style={{ padding: "1rem 1.1rem", position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.8rem", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <Filter size={18} color="var(--blue)" />
                <div className="label">{copy.simpleFilters}</div>
              </div>
              <div className="action-row">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const next = { ...draft, full: !draft.full };
                    setDraft(next);
                    setPage(0);
                    setFilters(next);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <Database size={16} />
                  {draft.full ? copy.togglePreview : copy.toggleFull}
                </button>
              </div>
            </div>
            <div className="filter-grid">
              <label className="filter-field">
                <span className="label">
                  <Search size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
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
                  {overview?.options.departments.map((department) => (
                    <option key={department.value} value={department.value}>
                      {department.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-field">
                <span className="label">{copy.filterRisk}</span>
                <select
                  value={draft.risk}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, risk: event.target.value as FilterState["risk"] }))
                  }
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
                  {overview?.options.modalities.map((modality) => (
                    <option key={modality.value} value={modality.value}>
                      {modality.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn-primary filter-apply"
                onClick={() => {
                  setPage(0);
                  setFilters(draft);
                }}
                style={{ border: "none", cursor: "pointer", justifyContent: "center" }}
              >
                {copy.applyFilters}
              </button>
            </div>
          </div>
        </section>

        <section className="dashboard-strip" style={{ marginBottom: "1rem" }}>
          <div className="dashboard-strip__head">
            <div>
              <p className="eyebrow" style={{ marginBottom: "0.3rem" }}>
                {copy.dashboardTitle}
              </p>
              <p className="section-copy" style={{ margin: 0, fontSize: "0.88rem" }}>
                {copy.dashboardBody}
              </p>
            </div>
          </div>
          <div className="dashboard-strip__grid">
            <article className="metric-shell stripe-blue">
              <div className="label">{copy.kpiContracts}</div>
              <div className="summary-number" style={{ fontSize: "1.8rem" }}>
                {overview?.slice.totalContracts?.toLocaleString() ?? "—"}
              </div>
              <div className="body-copy" style={{ fontSize: "0.82rem" }}>
                {activeSlice.length ? activeSlice.join(" · ") : copy.currentSliceDefault}
              </div>
            </article>
            <article className="metric-shell stripe-red">
              <div className="label">{copy.kpiPriorityValue}</div>
              <div className="summary-number risk-high" style={{ fontSize: "1.8rem" }}>
                {overview?.slice.prioritizedValueLabel ?? "—"}
              </div>
              <div className="body-copy" style={{ fontSize: "0.82rem" }}>
                {overview?.slice.redAlerts?.toLocaleString() ?? "0"} {copy.metricAlerts.toLowerCase()}
              </div>
            </article>
            <article className="metric-shell stripe-yellow">
              <div className="label">{copy.kpiSelectedCase}</div>
              <div className="summary-number" style={{ fontSize: "1.15rem", lineHeight: 1.15 }}>
                {selectedCase?.valueLabel ?? "—"}
              </div>
              <div className="body-copy" style={{ fontSize: "0.82rem" }}>
                {selectedCase?.entity ?? copy.noCases}
              </div>
            </article>
            <article className="metric-shell stripe-green">
              <div className="label">{copy.kpiSelectedSignal}</div>
              <div className="summary-number" style={{ fontSize: "1.15rem", lineHeight: 1.15 }}>
                {selectedCase?.signal ?? "—"}
              </div>
              <div className="body-copy" style={{ fontSize: "0.82rem" }}>
                {selectedCase ? `${selectedCase.score} · ${selectedCase.department}` : copy.currentSliceDefault}
              </div>
            </article>
          </div>
        </section>

        <section className="two-col" style={{ alignItems: "start", marginBottom: "1rem" }}>
          <div className="map-panel stripe-blue" style={{ position: "relative", padding: "1rem 1rem 1.1rem", overflow: "hidden" }}>
            <div className="map-glow" />
            <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: "1rem", marginBottom: "0.6rem" }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: "0.35rem" }}>
                  {copy.mapTitle}
                </p>
                <p className="section-copy" style={{ margin: 0, fontSize: "0.88rem" }}>
                  {copy.mapBody}
                </p>
              </div>
              <Landmark size={22} color="var(--blue)" />
            </div>
            <div className="map-stage">
              <div className="map-legend">
                <span className="label">{copy.mapLegendLow}</span>
                <span className="map-legend__bar" />
                <span className="label">{copy.mapLegendHigh}</span>
              </div>
            </div>
            <div className="map-shell">
              {geojson && overview ? (
                <ColombiaMap
                  geojson={geojson}
                  departments={overview.map.departments}
                  activeDepartment={filters.department}
                  captionTitle={copy.currentSlice}
                  captionBody={copy.mapBody}
                  emptyCaptionBody={copy.mapBody}
                  onSelect={(department) => {
                    const next = { ...filters, department };
                    setDraft(next);
                    setFilters(next);
                    setPage(0);
                  }}
                />
              ) : (
                <div className="surface" style={{ height: 420, display: "grid", placeItems: "center" }}>
                  {copy.loading}
                </div>
              )}
            </div>
            {topDepartments.length ? (
              <div className="territory-rail">
                {topDepartments.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`territory-chip ${filters.department === item.geoName ? "territory-chip--active" : ""}`}
                    onClick={() => {
                      const next = { ...filters, department: item.geoName };
                      setDraft(next);
                      setFilters(next);
                      setPage(0);
                    }}
                  >
                    <span>{item.label}</span>
                    <span
                      className="territory-chip__meter"
                      style={{ width: `${Math.max(18, (item.avgRisk / topDepartmentMax) * 100)}%` }}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <aside className="side-panel stripe-red" style={{ padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "0.8rem" }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: "0.35rem" }}>
                  {copy.casesTitle}
                </p>
                <p className="section-copy" style={{ margin: 0, fontSize: "0.88rem" }}>
                  {copy.casesBody}
                </p>
              </div>
              <ShieldAlert size={22} color="var(--red)" />
            </div>
            {selectedCase ? (
              <div className="details focus-card stripe-red">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "0.8rem", alignItems: "start" }}>
                  <div>
                    <div className="label" style={{ marginBottom: "0.35rem" }}>{copy.focusTitle}</div>
                    <div className={`score risk-${selectedCase.riskBand}`} style={{ fontSize: "2.5rem" }}>
                      {selectedCase.score}
                    </div>
                    <div className="body-copy" style={{ fontSize: "0.84rem" }}>
                      {copy.focusBody}
                    </div>
                  </div>
                  <Link href={selectedCase.secopUrl || "#"} target="_blank" className="btn-secondary">
                    {copy.verify} <ArrowUpRight size={16} />
                  </Link>
                </div>
                <div className="focus-card__headline">
                  <strong>{selectedCase.entity}</strong>
                  <span className="tiny-pill">{selectedCase.department}</span>
                  <span className="tiny-pill">{selectedCase.date}</span>
                </div>
                <div className="signal-rail surface-soft">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                    <div className="label">{copy.kpiSelectedSignal}</div>
                    <div className="body-copy" style={{ fontSize: "0.78rem" }}>
                      {selectedCase.signal}
                    </div>
                  </div>
                  <div className="signal-rail__bars">
                    {leadCases.map((item) => (
                      <span
                        key={item.id}
                        className={`signal-bar signal-bar--${item.riskBand} ${selectedCase?.id === item.id ? "signal-bar--active" : ""}`}
                        style={{ height: `${Math.max(26, (item.score / leadCaseMax) * 100)}%` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="summary-grid" style={{ marginBottom: "1rem" }}>
                  <div className="summary-card">
                    <div className="label">{copy.detailEntity}</div>
                    <div>{selectedCase.entity}</div>
                  </div>
                  <div className="summary-card">
                    <div className="label">{copy.detailProvider}</div>
                    <div>{selectedCase.provider}</div>
                  </div>
                  <div className="summary-card">
                    <div className="label">{copy.detailModality}</div>
                    <div>{selectedCase.modality}</div>
                  </div>
                  <div className="summary-card">
                    <div className="label">{copy.detailValue}</div>
                    <div>{selectedCase.valueLabel}</div>
                  </div>
                </div>
                <div className="summary-card stripe-yellow" style={{ padding: "1rem" }}>
                  <div className="label" style={{ marginBottom: "0.5rem" }}>
                    {copy.factorsTitle}
                  </div>
                  <div className="body-copy" style={{ fontSize: "0.78rem", marginBottom: "0.7rem" }}>
                    {copy.factorsHint}
                  </div>
                  {topFactor ? (
                    <div className="focus-card__factor-lead">
                      <span className="label">{copy.kpiSelectedSignal}</span>
                      <strong>{topFactor.label}</strong>
                    </div>
                  ) : null}
                  <div style={{ display: "grid", gap: "0.65rem" }}>
                    {selectedCase.factors.map((factor) => (
                      <div key={factor.key}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: 6 }}>
                          <span style={{ fontSize: "0.82rem" }}>{factor.label}</span>
                          <span className="label">{Math.round(factor.severity * 100)}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: "rgba(23,32,51,0.08)", overflow: "hidden" }}>
                          <div
                            className="factor-fill"
                            style={{
                              width: `${Math.max(12, factor.severity * 100)}%`,
                              height: "100%",
                              borderRadius: 999,
                              background: "linear-gradient(90deg, var(--red), var(--yellow))",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="body-copy" style={{ fontSize: "0.8rem", marginTop: "0.9rem" }}>
                  {copy.ethicalNote}
                </p>
              </div>
            ) : null}

            <div className="case-list-head">
              <div>
                <div className="label" style={{ marginBottom: "0.3rem" }}>{copy.otherCasesTitle}</div>
                <p className="body-copy" style={{ margin: 0, fontSize: "0.8rem" }}>{copy.otherCasesBody}</p>
              </div>
              <div className="tiny-pill">{caseCountLabel}</div>
            </div>
            {loading ? (
              <div className="surface" style={{ padding: "1rem", textAlign: "center" }}>
                {copy.loading}
              </div>
            ) : overview?.leadCases.length ? (
              <div className="case-list">
                {overview.leadCases.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`case-card ${selectedCase?.id === item.id ? "case-card--active" : ""}`}
                    onClick={() => setSelectedCase(item)}
                    style={{
                      textAlign: "left",
                      width: "100%",
                      cursor: "pointer",
                      border: selectedCase?.id === item.id ? "1px solid rgba(13,91,215,0.24)" : "1px solid var(--border)",
                      background: selectedCase?.id === item.id ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.8)",
                      padding: "0.95rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "0.35rem" }}>
                      <div className="label">{item.pickReason}</div>
                      <div className={`score risk-${item.riskBand}`} style={{ fontSize: "1.35rem" }}>
                        {item.score}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, marginBottom: "0.2rem" }}>{item.entity}</div>
                    <div className="body-copy" style={{ fontSize: "0.8rem", marginBottom: "0.35rem" }}>
                      {item.department} · {item.date} · {item.valueLabel}
                    </div>
                    <div className="body-copy" style={{ fontSize: "0.78rem" }}>
                      {copy.whyHere}: {item.signal}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="surface" style={{ padding: "1rem", textAlign: "center" }}>
                {copy.noCases}
              </div>
            )}
          </aside>
        </section>

        <section className="analysis-suite surface stripe-green" style={{ padding: "1rem 1.1rem", marginBottom: "1rem" }}>
          <div className="analysis-suite__head">
            <div>
              <p className="eyebrow" style={{ marginBottom: "0.35rem" }}>{copy.analysisTitle}</p>
              <p className="section-copy" style={{ margin: 0, fontSize: "0.88rem" }}>{copy.analysisBody}</p>
            </div>
            <div className="analysis-tabs">
              <button type="button" className={`analysis-tab ${analysisTab === "entities" ? "analysis-tab--active" : ""}`} onClick={() => setAnalysisTab("entities")}>
                {copy.analysisEntities}
              </button>
              <button type="button" className={`analysis-tab ${analysisTab === "modalities" ? "analysis-tab--active" : ""}`} onClick={() => setAnalysisTab("modalities")}>
                {copy.analysisModalities}
              </button>
              <button type="button" className={`analysis-tab ${analysisTab === "explorer" ? "analysis-tab--active" : ""}`} onClick={() => setAnalysisTab("explorer")}>
                {copy.analysisExplorer}
              </button>
              <button type="button" className={`analysis-tab ${analysisTab === "methodology" ? "analysis-tab--active" : ""}`} onClick={() => setAnalysisTab("methodology")}>
                {copy.analysisMethodology}
              </button>
            </div>
          </div>

          {analysisTab === "entities" ? (
            <article className="summary-card stripe-blue analysis-panel">
              <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "0.65rem" }}>
                <Waypoints size={18} color="var(--blue)" />
                <div className="label">{copy.summaryEntities}</div>
              </div>
              <div style={{ display: "grid", gap: "0.65rem" }}>
                {overview?.summaries.entities.map((item) => (
                  <div key={item.nombre_entidad} style={{ display: "grid", gap: 4 }}>
                    <strong>{item.nombre_entidad}</strong>
                    <div className="meter-row">
                      <span className="body-copy" style={{ fontSize: "0.82rem" }}>
                        {item.contracts} {copy.summaryContracts} · {(item.maxRisk * 100).toFixed(0)} {copy.summaryMax}
                      </span>
                      <span className="meter-row__track">
                        <span className="meter-row__fill meter-row__fill--blue" style={{ width: `${Math.max(12, item.maxRisk * 100)}%` }} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {analysisTab === "modalities" ? (
            <article className="summary-card stripe-yellow analysis-panel">
              <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "0.65rem" }}>
                <Network size={18} color="var(--yellow)" />
                <div className="label">{copy.summaryModalities}</div>
              </div>
              <div style={{ display: "grid", gap: "0.65rem" }}>
                {overview?.summaries.modalities.map((item) => (
                  <div key={item.modalidad_de_contratacion} style={{ display: "grid", gap: 4 }}>
                    <strong>{item.modalidad_de_contratacion}</strong>
                    <div className="meter-row">
                      <span className="body-copy" style={{ fontSize: "0.82rem" }}>
                        {item.contracts} {copy.summaryContracts} · {(item.meanRisk * 100).toFixed(0)} {copy.summaryMean}
                      </span>
                      <span className="meter-row__track">
                        <span className="meter-row__fill meter-row__fill--yellow" style={{ width: `${Math.max(12, item.meanRisk * 100)}%` }} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {analysisTab === "methodology" ? (
            <article className="summary-card stripe-green analysis-panel">
              <div className="body-copy">
                <p style={{ marginTop: 0 }}>{copy.methodologyBody}</p>
                <p>
                  <strong>{overview?.methodology.modelType ?? "IsolationForest"}</strong> ·{" "}
                  {overview?.methodology.nFeatures ?? 25} vars · contamination{" "}
                  {overview?.methodology.contamination ?? 0.05}
                </p>
                <p>
                  n_estimators {overview?.methodology.nEstimators ?? 200} · trained{" "}
                  {overview?.methodology.trainedAt?.slice(0, 10) ?? "—"}
                </p>
                <p style={{ marginBottom: 0 }}>
                  thresholds: red ≥ {(overview?.methodology.redThreshold ?? 0.7) * 100} · yellow ≥{" "}
                  {(overview?.methodology.yellowThreshold ?? 0.4) * 100}
                </p>
              </div>
            </article>
          ) : null}

          {analysisTab === "explorer" ? (
            <div className="analysis-panel">
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "end", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: "0.35rem" }}>
                    {copy.tableTitle}
                  </p>
                  <p className="section-copy" style={{ margin: 0, fontSize: "0.88rem" }}>
                    {copy.tableBody}
                  </p>
                </div>
                <div className="label">
                  {table?.total?.toLocaleString() ?? 0} {copy.rows}
                </div>
              </div>
              <p className="body-copy" style={{ fontSize: "0.82rem", marginTop: "0.6rem" }}>
                {copy.tableNote}
              </p>
              {tableLoading ? (
                <div className="surface" style={{ padding: "1rem", textAlign: "center" }}>
                  {copy.loading}
                </div>
              ) : (
                <>
                  <div className="explorer-grid">
                {table?.rows.map((row) => (
                  <article key={row.id} className={`explorer-card stripe-${row.riskBand === "high" ? "red" : row.riskBand === "medium" ? "yellow" : "green"}`}>
                    <div className="explorer-card__top">
                      <div>
                        <div className="label" style={{ marginBottom: "0.35rem" }}>{row.department}</div>
                        <div className="explorer-card__title">{row.entity}</div>
                      </div>
                      <div className={`score risk-${row.riskBand}`} style={{ fontSize: "1.5rem" }}>{row.score}</div>
                    </div>
                    <div className="body-copy" style={{ fontSize: "0.83rem", marginBottom: "0.7rem" }}>
                      {row.provider}
                    </div>
                    <div className="explorer-card__metrics">
                      <div>
                        <div className="label" style={{ marginBottom: "0.3rem" }}>{copy.tableValue}</div>
                        <strong>{row.valueLabel}</strong>
                        <div className="table-value__track" style={{ marginTop: 8 }}>
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
                      <div style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                        {leadCases.some((item) => item.id === row.id) ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              const match = leadCases.find((item) => item.id === row.id);
                              if (match) setSelectedCase(match);
                            }}
                            style={{ padding: "0.55rem 0.8rem", cursor: "pointer" }}
                          >
                            {copy.selectedCase}
                          </button>
                        ) : null}
                        <Link href={row.secopUrl || "#"} target="_blank" className="btn-secondary" style={{ padding: "0.55rem 0.9rem" }}>
                          <ArrowUpRight size={15} />
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <details className="accordion explorer-raw" style={{ marginTop: "1rem", padding: "0.9rem 1rem" }}>
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>Tabla cruda</summary>
                <table className="data-table" style={{ marginTop: "0.9rem" }}>
                  <thead>
                    <tr>
                      <th>{copy.tableScore}</th>
                      <th>{copy.tableEntity}</th>
                      <th>{copy.tableDepartment}</th>
                      <th>{copy.tableModality}</th>
                      <th>{copy.tableValue}</th>
                      <th>{copy.tableSource}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table?.rows.map((row) => (
                      <tr key={`raw-${row.id}`}>
                        <td className={`risk-${row.riskBand}`} style={{ fontWeight: 700 }}>{row.score}</td>
                        <td>{row.entity}</td>
                        <td>{row.department}</td>
                        <td>{row.modality}</td>
                        <td>{row.valueLabel}</td>
                        <td>
                          <Link href={row.secopUrl || "#"} target="_blank" className="btn-secondary" style={{ padding: "0.55rem 0.9rem" }}>
                            <ArrowUpRight size={15} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={page === 0}
                  style={{ cursor: "pointer", opacity: page === 0 ? 0.5 : 1 }}
                >
                  {copy.previous}
                </button>
                <div className="label">
                  {page + 1} / {totalPages}
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                  disabled={page >= totalPages - 1}
                  style={{ cursor: "pointer", opacity: page >= totalPages - 1 ? 0.5 : 1 }}
                >
                  {copy.next}
                </button>
              </div>
                </>
              )}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
