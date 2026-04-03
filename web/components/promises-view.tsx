"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BookOpenText, Landmark, Radar, Search, Sparkles } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { fetchPromisesOverview } from "@/lib/api";
import { promisesCopy } from "@/lib/copy";
import type { Lang, PromiseCard, PromisesPayload } from "@/lib/types";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type PromiseFilters = {
  politicianId?: string;
  domain: string;
  status: string;
  electionYear: number;
  query: string;
};

export function PromisesView({
  lang,
  initialPayload,
}: {
  lang: Lang;
  initialPayload: PromisesPayload | null;
}) {
  const copy = promisesCopy[lang];
  const scope = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<PromiseFilters>({
    politicianId: initialPayload?.scorecard.politicianId || initialPayload?.options.politicians[0]?.value,
    domain: "all",
    status: "all",
    electionYear: initialPayload?.meta.electionYear ?? 2026,
    query: "",
  });
  const [filters, setFilters] = useState<PromiseFilters>({
    politicianId: initialPayload?.scorecard.politicianId || initialPayload?.options.politicians[0]?.value,
    domain: "all",
    status: "all",
    electionYear: initialPayload?.meta.electionYear ?? 2026,
    query: "",
  });
  const [payload, setPayload] = useState<PromisesPayload | null>(initialPayload);
  const [loading, setLoading] = useState(!initialPayload);
  const [openCardId, setOpenCardId] = useState<string | null>(initialPayload?.cards[0]?.id ?? null);
  const skipFirst = useRef(Boolean(initialPayload));

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    let alive = true;
    setLoading(true);
    fetchPromisesOverview({
      lang,
      politicianId: filters.politicianId,
      domain: filters.domain,
      status: filters.status,
      electionYear: filters.electionYear,
      query: filters.query,
      limit: 18,
    })
      .then((data) => {
        if (!alive) return;
        setPayload(data);
        setOpenCardId(data.cards[0]?.id ?? null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filters, lang]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".promise-hero, .promise-kpi, .promise-scorecard, .promise-card, .promise-method",
          { autoAlpha: 0, y: 32, scale: 0.985 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.72, stagger: 0.06, ease: "power3.out" },
        );
        gsap.fromTo(
          ".promise-scorebar__fill, .promise-card__meter",
          { scaleX: 0.08, autoAlpha: 0.45 },
          {
            scaleX: 1,
            autoAlpha: 1,
            duration: 0.72,
            stagger: 0.05,
            ease: "power3.out",
            transformOrigin: "left center",
            delay: 0.18,
          },
        );
        gsap.to(".promise-stage__orb", {
          xPercent: 10,
          yPercent: -8,
          duration: 4.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
        ScrollTrigger.batch(".promise-card", {
          start: "top 90%",
          once: true,
          onEnter: (batch) => {
            gsap.fromTo(
              batch,
              { autoAlpha: 0, y: 40 },
              { autoAlpha: 1, y: 0, duration: 0.68, stagger: 0.08, ease: "power3.out" },
            );
          },
        });
      });
      return () => mm.revert();
    },
    {
      scope,
      dependencies: [payload?.meta.shownRows ?? 0, openCardId, filters.domain, filters.status, filters.electionYear],
      revertOnUpdate: true,
    },
  );

  const cards = payload?.cards ?? [];
  const coverageLabel = payload?.meta.coverageMode === "live" ? copy.activeLive : copy.activePilot;
  const selectedCard =
    cards.find((card) => card.id === openCardId) ??
    cards[0] ??
    null;

  return (
    <div ref={scope} className="shell">
      <SiteNav
        lang={lang}
        links={[
          { href: `/contrato-limpio?lang=${lang}`, label: copy.navPhase1 },
          { href: `/promesmetro?lang=${lang}`, label: copy.navPhase2 },
          { href: `/sigue-el-dinero?lang=${lang}`, label: copy.navPhase3 },
        ]}
        ctaHref={`/promesmetro?lang=${lang}`}
        ctaLabel={copy.navPhase2}
      />

      <main className="page">
        <section className="overview-card stripe-flag promise-hero promise-hero--clean">
          <div className="promise-hero__intro">
            <p className="eyebrow">{copy.pageEyebrow}</p>
            <h1 className="phase-title promise-stage__title">{copy.pageTitle}</h1>
            <p className="section-copy promise-stage__body">{copy.pageBody}</p>
            <div className="promise-stage__pills">
              <span className="tiny-pill slice-chip slice-chip--active">{coverageLabel}</span>
              <span className="tiny-pill slice-chip">{copy.activeRealNames}</span>
              <span className="tiny-pill slice-chip">{payload?.highlights.focusDomain ?? "—"}</span>
              <span className="tiny-pill slice-chip">{payload?.highlights.focusStatus ?? "—"}</span>
            </div>
          </div>

          <div className="promise-hero__top">
            <article className="promise-hero__stat surface-soft stripe-blue">
              <span className="label">{copy.highlightsPolitician}</span>
              <strong>{payload?.highlights.focusPolitician ?? "—"}</strong>
            </article>
            <article className="promise-hero__stat surface-soft stripe-yellow">
              <span className="label">{copy.highlightsDomain}</span>
              <strong>{payload?.highlights.focusDomain ?? "—"}</strong>
            </article>
            <article className="promise-hero__stat surface-soft stripe-red">
              <span className="label">{copy.highlightsStatus}</span>
              <strong>{payload?.highlights.focusStatus ?? "—"}</strong>
            </article>
            <article className="promise-hero__stat promise-hero__stat--note surface-soft stripe-green">
              <span className="label">{payload?.meta.lastScoredAt?.slice(0, 10) ?? "—"}</span>
              <p className="body-copy">{payload?.meta.pilotNote}</p>
            </article>
          </div>

          <div className="filter-bar page-controls promise-filters">
            <label className="filter-field">
              <span className="label">{copy.filterPolitician}</span>
              <select
                value={draft.politicianId ?? ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, politicianId: event.target.value || undefined }))}
              >
                {(payload?.options.politicians ?? []).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span className="label">{copy.filterDomain}</span>
              <select value={draft.domain} onChange={(event) => setDraft((prev) => ({ ...prev, domain: event.target.value }))}>
                {(payload?.options.domains ?? []).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span className="label">{copy.filterStatus}</span>
              <select value={draft.status} onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value }))}>
                {(payload?.options.statuses ?? []).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span className="label">{copy.filterYear}</span>
              <select
                value={draft.electionYear}
                onChange={(event) => setDraft((prev) => ({ ...prev, electionYear: Number(event.target.value) }))}
              >
                {(payload?.options.years ?? [2026]).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span className="label">
                <Search size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
                {copy.searchLabel}
              </span>
              <input
                value={draft.query}
                onChange={(event) => setDraft((prev) => ({ ...prev, query: event.target.value }))}
                placeholder={copy.searchPlaceholder}
              />
            </label>
            <button
              type="button"
              className="btn-primary filter-apply"
              style={{ border: "none", cursor: "pointer", justifyContent: "center" }}
              onClick={() => setFilters(draft)}
            >
              {copy.applyFilters}
            </button>
          </div>
        </section>

        <section className="dashboard-strip promise-kpis">
          <div className="dashboard-strip__grid">
            <article className="metric-shell stripe-blue promise-kpi">
              <div className="label">{copy.kpiPoliticians}</div>
              <div className="summary-number">{payload?.kpis.politiciansTracked ?? 0}</div>
            </article>
            <article className="metric-shell stripe-yellow promise-kpi">
              <div className="label">{copy.kpiPromises}</div>
              <div className="summary-number">{payload?.kpis.promisesTracked ?? 0}</div>
            </article>
            <article className="metric-shell stripe-red promise-kpi">
              <div className="label">{copy.kpiCoherence}</div>
              <div className="summary-number">{payload?.kpis.coherenceRate ?? 0}%</div>
            </article>
            <article className="metric-shell stripe-green promise-kpi">
              <div className="label">{copy.kpiDomains}</div>
              <div className="summary-number">{payload?.kpis.activeDomains ?? 0}</div>
            </article>
          </div>
        </section>

        <section className="two-col promise-grid">
          <aside className="surface stripe-blue promise-scorecard">
            <div className="promise-scorecard__top">
              <div>
                <p className="eyebrow">{copy.scorecardEyebrow}</p>
                <h2 className="section-title promise-scorecard__title">{copy.scorecardTitle}</h2>
                <p className="section-copy promise-scorecard__body">{copy.scorecardBody}</p>
              </div>
              <div className="promise-scorecard__ring">
                <span>{payload?.scorecard.overallScore ?? 0}</span>
              </div>
            </div>

            <div className="promise-profile">
              <strong>{payload?.scorecard.politicianName ?? "—"}</strong>
              <span>{payload?.scorecard.chamber ?? "—"} · {payload?.scorecard.party ?? "—"}</span>
            </div>

            <div className="promise-scorecard__counts">
              <div><span>{copy.scoreFulfilled}</span><strong>{payload?.scorecard.statusCounts.fulfilled ?? 0}</strong></div>
              <div><span>{copy.scoreMonitoring}</span><strong>{payload?.scorecard.statusCounts.monitoring ?? 0}</strong></div>
              <div><span>{copy.scoreNoAction}</span><strong>{payload?.scorecard.statusCounts.noAction ?? 0}</strong></div>
            </div>

            <div className="promise-domain-list">
              <div className="label" style={{ marginBottom: "0.6rem" }}>{copy.domainBreakdown}</div>
              {(payload?.scorecard.domains ?? []).map((domain) => (
                <div key={domain.key} className="promise-scorebar">
                  <div className="promise-scorebar__meta">
                    <span>{domain.label}</span>
                    <strong>{Math.round(domain.score * 100)}%</strong>
                  </div>
                  <div className="promise-scorebar__track">
                    <span className="promise-scorebar__fill" style={{ width: `${Math.max(10, Math.round(domain.score * 100))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <div className="promise-cards-shell">
            <div className="section-head promise-cards-head">
              <div>
                <p className="eyebrow">{copy.cardsEyebrow}</p>
                <h2 className="section-title">{copy.cardsTitle}</h2>
              </div>
              <p className="section-copy">{copy.cardsBody}</p>
            </div>

            {loading && !payload ? <div className="surface promise-method">{copy.cardsEmpty}</div> : null}

            <div className="promise-cards">
              {cards.length ? (
                cards.map((card) => {
                  const isOpen = openCardId === card.id;
                  return (
                    <article
                      key={card.id}
                      className={`surface promise-card promise-card--${card.status === "con_accion_registrada" ? "good" : card.status === "en_seguimiento" ? "watch" : "low"}`}
                    >
                      <button type="button" className="promise-card__header" onClick={() => setOpenCardId(isOpen ? null : card.id)}>
                        <div className="promise-card__eyebrow">
                          <span className="tiny-pill">{card.domainLabel}</span>
                          <span className="tiny-pill">{card.statusLabel}</span>
                        </div>
                        <h3>{card.promiseText}</h3>
                        <div className="promise-card__metrics">
                          <span>{copy.similarity}: <strong>{card.similarityScore}%</strong></span>
                          <span>{copy.extraction}: <strong>{card.extractionConfidence}%</strong></span>
                        </div>
                        <div className="promise-card__meter-track">
                          <span className="promise-card__meter" style={{ width: `${Math.max(10, card.similarityScore)}%` }} />
                        </div>
                      </button>

                      {isOpen ? (
                        <div className="promise-card__body">
                          <div className="promise-card__block">
                            <div className="label">{copy.evidence}</div>
                            <strong>{card.actionTitle}</strong>
                            <p className="body-copy">{card.actionSummary || copy.noEvidence}</p>
                          </div>
                          <div className="promise-card__sources">
                            <a href={card.promiseSourceUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                              <BookOpenText size={16} /> {copy.verifyPromise}
                            </a>
                            <a href={card.actionSourceUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                              <Landmark size={16} /> {copy.verifyAction}
                            </a>
                          </div>
                          <div className="promise-card__foot">
                            <span>{copy.promiseSource}: {card.promiseSourceLabel}</span>
                            <span>{copy.actionSource}: {card.actionSourceSystem || "—"}</span>
                            <span>{copy.confidence}: {card.statusConfidence}%</span>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <article className="surface promise-card promise-card--empty">
                  <h3>{copy.cardsEmpty}</h3>
                </article>
              )}
            </div>
          </div>
        </section>

        <section className="surface promise-method stripe-flag">
          <div className="two-col" style={{ alignItems: "start" }}>
            <div>
              <p className="eyebrow">{copy.methodologyEyebrow}</p>
              <h2 className="section-title">{copy.methodologyTitle}</h2>
              <p className="section-copy">{copy.methodologyBody}</p>
            </div>
            <div className="promise-method__rules">
              <div className="promise-method__rule"><Sparkles size={16} color="var(--green)" /><span>{copy.methodologyRuleA}</span></div>
              <div className="promise-method__rule"><Radar size={16} color="var(--yellow)" /><span>{copy.methodologyRuleB}</span></div>
              <div className="promise-method__rule"><Landmark size={16} color="var(--red)" /><span>{copy.methodologyRuleC}</span></div>
            </div>
          </div>
          <div className="promise-method__note">{payload?.meta.coverageMode === "pilot" ? copy.footerPilot : copy.methodologyNote}</div>
        </section>
      </main>
    </div>
  );
}
