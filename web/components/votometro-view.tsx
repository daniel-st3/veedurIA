"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowRight, ArrowUpRight, Moon, Sun } from "lucide-react";

import type { Lang } from "@/lib/types";
import {
  HEATMAP_COLUMNS,
  VOTOMETRO_CHAMBERS,
  VOTOMETRO_LEGISLATORS,
  VOTOMETRO_PERIODS,
  getHeroStats,
  type HeatmapCell,
  type VoteChamberKey,
  type VoteCoherence,
  type VotePeriodKey,
  type VoteRecord,
} from "@/lib/votometro-data";

type ThemeMode = "light" | "dark";

type TableFilters = {
  theme: string;
  result: string;
  coherence: string;
  year: string;
  query: string;
};

type TooltipState = {
  x: number;
  y: number;
  content: string;
};

const DEFAULT_FILTERS: TableFilters = {
  theme: "all",
  result: "all",
  coherence: "all",
  year: "all",
  query: "",
};

const PAGE_SIZE = 6;

export function VotometroView({ lang }: { lang: Lang }) {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [period, setPeriod] = useState<VotePeriodKey>("2022-2026");
  const [chamber, setChamber] = useState<VoteChamberKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TableFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [barsVisible, setBarsVisible] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const spotlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const previousTheme = root.dataset.theme;
    root.dataset.theme = theme;
    return () => {
      if (previousTheme) root.dataset.theme = previousTheme;
      else delete root.dataset.theme;
    };
  }, [theme]);

  const visibleProfiles = useMemo(() => {
    return VOTOMETRO_LEGISLATORS.filter((profile) => {
      const matchesPeriod = profile.periods.includes(period);
      const matchesChamber = chamber === "all" ? true : profile.chamber === chamber;
      return matchesPeriod && matchesChamber;
    });
  }, [chamber, period]);

  useEffect(() => {
    if (!visibleProfiles.length) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !visibleProfiles.some((profile) => profile.id === selectedId)) {
      setSelectedId(visibleProfiles[0].id);
    }
  }, [selectedId, visibleProfiles]);

  const selectedProfile = useMemo(() => {
    return visibleProfiles.find((profile) => profile.id === selectedId) ?? visibleProfiles[0] ?? null;
  }, [selectedId, visibleProfiles]);

  const heroStats = getHeroStats(period, chamber);

  const tableYears = useMemo(() => {
    if (!selectedProfile) return [];
    return [...new Set(selectedProfile.voteRows.map((row) => row.date.slice(0, 4)))].sort((a, b) => Number(b) - Number(a));
  }, [selectedProfile]);

  const filteredRows = useMemo(() => {
    if (!selectedProfile) return [];
    return selectedProfile.voteRows.filter((row) => {
      const themeMatch = filters.theme === "all" || row.theme === filters.theme;
      const resultMatch = filters.result === "all" || row.result === filters.result;
      const yearMatch = filters.year === "all" || row.date.startsWith(filters.year);
      const queryMatch =
        !filters.query.trim() || row.project.toLocaleLowerCase("es-CO").includes(filters.query.trim().toLocaleLowerCase("es-CO"));
      const coherenceMatch =
        filters.coherence === "all"
          ? true
          : filters.coherence === "ausente"
            ? row.position === "Ausente"
            : row.coherence === filters.coherence;
      return themeMatch && resultMatch && yearMatch && queryMatch && coherenceMatch;
    });
  }, [filters, selectedProfile]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [filters, selectedProfile?.id]);

  const paginatedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const heatmapRows = useMemo(() => {
    return [...visibleProfiles].sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 12);
  }, [visibleProfiles]);

  useEffect(() => {
    if (!selectedProfile || typeof window === "undefined") return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setBarsVisible(true);
      return;
    }

    setBarsVisible(false);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setBarsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    if (spotlightRef.current) observer.observe(spotlightRef.current);
    return () => observer.disconnect();
  }, [selectedProfile?.id]);

  const updateFilter = (key: keyof TableFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const showTooltip = (event: React.MouseEvent<HTMLButtonElement>, profileName: string, cell: HeatmapCell) => {
    if (!cell.project || !cell.gaceta || !cell.position || typeof window === "undefined") return;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = 260;
    const height = 72;
    const padding = 16;
    const nextX = Math.min(Math.max(event.clientX + 18, padding), viewportWidth - width - padding);
    const nextY = Math.min(Math.max(event.clientY + 18, padding), viewportHeight - height - padding);
    setTooltip({
      x: nextX,
      y: nextY,
      content: `${profileName} votó ${cell.position} en ${cell.project} · ${cell.dateLabel ?? "Sin fecha"} · Gaceta ${cell.gaceta}`,
    });
  };

  const moveTooltip = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!tooltip || typeof window === "undefined") return;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = 260;
    const height = 72;
    const padding = 16;
    const nextX = Math.min(Math.max(event.clientX + 18, padding), viewportWidth - width - padding);
    const nextY = Math.min(Math.max(event.clientY + 18, padding), viewportHeight - height - padding);
    setTooltip((current) => (current ? { ...current, x: nextX, y: nextY } : null));
  };

  const periodLabel = VOTOMETRO_PERIODS.find((item) => item.key === period)?.label ?? "2022-2026 · Activo ●";
  const chamberLabel = VOTOMETRO_CHAMBERS.find((item) => item.key === chamber)?.label ?? "Todas";

  return (
    <div className="vm-shell">
      <nav className="vm-nav" aria-label="Navegación principal VotóMeter">
        <div className="vm-nav__inner">
          <Link href={`/?lang=${lang}`} className="vm-brand" aria-label="VeedurIA">
            <svg viewBox="0 0 48 48" className="vm-brand__icon" aria-hidden="true">
              <path
                d="M7 24c4.8-8 10.5-12 17-12s12.2 4 17 12c-4.8 8-10.5 12-17 12S11.8 32 7 24Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
              />
              <circle cx="24" cy="24" r="5.2" fill="currentColor" />
            </svg>
            <span className="vm-brand__word">
              Veedur<span>IA</span>
            </span>
          </Link>

          <div className="vm-nav__links">
            <Link href={`/contrato-limpio?lang=${lang}`} className="vm-nav__pill">
              ContratoLimpio
            </Link>
            <Link href={`/votometro?lang=${lang}`} className="vm-nav__pill vm-nav__pill--active" aria-current="page">
              VotóMeter
            </Link>
            <Link href={`/sigue-el-dinero?lang=${lang}`} className="vm-nav__pill">
              SigueElDinero
            </Link>
          </div>

          <button
            type="button"
            className="vm-theme-toggle"
            onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
            aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            <span>{theme === "light" ? "Oscuro" : "Claro"}</span>
          </button>
        </div>
      </nav>

      <main className="vm-main">
        <section className="vm-hero">
          <div className="vm-hero__grid vm-container">
            <div className="vm-hero__copy">
              <p className="vm-eyebrow">{`Votaciones · Promesas · Coherencia · ${periodLabel} · ${chamberLabel}`}</p>
              <h1>¿Votaron como prometieron?</h1>
              <p className="vm-hero__body">
                Cada voto nominal del Congreso contrastado con el programa de campaña del legislador. Dato objetivo,
                fuente verificable y una tabla que deja ver dónde hubo coherencia, ausencia o ruptura pública.
              </p>
            </div>

            <div className="vm-hero__stats" aria-label="Indicadores principales">
              <article className="vm-kpi-card">
                <strong>{heroStats.indexedVotes.toLocaleString("es-CO")}</strong>
                <span>Total votaciones nominales indexadas</span>
              </article>
              <article className="vm-kpi-card">
                <strong>{heroStats.legislators.toLocaleString("es-CO")}</strong>
                <span>Legisladores con perfil completo</span>
              </article>
              <article className="vm-kpi-card">
                <strong>{`${heroStats.coherenceAverage}%`}</strong>
                <span>Índice promedio coherencia voto-promesa</span>
              </article>
              <article className="vm-kpi-card">
                <strong>{heroStats.trackedProjects.toLocaleString("es-CO")}</strong>
                <span>Proyectos rastreados este período</span>
              </article>
            </div>
          </div>
        </section>

        <section className="vm-cycle-bar">
          <div className="vm-container">
            <div className="vm-cycle-bar__tabs" role="tablist" aria-label="Periodos">
              {VOTOMETRO_PERIODS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  className={`vm-tab ${item.key === period ? "is-active" : ""}`}
                  aria-selected={item.key === period}
                  onClick={() => setPeriod(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="vm-cycle-bar__pills" aria-label="Cámara">
              {VOTOMETRO_CHAMBERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`vm-pill ${item.key === chamber ? "is-active" : ""}`}
                  onClick={() => setChamber(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="vm-section">
          <div className="vm-container">
            <header className="vm-section__header">
              <p className="vm-eyebrow">Explorador de legisladores</p>
              <h2>Selecciona un legislador</h2>
            </header>

            <div className="vm-legislator-grid" role="list" aria-label="Legisladores">
              {visibleProfiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  role="listitem"
                  className={`vm-legislator-card ${profile.id === selectedProfile?.id ? "is-active" : ""}`}
                  onClick={() => setSelectedId(profile.id)}
                  aria-pressed={profile.id === selectedProfile?.id}
                >
                  <div className="vm-legislator-card__head">
                    <div className="vm-avatar" aria-hidden="true">
                      {profile.initials}
                      <span className="vm-avatar__dot" style={{ background: profile.partyColor }} />
                    </div>
                    <div>
                      <strong className="vm-legislator-card__name">{profile.name}</strong>
                      <span className="vm-legislator-card__role">{profile.roleLabel}</span>
                    </div>
                  </div>

                  <div className="vm-legislator-card__coherence">
                    <div className="vm-inline-meter">
                      <span style={{ width: `${profile.coherenceScore}%` }} />
                    </div>
                    <span>{profile.coherenceScore}%</span>
                  </div>

                  <p className="vm-legislator-card__topics">{profile.topTopics.join(" · ")}</p>

                  <div className="vm-legislator-card__meta">
                    <span>{`${profile.totalVotes.toLocaleString("es-CO")} votos`}</span>
                    <span>{`${profile.absenceRate}% ausente`}</span>
                    <span>{`${profile.topicCount} temas`}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {selectedProfile ? (
          <>
            <section className="vm-spotlight" ref={spotlightRef}>
              <div className="vm-container vm-spotlight__layout">
                <aside className="vm-spotlight__aside">
                  <div className="vm-avatar vm-avatar--large" aria-hidden="true">
                    {selectedProfile.initials}
                    <span className="vm-avatar__dot" style={{ background: selectedProfile.partyColor }} />
                  </div>
                  <div className="vm-spotlight__identity">
                    <h2>{selectedProfile.name}</h2>
                    <p>{`${selectedProfile.party} · ${selectedProfile.chamberLabel}`}</p>
                  </div>

                  <div className="vm-kpi-stack">
                    <article className="vm-kpi-stack__item">
                      <span>Votos consistentes con promesa</span>
                      <strong className="is-primary">{selectedProfile.consistentVotes}</strong>
                    </article>
                    <article className="vm-kpi-stack__item">
                      <span>Votos inconsistentes con promesa</span>
                      <strong className="is-high">{selectedProfile.inconsistentVotes}</strong>
                    </article>
                    <article className="vm-kpi-stack__item">
                      <span>Ausencias en votaciones de su dominio</span>
                      <strong className="is-muted">{selectedProfile.absencesOnKeyThemes}</strong>
                    </article>
                    <article className="vm-kpi-stack__item">
                      <span>Veces que votó distinto a su bancada</span>
                      <strong className="is-amber">{selectedProfile.partyDeviationVotes}</strong>
                    </article>
                  </div>

                  <div className="vm-coherence">
                    <div className="vm-coherence__head">
                      <span>Índice de coherencia</span>
                      <strong>{selectedProfile.coherenceScore}%</strong>
                    </div>
                    <div className="vm-coherence__bar">
                      <span style={{ width: `${selectedProfile.coherenceScore}%` }} />
                    </div>
                  </div>
                </aside>

                <div className="vm-spotlight__main">
                  <section className="vm-panel">
                    <header className="vm-panel__header">
                      <p className="vm-eyebrow">Detalle por tema</p>
                      <h3>Coherencia por tema</h3>
                    </header>

                    <div className="vm-topic-bars">
                      {selectedProfile.themeBars.map((item) => {
                        const tone = item.score > 70 ? "is-good" : item.score >= 40 ? "is-mid" : "is-bad";
                        return (
                          <div key={item.key} className="vm-topic-bar">
                            <span className="vm-topic-bar__label">{item.label}</span>
                            <div className="vm-topic-bar__track">
                              <span className={tone} style={{ width: barsVisible ? `${item.score}%` : "0%" }} />
                            </div>
                            <span className="vm-topic-bar__value">{`${item.score}%`}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="vm-contract-badge">
                    <div>
                      <p className="vm-eyebrow">Conexión con ContratoLimpio</p>
                      <p>
                        {selectedProfile.contractsCount > 0
                          ? `Este legislador tiene ${selectedProfile.contractsCount} contratos registrados en ContratoLimpio.`
                          : "Este legislador no tiene contratos registrados en ContratoLimpio para este corte visible."}
                      </p>
                    </div>
                    {selectedProfile.contractsCount > 0 ? (
                      <Link
                        href={`/contrato-limpio?lang=${lang}&q=${encodeURIComponent(selectedProfile.contractsQuery)}`}
                        className="vm-button vm-button--ghost"
                      >
                        Ver contratos
                        <ArrowRight size={16} />
                      </Link>
                    ) : null}
                  </section>
                </div>
              </div>
            </section>

            <section className="vm-section vm-section--table">
              <div className="vm-container">
                <header className="vm-section__header vm-section__header--inline">
                  <div>
                    <p className="vm-eyebrow">Votaciones nominales</p>
                    <h2>Registro de votaciones</h2>
                  </div>
                  <p className="vm-section__note">
                    La tabla se enfoca en el perfil seleccionado. Cada fila enlaza la gaceta y deja ver si el voto fue
                    coherente, inconsistente o quedó sin promesa comparable.
                  </p>
                </header>

                <div className="vm-table-filters" aria-label="Filtros de tabla">
                  <select value={filters.theme} onChange={(event) => updateFilter("theme", event.target.value)}>
                    <option value="all">Tema</option>
                    {[...new Set(selectedProfile.voteRows.map((row) => row.theme))].map((themeOption) => (
                      <option key={themeOption} value={themeOption}>
                        {themeOption}
                      </option>
                    ))}
                  </select>

                  <select value={filters.result} onChange={(event) => updateFilter("result", event.target.value)}>
                    <option value="all">Resultado</option>
                    <option value="Aprobado">Aprobado</option>
                    <option value="Rechazado">Rechazado</option>
                    <option value="Archivado">Archivado</option>
                  </select>

                  <select value={filters.coherence} onChange={(event) => updateFilter("coherence", event.target.value)}>
                    <option value="all">Coherencia</option>
                    <option value="coherente">Coherente ✓</option>
                    <option value="inconsistente">Inconsistente ✗</option>
                    <option value="sin-promesa">Sin promesa —</option>
                    <option value="ausente">Ausente —</option>
                  </select>

                  <select value={filters.year} onChange={(event) => updateFilter("year", event.target.value)}>
                    <option value="all">Fecha</option>
                    {tableYears.map((yearOption) => (
                      <option key={yearOption} value={yearOption}>
                        {yearOption}
                      </option>
                    ))}
                  </select>

                  <input
                    type="search"
                    value={filters.query}
                    onChange={(event) => updateFilter("query", event.target.value)}
                    placeholder="Buscar proyecto..."
                    aria-label="Buscar proyecto"
                  />
                </div>

                <div className="vm-table-wrap">
                  <table className="vm-votes-table">
                    <thead>
                      <tr>
                        <th style={{ width: "40%" }}>Proyecto de ley</th>
                        <th style={{ width: "10%" }}>Fecha</th>
                        <th style={{ width: "12%" }}>Tema</th>
                        <th style={{ width: "10%" }}>Posición</th>
                        <th style={{ width: "10%" }}>Resultado</th>
                        <th style={{ width: "10%" }}>Coherencia</th>
                        <th style={{ width: "8%" }}>Gaceta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.length ? (
                        paginatedRows.map((row) => (
                          <VoteRowView key={`${selectedProfile.id}-${row.id}`} row={row} />
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="vm-empty-state">
                            No hay votaciones que coincidan con este filtro. Ajusta el corte para abrir más proyectos.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="vm-pagination">
                  <button type="button" className="vm-page-button" onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    ← Anterior
                  </button>

                  {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      className={`vm-page-button ${pageNumber === page ? "is-active" : ""}`}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="vm-page-button"
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            </section>

            <section className="vm-section">
              <div className="vm-container">
                <header className="vm-section__header">
                  <p className="vm-eyebrow">Vista matricial</p>
                  <h2>Mapa de coherencia: legislador × tema</h2>
                  <p className="vm-section__note">
                    Verde = votó alineado con su promesa · Rojo = votó en contra o faltó en un tema clave · Gris = ausente o sin promesa comparable
                  </p>
                </header>

                <div className="vm-legend">
                  <span className="vm-legend__item">
                    <i className="is-good" />
                    Coherente
                  </span>
                  <span className="vm-legend__item">
                    <i className="is-bad" />
                    Inconsistente
                  </span>
                  <span className="vm-legend__item">
                    <i className="is-muted" />
                    Ausente o sin promesa
                  </span>
                </div>

                <div className="vm-heatmap-wrap">
                  <table className="vm-heatmap">
                    <thead>
                      <tr>
                        <th>Legislador</th>
                        {HEATMAP_COLUMNS.map((column) => (
                          <th key={column.key}>
                            <span>{column.label}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapRows.map((profile) => (
                        <tr key={`heatmap-${profile.id}`}>
                          <th scope="row">{profile.name}</th>
                          {profile.heatmap.map((cell) => (
                            <td key={`${profile.id}-${cell.key}`}>
                              <button
                                type="button"
                                className={`vm-heatmap__cell is-${cell.state}`}
                                onMouseEnter={(event) => showTooltip(event, profile.name, cell)}
                                onMouseMove={moveTooltip}
                                onMouseLeave={() => setTooltip(null)}
                                aria-label={`${profile.name} · ${cell.label}`}
                              >
                                {cell.state === "ausente" ? "—" : cell.value ?? "·"}
                              </button>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="vm-methods">
              <div className="vm-container vm-methods__grid">
                <article>
                  <h3>Gacetas del Congreso</h3>
                  <p>Cada fila del registro conserva número de gaceta y fecha para volver al documento oficial que respalda la votación nominal.</p>
                </article>
                <article>
                  <h3>API Congreso Visible (Uniandes)</h3>
                  <p>La capa base organiza legisladores, proyectos y votaciones rastreables por periodo y cámara para construir una lectura comparable.</p>
                </article>
                <article>
                  <h3>NLP + verificación manual</h3>
                  <p>El perfil programático clasifica temas prometidos; la coherencia final se valida contra voto, proyecto y fuente antes de entrar al tablero.</p>
                </article>
              </div>
            </section>
          </>
        ) : null}
      </main>

      <footer className="vm-footer">
        <div className="vm-container vm-footer__inner">
          <span>VeedurIA · lectura pública del poder · 2024-2026</span>
          <div className="vm-footer__links">
            <Link href={`/contrato-limpio?lang=${lang}`}>ContratoLimpio</Link>
            <Link href={`/votometro?lang=${lang}`}>VotóMeter</Link>
            <Link href={`/sigue-el-dinero?lang=${lang}`}>SigueElDinero</Link>
          </div>
        </div>
      </footer>

      {tooltip ? (
        <div className="vm-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.content}
        </div>
      ) : null}
    </div>
  );
}

function VoteRowView({ row }: { row: VoteRecord }) {
  return (
    <tr>
      <td>{row.project}</td>
      <td>{row.dateLabel}</td>
      <td>{row.theme}</td>
      <td>
        <span className={`vm-status-badge ${getPositionClass(row.position)}`}>{row.position}</span>
      </td>
      <td>{row.result}</td>
      <td className={`vm-coherence-cell ${getCoherenceClass(row.coherence)}`}>{getCoherenceLabel(row.coherence)}</td>
      <td>
        <a href={row.gacetaHref} target="_blank" rel="noopener noreferrer" className="vm-gaceta-link">
          {row.gaceta}
          <ArrowUpRight size={14} />
        </a>
      </td>
    </tr>
  );
}

function getPositionClass(position: VoteRecord["position"]) {
  switch (position) {
    case "Sí":
      return "is-yes";
    case "No":
      return "is-no";
    case "Ausente":
      return "is-absent";
    default:
      return "is-amber";
  }
}

function getCoherenceClass(coherence: VoteCoherence) {
  switch (coherence) {
    case "coherente":
      return "is-good";
    case "inconsistente":
      return "is-bad";
    default:
      return "is-muted";
  }
}

function getCoherenceLabel(coherence: VoteCoherence) {
  switch (coherence) {
    case "coherente":
      return "Coherente ✓";
    case "inconsistente":
      return "Inconsistente ✗";
    default:
      return "Sin promesa —";
  }
}
