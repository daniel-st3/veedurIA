"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowRight, ArrowUpRight } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import type { Lang } from "@/lib/types";
import {
  HEATMAP_COLUMNS,
  VOTOMETRO_LEGISLATORS,
  VOTOMETRO_PERIODS,
  type HeatmapCell,
  type VoteCoherence,
  type VotePeriodKey,
  type VoteRecord,
} from "@/lib/votometro-data";

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
  const [period, setPeriod] = useState<VotePeriodKey>("2022-2026");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TableFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [barsVisible, setBarsVisible] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const spotlightRef = useRef<HTMLDivElement | null>(null);

  const visibleProfiles = useMemo(() => {
    return VOTOMETRO_LEGISLATORS.filter((profile) => {
      return profile.periods.includes(period);
    });
  }, [period]);

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

  const heroStats = useMemo(() => {
    const indexedVotes = visibleProfiles.reduce((sum, profile) => sum + profile.totalVotes, 0);
    const legislators = visibleProfiles.length;
    const coherenceAverage = legislators
      ? Math.round(visibleProfiles.reduce((sum, profile) => sum + profile.coherenceScore, 0) / legislators)
      : 0;
    const trackedProjects = new Set(visibleProfiles.flatMap((profile) => profile.voteRows.map((row) => row.project))).size;
    return { indexedVotes, legislators, coherenceAverage, trackedProjects };
  }, [visibleProfiles]);

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
    return [...visibleProfiles].sort((a, b) => b.coherenceScore - a.coherenceScore || b.totalVotes - a.totalVotes).slice(0, 12);
  }, [visibleProfiles]);

  const chamberSummary = useMemo(() => {
    const summary = new Map<string, { label: string; count: number; coherence: number; votes: number }>();
    visibleProfiles.forEach((profile) => {
      const current = summary.get(profile.chamber) ?? {
        label: profile.chamberLabel,
        count: 0,
        coherence: 0,
        votes: 0,
      };
      current.count += 1;
      current.coherence += profile.coherenceScore;
      current.votes += profile.totalVotes;
      summary.set(profile.chamber, current);
    });
    return [...summary.values()]
      .map((item) => ({
        ...item,
        coherence: item.count ? Math.round(item.coherence / item.count) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [visibleProfiles]);

  const themeOverview = useMemo(() => {
    const summary = new Map<string, { label: string; total: number; count: number; coherent: number; alerts: number }>();
    visibleProfiles.forEach((profile) => {
      profile.themeBars.forEach((item) => {
        const current = summary.get(item.key) ?? {
          label: item.label,
          total: 0,
          count: 0,
          coherent: 0,
          alerts: 0,
        };
        current.total += item.score;
        current.count += 1;
        if (item.score >= 70) current.coherent += 1;
        if (item.score < 45) current.alerts += 1;
        summary.set(item.key, current);
      });
    });
    return [...summary.values()]
      .map((item) => ({
        ...item,
        average: item.count ? Math.round(item.total / item.count) : 0,
      }))
      .sort((a, b) => b.average - a.average);
  }, [visibleProfiles]);

  const topProfiles = useMemo(() => {
    return [...visibleProfiles]
      .sort((a, b) => b.coherenceScore - a.coherenceScore || a.absenceRate - b.absenceRate)
      .slice(0, 4);
  }, [visibleProfiles]);

  const tensionProfiles = useMemo(() => {
    return [...visibleProfiles]
      .sort(
        (a, b) =>
          b.inconsistentVotes + b.partyDeviationVotes + b.absencesOnKeyThemes -
            (a.inconsistentVotes + a.partyDeviationVotes + a.absencesOnKeyThemes) || b.absenceRate - a.absenceRate,
      )
      .slice(0, 4);
  }, [visibleProfiles]);

  const coherenceBands = useMemo(() => {
    return {
      high: visibleProfiles.filter((profile) => profile.coherenceScore >= 75).length,
      mid: visibleProfiles.filter((profile) => profile.coherenceScore >= 55 && profile.coherenceScore < 75).length,
      watch: visibleProfiles.filter((profile) => profile.coherenceScore < 55).length,
    };
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

  return (
    <div className="vm-shell">
      <SiteNav
        lang={lang}
        links={[
          { href: `/contrato-limpio?lang=${lang}`, label: "ContratoLimpio" },
          { href: `/votometro?lang=${lang}`, label: "VotóMeter" },
          { href: `/sigue-el-dinero?lang=${lang}`, label: "SigueElDinero" },
        ]}
      />

      <main className="vm-main">
        <section className="vm-hero">
          <div className="vm-hero__grid vm-container">
            <div className="vm-hero__copy">
              <p className="vm-eyebrow">{`Votaciones · Promesas · Coherencia · ${periodLabel} · ${visibleProfiles.length} perfiles visibles`}</p>
              <h1>¿Votaron como prometieron?</h1>
              <p className="vm-hero__body">
                Vista completa del periodo para los legisladores que hoy sí tienen información conectada en la capa publicada.
                Arranca con el pulso general, compara cámaras y temas, y luego baja al detalle por legislador y votación.
              </p>
              <p className="vm-hero__source-note">
                Solo aparecen perfiles con información disponible. Quité el corte por cámara para no achicar artificialmente la lectura.
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
            <div className="vm-cycle-bar__note">
              <span className="vm-cycle-bar__note-badge">Vista completa</span>
              <p>
                Se muestran Senado y Cámara juntos para este periodo. La cobertura se limita a legisladores con información disponible en la capa publicada.
              </p>
            </div>
          </div>
        </section>

        <section className="vm-overview">
          <div className="vm-container">
            <header className="vm-section__header vm-section__header--inline">
              <div>
                <p className="vm-eyebrow">Pulso del periodo</p>
                <h2>Lectura general antes de entrar a cada perfil</h2>
              </div>
              <p className="vm-section__note">
                Cuatro paneles para entender cobertura, mezcla por cámara, temas más sólidos y perfiles que merecen abrirse primero.
              </p>
            </header>

            <div className="vm-overview-grid">
              <article className="vm-analytics-card">
                <div className="vm-analytics-card__head">
                  <p className="vm-eyebrow">Distribución</p>
                  <strong>Coherencia visible del periodo</strong>
                </div>
                <div className="vm-band-grid">
                  <div className="vm-band-card is-high">
                    <span>Alta</span>
                    <strong>{coherenceBands.high}</strong>
                    <p>Perfiles con 75% o más de coherencia visible.</p>
                  </div>
                  <div className="vm-band-card is-mid">
                    <span>Media</span>
                    <strong>{coherenceBands.mid}</strong>
                    <p>Lecturas mezcladas que necesitan contraste por tema.</p>
                  </div>
                  <div className="vm-band-card is-watch">
                    <span>En revisión</span>
                    <strong>{coherenceBands.watch}</strong>
                    <p>Perfiles donde pesan más ausencias, desvíos o rupturas.</p>
                  </div>
                </div>
              </article>

              <article className="vm-analytics-card">
                <div className="vm-analytics-card__head">
                  <p className="vm-eyebrow">Cobertura</p>
                  <strong>Mezcla por cámara</strong>
                </div>
                <div className="vm-analytics-bars">
                  {chamberSummary.map((item) => (
                    <div key={item.label} className="vm-analytics-bar">
                      <div className="vm-analytics-bar__meta">
                        <span>{item.label}</span>
                        <strong>{item.count} perfiles</strong>
                      </div>
                      <div className="vm-analytics-bar__track">
                        <span style={{ width: `${(item.count / Math.max(visibleProfiles.length, 1)) * 100}%` }} />
                      </div>
                      <p>{item.coherence}% de coherencia media · {item.votes.toLocaleString("es-CO")} votos indexados</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="vm-analytics-card">
                <div className="vm-analytics-card__head">
                  <p className="vm-eyebrow">Temas</p>
                  <strong>Temas con mejor lectura colectiva</strong>
                </div>
                <div className="vm-topic-overview">
                  {themeOverview.slice(0, 5).map((item) => (
                    <div key={item.label} className="vm-topic-overview__row">
                      <div className="vm-topic-overview__meta">
                        <span>{item.label}</span>
                        <strong>{item.average}%</strong>
                      </div>
                      <div className="vm-topic-overview__track">
                        <span style={{ width: `${item.average}%` }} />
                      </div>
                      <p>{item.coherent}/{item.count} perfiles por encima de 70 · {item.alerts} alertas bajas</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="vm-analytics-card">
                <div className="vm-analytics-card__head">
                  <p className="vm-eyebrow">Aperturas rápidas</p>
                  <strong>Quiénes abrir primero</strong>
                </div>
                <div className="vm-watch-grid">
                  <div>
                    <span className="vm-watch-grid__label">Mejor consistencia</span>
                    <div className="vm-watch-list">
                      {topProfiles.map((profile) => (
                        <button
                          key={`top-${profile.id}`}
                          type="button"
                          className="vm-watch-pill"
                          onClick={() => setSelectedId(profile.id)}
                        >
                          <span>{profile.name}</span>
                          <strong>{profile.coherenceScore}%</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="vm-watch-grid__label">Más tensión visible</span>
                    <div className="vm-watch-list">
                      {tensionProfiles.map((profile) => (
                        <button
                          key={`watch-${profile.id}`}
                          type="button"
                          className="vm-watch-pill is-alert"
                          onClick={() => setSelectedId(profile.id)}
                        >
                          <span>{profile.name}</span>
                          <strong>{profile.absenceRate}% ausente</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="vm-section">
          <div className="vm-container">
            <header className="vm-section__header">
              <p className="vm-eyebrow">Explorador de legisladores</p>
              <h2>Explora legisladores con información disponible</h2>
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
                    <div className="vm-avatar" aria-hidden="true" style={{ background: partyColor(profile.party) }}>
                      {profile.name.charAt(0)}
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
                  <div className="vm-avatar vm-avatar--large" aria-hidden="true" style={{ background: partyColor(selectedProfile.party) }}>
                    {selectedProfile.name.charAt(0)}
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
                    La tabla se enfoca en el perfil seleccionado. Cada fila conserva la gaceta disponible y deja ver si
                    el voto fue coherente, inconsistente o quedó sin promesa comparable.
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
                    Verde = lectura alta · ámbar = lectura intermedia · gris = ausencia o falta de promesa comparable en esta capa visible.
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
                  <table className="vm-heatmap vm-matrix-table">
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
                                className={`vm-heatmap__cell ${getMatrixTone(cell)}`}
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
                  <h3>Capa visible actual</h3>
                  <p>Esta versión pública muestra solo legisladores y votaciones donde hoy sí hay información disponible y comparable dentro del periodo seleccionado.</p>
                </article>
                <article>
                  <h3>Conexión de backend</h3>
                  <p>La arquitectura ya separa perfiles, coherencia y fuentes para conectar la siguiente iteración sin volver a partir la experiencia por cámara.</p>
                </article>
                <article>
                  <h3>Fuente y contraste</h3>
                  <p>La lectura cruza tema, voto y rastro documental. Cuando una gaceta ya está enlazada, puedes abrir la referencia; cuando no, el tablero deja explícito que sigue pendiente.</p>
                </article>
              </div>
            </section>
          </>
        ) : null}
      </main>
      <SiteFooter lang={lang} />

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
        {row.gacetaHref && row.gacetaHref !== "#" ? (
          <a href={row.gacetaHref} target="_blank" rel="noopener noreferrer" className="vm-gaceta-link">
            {row.gaceta}
            <ArrowUpRight size={14} />
          </a>
        ) : (
          <span className="vm-gaceta-link vm-gaceta-link--pending" title="URL de gaceta en construcción">
            {row.gaceta}
          </span>
        )}
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

function partyColor(partido: string) {
  const map: Record<string, string> = {
    "Pacto Histórico": "#c0392b",
    "Colombia Humana": "#e74c3c",
    "Centro Democrático": "#1a5276",
    "Alianza Verde": "#27ae60",
    "Cambio Radical": "#f39c12",
  };
  return map[partido] ?? "#6b6a65";
}

function getMatrixTone(cell: HeatmapCell) {
  if (cell.value === null) return "is-matrix-low";
  if (cell.value >= 70) return "is-matrix-high";
  if (cell.value >= 40) return "is-matrix-mid";
  return "is-matrix-low";
}
