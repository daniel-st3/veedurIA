"use client";

import dynamic from "next/dynamic";
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
  type VotometroLegislator,
  type VoteCoherence,
  type VotePeriodKey,
  type VoteRecord,
} from "@/lib/votometro-data";
import { votoMetroCopy } from "@/lib/copy";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

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
type ProfilePeriodFilter = "all" | VotePeriodKey;

export function VotometroView({ lang }: { lang: Lang }) {
  const t = votoMetroCopy[lang];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profilePeriod, setProfilePeriod] = useState<ProfilePeriodFilter>("all");
  const [filters, setFilters] = useState<TableFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [barsVisible, setBarsVisible] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({});
  const spotlightRef = useRef<HTMLDivElement | null>(null);

  const visibleProfiles = VOTOMETRO_LEGISLATORS;

  useEffect(() => {
    let cancelled = false;

    const loadPhotos = async () => {
      const candidates = VOTOMETRO_LEGISLATORS.filter((profile) => profile.wikipediaTitle && !photoMap[profile.id]);
      await Promise.all(
        candidates.map(async (profile) => {
          try {
            const response = await fetch(
              `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(profile.wikipediaTitle ?? "")}`,
            );
            if (!response.ok) return;
            const payload = (await response.json()) as { originalimage?: { source?: string }; thumbnail?: { source?: string } };
            const image = payload.originalimage?.source ?? payload.thumbnail?.source;
            if (!cancelled && image) {
              setPhotoMap((current) => (current[profile.id] ? current : { ...current, [profile.id]: image }));
            }
          } catch {
            // Ignore missing public portraits and fall back to initials.
          }
        }),
      );
    };

    void loadPhotos();

    return () => {
      cancelled = true;
    };
  }, [photoMap]);

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

  useEffect(() => {
    if (!selectedProfile) return;
    if (profilePeriod !== "all" && !selectedProfile.periods.includes(profilePeriod)) {
      setProfilePeriod("all");
    }
  }, [profilePeriod, selectedProfile]);

  const heroStats = useMemo(() => {
    const indexedVotes = visibleProfiles.reduce((sum, profile) => sum + profile.totalVotes, 0);
    const legislators = visibleProfiles.length;
    const coherenceAverage = legislators
      ? Math.round(visibleProfiles.reduce((sum, profile) => sum + profile.coherenceScore, 0) / legislators)
      : 0;
    const trackedProjects = new Set(visibleProfiles.flatMap((profile) => profile.voteRows.map((row) => row.project))).size;
    return { indexedVotes, legislators, coherenceAverage, trackedProjects };
  }, [visibleProfiles]);

  const selectedProfileRows = useMemo(() => {
    if (!selectedProfile) return [];
    return selectedProfile.voteRows.filter((row) => profilePeriod === "all" || row.period === profilePeriod);
  }, [profilePeriod, selectedProfile]);

  const tableYears = useMemo(() => {
    if (!selectedProfileRows.length) return [];
    return [...new Set(selectedProfileRows.map((row) => row.date.slice(0, 4)))].sort((a, b) => Number(b) - Number(a));
  }, [selectedProfileRows]);

  const filteredRows = useMemo(() => {
    if (!selectedProfileRows.length) return [];
    return selectedProfileRows.filter((row) => {
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
  }, [filters, selectedProfileRows]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [filters, profilePeriod, selectedProfile?.id]);

  const paginatedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const matrixProfiles = useMemo(
    () => (profilePeriod === "all" ? visibleProfiles : visibleProfiles.filter((profile) => profile.periods.includes(profilePeriod))),
    [profilePeriod, visibleProfiles],
  );

  const heatmapRows = useMemo(() => {
    return [...matrixProfiles].sort((a, b) => b.coherenceScore - a.coherenceScore || b.totalVotes - a.totalVotes).slice(0, 12);
  }, [matrixProfiles]);

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

  const selectedThemeBars = useMemo(() => {
    if (!selectedProfileRows.length) return [];
    return HEATMAP_COLUMNS.map((column) => {
      const relevant = selectedProfileRows.filter((row) => row.topicKey === column.key);
      const comparable = relevant.filter((row) => typeof row.score === "number");
      const averageScore = comparable.length
        ? Math.round(comparable.reduce((sum, row) => sum + (row.score ?? 0), 0) / comparable.length)
        : 0;
      const coherentCount = comparable.filter((row) => (row.score ?? 0) >= 70).length;
      return {
        key: column.key,
        label: column.label,
        score: averageScore,
        note:
          profilePeriod === "all"
            ? `${comparable.length}/${relevant.length || comparable.length} periodos comparables`
            : `${coherentCount}/${comparable.length || relevant.length || 1} votos por encima de 70`,
      };
    })
      .filter((item) => selectedProfileRows.some((row) => row.topicKey === item.key))
      .sort((a, b) => b.score - a.score);
  }, [profilePeriod, selectedProfileRows]);

  const selectedProfileMetrics = useMemo(() => {
    const comparable = selectedProfileRows.filter((row) => typeof row.score === "number");
    const coherentVotes = selectedProfileRows.filter((row) => row.coherence === "coherente").length;
    const inconsistentVotes = selectedProfileRows.filter((row) => row.coherence === "inconsistente").length;
    const absences = selectedProfileRows.filter((row) => row.position === "Ausente").length;
    const deviations = selectedProfileRows.filter((row) => row.deviatesFromBench).length;
    const averageScore = comparable.length
      ? Math.round(comparable.reduce((sum, row) => sum + (row.score ?? 0), 0) / comparable.length)
      : 0;

    return {
      coherentVotes,
      inconsistentVotes,
      absences,
      deviations,
      comparableVotes: comparable.length,
      visibleVotes: selectedProfileRows.length,
      averageScore,
    };
  }, [selectedProfileRows]);

  const scatterProfiles = useMemo(
    () =>
      (profilePeriod === "all" ? visibleProfiles : visibleProfiles.filter((profile) => profile.periods.includes(profilePeriod)))
        .slice()
        .sort((a, b) => b.coherenceScore - a.coherenceScore),
    [profilePeriod, visibleProfiles],
  );

  // Diverging bar: coherent votes (right, %) vs inconsistent+absent (left, %)
  const divergingData = useMemo(() => {
    const names = scatterProfiles.map((p) => p.name);
    const coherentPct = scatterProfiles.map((p) => {
      const total = p.consistentVotes + p.inconsistentVotes + p.absencesOnKeyThemes || 1;
      return Math.round((p.consistentVotes / total) * 100);
    });
    const inconsistentPct = scatterProfiles.map((p) => {
      const total = p.consistentVotes + p.inconsistentVotes + p.absencesOnKeyThemes || 1;
      return -Math.round((p.inconsistentVotes / total) * 100);
    });
    const absentPct = scatterProfiles.map((p) => {
      const total = p.consistentVotes + p.inconsistentVotes + p.absencesOnKeyThemes || 1;
      return -Math.round((p.absencesOnKeyThemes / total) * 100);
    });

    return [
      {
        name: lang === "es" ? "Coherente" : "Coherent",
        x: coherentPct,
        y: names,
        type: "bar",
        orientation: "h",
        marker: { color: "rgba(16,185,129,0.78)", line: { color: "rgba(16,185,129,0.3)", width: 1 } },
        customdata: scatterProfiles.map((p) => [p.id, p.coherenceScore, p.totalVotes]),
        hovertemplate:
          lang === "es"
            ? "<b>%{y}</b><br>%{x}% votos coherentes · coherencia %{customdata[1]}%<extra></extra>"
            : "<b>%{y}</b><br>%{x}% coherent votes · score %{customdata[1]}%<extra></extra>",
      },
      {
        name: lang === "es" ? "Inconsistente" : "Inconsistent",
        x: inconsistentPct,
        y: names,
        type: "bar",
        orientation: "h",
        marker: { color: "rgba(220,38,38,0.72)", line: { color: "rgba(220,38,38,0.3)", width: 1 } },
        customdata: scatterProfiles.map((p) => [p.id, p.inconsistentVotes]),
        hovertemplate:
          lang === "es"
            ? "<b>%{y}</b><br>%{customdata[1]} votos inconsistentes<extra></extra>"
            : "<b>%{y}</b><br>%{customdata[1]} inconsistent votes<extra></extra>",
      },
      {
        name: lang === "es" ? "Ausencias clave" : "Key absences",
        x: absentPct,
        y: names,
        type: "bar",
        orientation: "h",
        marker: { color: "rgba(100,116,139,0.55)", line: { color: "rgba(100,116,139,0.2)", width: 1 } },
        customdata: scatterProfiles.map((p) => [p.id, p.absencesOnKeyThemes]),
        hovertemplate:
          lang === "es"
            ? "<b>%{y}</b><br>%{customdata[1]} ausencias en temas clave<extra></extra>"
            : "<b>%{y}</b><br>%{customdata[1]} absences on key themes<extra></extra>",
      },
    ];
  }, [scatterProfiles, lang]);
  const spotlightPeriodLabel =
    profilePeriod === "all"
      ? lang === "es"
        ? "Vista global de todos los periodos visibles"
        : "Global view across all visible periods"
      : VOTOMETRO_PERIODS.find((item) => item.key === profilePeriod)?.label ?? profilePeriod;

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
              <p className="vm-eyebrow">{t.eyebrowTemplate(visibleProfiles.length)}</p>
              <h1>{t.heroTitle}</h1>
              <p className="vm-hero__body">{t.heroBody}</p>
              <p className="vm-hero__source-note">{t.heroSourceNote}</p>
            </div>

            <div className="vm-hero__stats" aria-label="Indicadores principales">
              <article className="vm-kpi-card">
                <strong>{heroStats.indexedVotes.toLocaleString(lang === "es" ? "es-CO" : "en-US")}</strong>
                <span>{t.kpiVotes}</span>
              </article>
              <article className="vm-kpi-card">
                <strong>{heroStats.legislators.toLocaleString(lang === "es" ? "es-CO" : "en-US")}</strong>
                <span>{t.kpiLegislators}</span>
              </article>
              <article className="vm-kpi-card">
                <strong>{`${heroStats.coherenceAverage}%`}</strong>
                <span>{t.kpiCoherence}</span>
              </article>
              <article className="vm-kpi-card">
                <strong>{heroStats.trackedProjects.toLocaleString(lang === "es" ? "es-CO" : "en-US")}</strong>
                <span>{t.kpiProjects}</span>
              </article>
            </div>
          </div>
        </section>

        <section className="vm-overview">
          <div className="vm-container">
            <header className="vm-section__header vm-section__header--inline">
              <div>
                <p className="vm-eyebrow">{t.sectionOverviewEyebrow}</p>
                <h2>{t.sectionOverviewTitle}</h2>
              </div>
              <p className="vm-section__note">{t.sectionOverviewNote}</p>
            </header>

            <div className="vm-overview-grid">
              <article className="vm-analytics-card">
                <div className="vm-analytics-card__head">
                  <p className="vm-eyebrow">{t.distributionEyebrow}</p>
                  <strong>{t.distributionTitle}</strong>
                </div>
                <div className="vm-band-grid">
                  <div className="vm-band-card is-high">
                    <span>{t.bandHigh}</span>
                    <strong>{coherenceBands.high}</strong>
                    <p>{t.bandHighDesc}</p>
                  </div>
                  <div className="vm-band-card is-mid">
                    <span>{t.bandMid}</span>
                    <strong>{coherenceBands.mid}</strong>
                    <p>{t.bandMidDesc}</p>
                  </div>
                  <div className="vm-band-card is-watch">
                    <span>{t.bandWatch}</span>
                    <strong>{coherenceBands.watch}</strong>
                    <p>{t.bandWatchDesc}</p>
                  </div>
                </div>
              </article>

              <article className="vm-analytics-card">
                <div className="vm-analytics-card__head">
                  <p className="vm-eyebrow">{t.coverageEyebrow}</p>
                  <strong>{t.coverageTitle}</strong>
                </div>
                <div className="vm-analytics-bars">
                  {chamberSummary.map((item) => (
                    <div key={item.label} className="vm-analytics-bar">
                      <div className="vm-analytics-bar__meta">
                        <span>{item.label}</span>
                        <strong>{item.count} {t.profilesLabel}</strong>
                      </div>
                      <div className="vm-analytics-bar__track">
                        <span style={{ width: `${(item.count / Math.max(visibleProfiles.length, 1)) * 100}%` }} />
                      </div>
                      <p>{t.coherenceMediaLabel(item.coherence, item.votes)}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="vm-analytics-card">
                <div className="vm-analytics-card__head">
                  <p className="vm-eyebrow">{t.themesEyebrow}</p>
                  <strong>{t.themesTitle}</strong>
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
                      <p>{t.themeProfiles(item.coherent, item.count, item.alerts)}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="vm-analytics-card">
                <div className="vm-analytics-card__head">
                  <p className="vm-eyebrow">{t.quickOpenEyebrow}</p>
                  <strong>{t.quickOpenTitle}</strong>
                </div>
                <div className="vm-watch-grid">
                  <div>
                    <span className="vm-watch-grid__label">{t.bestConsistency}</span>
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
                    <span className="vm-watch-grid__label">{t.mostTension}</span>
                    <div className="vm-watch-list">
                      {tensionProfiles.map((profile) => (
                        <button
                          key={`watch-${profile.id}`}
                          type="button"
                          className="vm-watch-pill is-alert"
                          onClick={() => setSelectedId(profile.id)}
                        >
                          <span>{profile.name}</span>
                          <strong>{t.absenceLabel(profile.absenceRate)}</strong>
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
            <header className="vm-section__header vm-section__header--inline">
              <div>
                <p className="vm-eyebrow">{t.coherenceMapEyebrow}</p>
                <h2>{t.coherenceMapTitle}</h2>
              </div>
              <p className="vm-section__note">{t.coherenceMapNote}</p>
            </header>

            <div className="vm-panel vm-panel--plot">
              <Plot
                data={divergingData as any}
                layout={{
                  autosize: true,
                  paper_bgcolor: "rgba(0,0,0,0)",
                  plot_bgcolor: "rgba(0,0,0,0)",
                  barmode: "relative",
                  margin: { l: 148, r: 32, t: 16, b: 48 },
                  font: { color: "#2a241b", family: "Inter, ui-sans-serif, system-ui, sans-serif", size: 12 },
                  xaxis: {
                    title: { text: lang === "es" ? "← Inconsistente / Ausente   |   Coherente →" : "← Inconsistent / Absent   |   Coherent →", standoff: 10 },
                    gridcolor: "rgba(42, 36, 27, 0.08)",
                    zeroline: true,
                    zerolinecolor: "rgba(42,36,27,0.25)",
                    zerolinewidth: 1.5,
                    ticksuffix: "%",
                    tickfont: { size: 11 },
                  },
                  yaxis: {
                    automargin: true,
                    tickfont: { size: 11 },
                  },
                  hovermode: "closest",
                  showlegend: true,
                  legend: {
                    orientation: "h",
                    x: 0,
                    y: -0.18,
                    font: { size: 11 },
                    bgcolor: "rgba(0,0,0,0)",
                  },
                }}
                config={{ responsive: true, displaylogo: false, displayModeBar: false }}
                onClick={(event: any) => {
                  const profileId = event.points?.[0]?.customdata?.[0];
                  if (typeof profileId === "string") setSelectedId(profileId);
                }}
                style={{ width: "100%", height: Math.max(320, scatterProfiles.length * 28 + 80) }}
              />
            </div>
          </div>
        </section>

        <section className="vm-section">
          <div className="vm-container">
            <header className="vm-section__header">
              <p className="vm-eyebrow">{t.legislatorExplorerEyebrow}</p>
              <h2>{t.legislatorExplorerTitle}</h2>
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
                    <ProfileAvatar profile={profile} photoMap={photoMap} size="small" />
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
                    <span>{t.votesLabel(profile.totalVotes)}</span>
                    <span>{t.absenceLabel(profile.absenceRate)}</span>
                    <span>{t.periodsLabel(profile.periods.length)}</span>
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
                  <ProfileAvatar profile={selectedProfile} photoMap={photoMap} size="large" />
                  <div className="vm-spotlight__identity">
                    <h2>{selectedProfile.name}</h2>
                    <p>{`${selectedProfile.party} · ${selectedProfile.chamberLabel}`}</p>
                  </div>

                  <div className="vm-period-selector" aria-label="Periodos disponibles">
                    <button
                      type="button"
                      className={`vm-period-chip ${profilePeriod === "all" ? "is-active" : ""}`}
                      onClick={() => setProfilePeriod("all")}
                    >
                      Global
                    </button>
                    {selectedProfile.periods.map((item) => (
                      <button
                        key={`${selectedProfile.id}-${item}`}
                        type="button"
                        className={`vm-period-chip ${profilePeriod === item ? "is-active" : ""}`}
                        onClick={() => setProfilePeriod(item)}
                      >
                        {VOTOMETRO_PERIODS.find((periodItem) => periodItem.key === item)?.label ?? item}
                      </button>
                    ))}
                  </div>

                  <div className="vm-kpi-stack">
                    <article className="vm-kpi-stack__item">
                      <span>{t.consistentVotes}</span>
                      <strong className="is-primary">{selectedProfileMetrics.coherentVotes}</strong>
                    </article>
                    <article className="vm-kpi-stack__item">
                      <span>{t.inconsistentVotes}</span>
                      <strong className="is-high">{selectedProfileMetrics.inconsistentVotes}</strong>
                    </article>
                    <article className="vm-kpi-stack__item">
                      <span>{t.absencesLabel}</span>
                      <strong className="is-muted">{selectedProfileMetrics.absences}</strong>
                    </article>
                    <article className="vm-kpi-stack__item">
                      <span>{t.deviationsLabel}</span>
                      <strong className="is-amber">{selectedProfileMetrics.deviations}</strong>
                    </article>
                  </div>

                  <div className="vm-coherence">
                    <div className="vm-coherence__head">
                      <span>{spotlightPeriodLabel}</span>
                      <strong>{selectedProfileMetrics.averageScore}%</strong>
                    </div>
                    <div className="vm-coherence__bar">
                      <span style={{ width: `${selectedProfileMetrics.averageScore}%` }} />
                    </div>
                  </div>
                </aside>

                <div className="vm-spotlight__main">
                  <section className="vm-panel">
                    <header className="vm-panel__header">
                      <p className="vm-eyebrow">{t.spotlightDetailEyebrow}</p>
                      <h3>{profilePeriod === "all" ? t.spotlightDetailTitleAll : t.spotlightDetailTitlePeriod}</h3>
                    </header>

                    <div className="vm-topic-bars">
                      {selectedThemeBars.map((item) => {
                        const tone = item.score > 70 ? "is-good" : item.score >= 40 ? "is-mid" : "is-bad";
                        return (
                          <div key={item.key} className="vm-topic-bar">
                            <div>
                              <span className="vm-topic-bar__label">{item.label}</span>
                              <small className="vm-topic-bar__note">{item.note}</small>
                            </div>
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
                      <p className="vm-eyebrow">{t.connectionEyebrow}</p>
                      <p>
                        {selectedProfile.contractsCount > 0
                          ? t.contractsFound(selectedProfile.contractsCount)
                          : t.contractsNone}
                      </p>
                    </div>
                    {selectedProfile.contractsCount > 0 ? (
                      <Link
                        href={`/contrato-limpio?lang=${lang}&q=${encodeURIComponent(selectedProfile.contractsQuery)}`}
                        className="vm-button vm-button--ghost"
                      >
                        {t.viewContracts}
                        <ArrowRight size={16} aria-hidden={true} />
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
                    <p className="vm-eyebrow">{t.votesTableEyebrow}</p>
                    <h2>{t.votesTableTitle}</h2>
                  </div>
                  <p className="vm-section__note">{t.votesTableNote}</p>
                </header>

                <div className="vm-table-filters" aria-label={t.filterCoherence}>
                  <select value={filters.theme} onChange={(event) => updateFilter("theme", event.target.value)}>
                    <option value="all">{t.filterTheme}</option>
                    {[...new Set(selectedProfileRows.map((row) => row.theme))].map((themeOption) => (
                      <option key={themeOption} value={themeOption}>
                        {themeOption}
                      </option>
                    ))}
                  </select>

                  <select value={filters.result} onChange={(event) => updateFilter("result", event.target.value)}>
                    <option value="all">{t.filterResult}</option>
                    <option value="Aprobado">{t.resultApproved}</option>
                    <option value="Rechazado">{t.resultRejected}</option>
                    <option value="Archivado">{t.resultArchived}</option>
                  </select>

                  <select value={filters.coherence} onChange={(event) => updateFilter("coherence", event.target.value)}>
                    <option value="all">{t.filterCoherence}</option>
                    <option value="coherente">{t.coherentLabel}</option>
                    <option value="inconsistente">{t.inconsistentLabel}</option>
                    <option value="sin-promesa">{t.noPromiseLabel}</option>
                    <option value="ausente">{t.absentLabel}</option>
                  </select>

                  <select value={filters.year} onChange={(event) => updateFilter("year", event.target.value)}>
                    <option value="all">{t.filterDate}</option>
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
                    placeholder={t.filterSearchPlaceholder}
                    aria-label={t.filterSearchPlaceholder}
                  />
                </div>

                <div className="vm-table-wrap">
                  <table className="vm-votes-table">
                    <thead>
                      <tr>
                        <th style={{ width: "40%" }}>{t.colProject}</th>
                        <th style={{ width: "12%" }}>{t.colPeriod}</th>
                        <th style={{ width: "10%" }}>{t.colDate}</th>
                        <th style={{ width: "12%" }}>{t.colTheme}</th>
                        <th style={{ width: "10%" }}>{t.colPosition}</th>
                        <th style={{ width: "10%" }}>{t.colResult}</th>
                        <th style={{ width: "10%" }}>{t.colCoherence}</th>
                        <th style={{ width: "8%" }}>{t.colGaceta}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.length ? (
                        paginatedRows.map((row) => (
                          <VoteRowView key={`${selectedProfile.id}-${row.id}`} row={row} lang={lang} />
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="vm-empty-state">
                            {t.noVotesMatch}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="vm-pagination">
                  <button type="button" className="vm-page-button" onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    {t.prevPage}
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
                    {t.nextPage}
                  </button>
                </div>
              </div>
            </section>

            <section className="vm-section">
              <div className="vm-container">
                <header className="vm-section__header">
                  <p className="vm-eyebrow">{t.matrixEyebrow}</p>
                  <h2>{t.matrixTitle}</h2>
                  <p className="vm-section__note">{t.matrixNote}</p>
                </header>

                <div className="vm-legend">
                  <span className="vm-legend__item">
                    <i className="is-good" />
                    {t.legendCoherent}
                  </span>
                  <span className="vm-legend__item">
                    <i className="is-bad" />
                    {t.legendInconsistent}
                  </span>
                  <span className="vm-legend__item">
                    <i className="is-muted" />
                    {t.legendAbsent}
                  </span>
                </div>

                <div className="vm-heatmap-wrap">
                  <table className="vm-heatmap vm-matrix-table">
                    <thead>
                      <tr>
                        <th>{t.colLegislator}</th>
                        {HEATMAP_COLUMNS.map((column) => (
                          <th key={column.key} title={column.label}>
                            <span>{column.shortLabel}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapRows.map((profile) => (
                        <tr key={`heatmap-${profile.id}`}>
                          <th scope="row">{profile.name}</th>
                          {buildHeatmapCells(profile, profilePeriod).map((cell) => (
                            <td key={`${profile.id}-${cell.key}`}>
                              <button
                                type="button"
                                className={`vm-heatmap__cell ${getMatrixTone(cell)}`}
                                onMouseEnter={(event) => showTooltip(event, profile.name, cell)}
                                onMouseMove={moveTooltip}
                                onMouseLeave={() => setTooltip(null)}
                                aria-label={`${profile.name} · ${cell.label}`}
                              >
                                {cell.state === "ausente" ? t.cellAbsent : cell.value ?? "·"}
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
                  <h3>{t.methodsLayer}</h3>
                  <p>{t.methodsLayerBody}</p>
                </article>
                <article>
                  <h3>{t.methodsBackend}</h3>
                  <p>{t.methodsBackendBody}</p>
                </article>
                <article>
                  <h3>{t.methodsSource}</h3>
                  <p>{t.methodsSourceBody}</p>
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

function VoteRowView({ row, lang }: { row: VoteRecord; lang: Lang }) {
  const t = votoMetroCopy[lang];
  return (
    <tr>
      <td>{row.project}</td>
      <td>{formatPeriodLabel(row.period)}</td>
      <td>{row.dateLabel}</td>
      <td>{row.theme}</td>
      <td>
        <span className={`vm-status-badge ${getPositionClass(row.position)}`}>{row.position}</span>
      </td>
      <td>{row.result}</td>
      <td className={`vm-coherence-cell ${getCoherenceClass(row.coherence)}`}>{getCoherenceLabel(row.coherence, t)}</td>
      <td>
        {row.gacetaHref && row.gacetaHref !== "#" ? (
          <a href={row.gacetaHref} target="_blank" rel="noopener noreferrer" className="vm-gaceta-link">
            {row.gaceta}
            <ArrowUpRight size={14} aria-hidden={true} />
          </a>
        ) : (
          <span className="vm-gaceta-link vm-gaceta-link--pending" title={t.gacetaPendingTitle}>
            {row.gaceta}
          </span>
        )}
      </td>
    </tr>
  );
}

function ProfileAvatar({
  profile,
  photoMap,
  size,
}: {
  profile: VotometroLegislator;
  photoMap: Record<string, string>;
  size: "small" | "large";
}) {
  const image = photoMap[profile.id];

  return (
    <div className={`vm-avatar vm-avatar--${size} ${image ? "has-photo" : ""}`}>
      {image ? <img src={image} alt={profile.name} loading="lazy" /> : <span>{profile.initials}</span>}
      <i className="vm-avatar__dot" style={{ backgroundColor: partyColor(profile.party) }} aria-hidden="true" />
    </div>
  );
}

function buildHeatmapCells(profile: VotometroLegislator, period: ProfilePeriodFilter) {
  return HEATMAP_COLUMNS.map((column) => {
    const relevant = profile.voteRows.filter((row) => row.topicKey === column.key && (period === "all" || row.period === period));
    const comparable = relevant.filter((row) => typeof row.score === "number");
    const latestRow = [...relevant].sort((a, b) => b.date.localeCompare(a.date))[0];
    const averageScore = comparable.length
      ? Math.round(comparable.reduce((sum, row) => sum + (row.score ?? 0), 0) / comparable.length)
      : null;
    const coherentCount = comparable.filter((row) => row.coherence === "coherente").length;
    const inconsistentCount = comparable.filter((row) => row.coherence === "inconsistente").length;
    const state = !relevant.length
      ? "sin-dato"
      : relevant.every((row) => row.position === "Ausente")
        ? "ausente"
        : comparable.length === 0
          ? "sin-dato"
        : coherentCount >= inconsistentCount
          ? "coherente"
          : "inconsistente";

    return {
      key: column.key,
      label: column.label,
      value: averageScore,
      state,
      position: latestRow?.position,
      project: latestRow?.project,
      dateLabel: latestRow?.dateLabel,
      gaceta: latestRow?.gaceta,
    } satisfies HeatmapCell;
  });
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

function getCoherenceLabel(coherence: VoteCoherence, t: { coherentLabel: string; inconsistentLabel: string; noPromiseLabel: string }) {
  switch (coherence) {
    case "coherente":
      return t.coherentLabel;
    case "inconsistente":
      return t.inconsistentLabel;
    default:
      return t.noPromiseLabel;
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
  if (cell.state === "ausente" || cell.state === "sin-dato" || cell.value === null) return "is-matrix-low";
  if (cell.value >= 70) return "is-matrix-high";
  if (cell.value >= 40) return "is-matrix-mid";
  return "is-matrix-low";
}

function formatPeriodLabel(period: VotePeriodKey) {
  return VOTOMETRO_PERIODS.find((item) => item.key === period)?.label.split("·")[0]?.trim() ?? period;
}
