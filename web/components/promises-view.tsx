"use client";

import { useEffect, useMemo, useState } from "react";

import { ArrowUpRight, BookOpenText, Landmark, ScanSearch } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { fetchPromisesOverview } from "@/lib/api";
import { promisesCopy } from "@/lib/copy";
import type { Lang, PromiseCard, PromisesPayload } from "@/lib/types";

const PARTY_COLORS: Record<string, string> = {
  "gustavo-petro": "#a65a18",
  "francia-marquez": "#0d5bd7",
  "maria-jose-pizarro": "#c62839",
  "paloma-valencia": "#d87a00",
  "katherine-miranda": "#198754",
  "inti-asprilla": "#8b3bb7",
  "david-luna": "#0a4fb6",
  "rodrigo-lara": "#c62839",
};

const WIKIPEDIA_PAGES: Record<string, string> = {
  "gustavo-petro": "Gustavo_Petro",
  "francia-marquez": "Francia_M%C3%A1rquez",
  "maria-jose-pizarro": "Mar%C3%ADa_Jos%C3%A9_Pizarro",
  "paloma-valencia": "Paloma_Valencia",
  "katherine-miranda": "Katherine_Miranda",
  "inti-asprilla": "Inti_Asprilla",
  "david-luna": "David_Luna_S%C3%A1nchez",
  "rodrigo-lara": "Rodrigo_Lara_Restrepo",
};

function getColor(id: string) {
  return PARTY_COLORS[id] ?? "#0d5bd7";
}

function fallbackPortrait(name: string, color: string) {
  const hex = color.replace("#", "");
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${hex}&color=ffffff&size=256&bold=true`;
}

function getStatusMeta(card: PromiseCard, lang: Lang) {
  if (card.status === "con_accion_registrada") {
    return {
      tone: "green",
      label: card.statusLabel,
      summary:
        lang === "es"
          ? "El sistema encontró una acción pública claramente conectada con la promesa."
          : "The system found a public action clearly connected to the promise.",
    };
  }
  if (card.status === "en_seguimiento") {
    return {
      tone: "yellow",
      label: card.statusLabel,
      summary:
        lang === "es"
          ? "Existe movimiento relacionado, pero todavía parcial o insuficiente."
          : "There is related movement, but it is still partial or insufficient.",
    };
  }
  return {
    tone: "muted",
    label: card.statusLabel,
    summary:
      lang === "es"
        ? "No aparece evidencia suficientemente cercana dentro de la cobertura evaluada."
        : "No sufficiently close evidence appears in the evaluated coverage.",
  };
}

function getSemanticReadout(card: PromiseCard, lang: Lang) {
  if (card.status === "con_accion_registrada") {
    return {
      title: lang === "es" ? "Coincidencia alta y trazable" : "High and traceable match",
      body:
        lang === "es"
          ? "La promesa y la acción comparten tema, verbo y objetivo público. Por eso el sistema la marca como evidencia fuerte, sin afirmar cumplimiento jurídico total."
          : "The promise and the action share topic, verb, and public objective. That is why the system marks it as strong evidence without claiming full legal fulfillment.",
    };
  }
  if (card.status === "en_seguimiento") {
    return {
      title: lang === "es" ? "Relación parcial" : "Partial relationship",
      body:
        lang === "es"
          ? "Sí hay una acción relacionada, pero el vínculo sigue siendo incompleto: puede cubrir solo una parte de la promesa o estar todavía en trámite."
          : "There is a related action, but the link remains incomplete: it may cover only part of the promise or still be in progress.",
    };
  }
  return {
    title: lang === "es" ? "Sin evidencia cercana" : "No close evidence",
    body:
      lang === "es"
        ? "La cobertura revisada no encontró una acción pública con suficiente cercanía semántica o documental para sostener el vínculo."
        : "The reviewed coverage did not find a public action with enough semantic or documentary proximity to sustain the link.",
  };
}

export function PromisesView({
  lang,
  initialPayload,
}: {
  lang: Lang;
  initialPayload: PromisesPayload | null;
}) {
  const copy = promisesCopy[lang];
  const defaultId = initialPayload?.scorecard.politicianId ?? initialPayload?.options.politicians[0]?.value;
  const [selectedId, setSelectedId] = useState<string | undefined>(defaultId);
  const [domainFilter, setDomainFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payload, setPayload] = useState<PromisesPayload | null>(initialPayload);
  const [loading, setLoading] = useState(!initialPayload);
  const [openCardId, setOpenCardId] = useState<string | null>(initialPayload?.cards[0]?.id ?? null);
  const [portraits, setPortraits] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(Boolean(initialPayload));

  useEffect(() => {
    if (initialized) {
      setInitialized(false);
      return;
    }

    let alive = true;
    setLoading(true);
    fetchPromisesOverview({
      lang,
      politicianId: selectedId,
      domain: domainFilter,
      status: statusFilter,
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
  }, [selectedId, domainFilter, statusFilter, lang, initialized]);

  const politicians = payload?.options.politicians ?? [];
  const cards = payload?.cards ?? [];
  const scorecard = payload?.scorecard;
  const openCard = cards.find((card) => card.id === openCardId) ?? null;

  useEffect(() => {
    const relevant = politicians.filter((politician) => WIKIPEDIA_PAGES[politician.value]);
    if (!relevant.length) return;

    let cancelled = false;
    Promise.all(
      relevant.map(async (politician) => {
        try {
          const response = await fetch(
            `https://es.wikipedia.org/api/rest_v1/page/summary/${WIKIPEDIA_PAGES[politician.value]}`,
          );
          if (!response.ok) return [politician.value, ""] as const;
          const data = await response.json();
          return [politician.value, data?.thumbnail?.source ?? ""] as const;
        } catch {
          return [politician.value, ""] as const;
        }
      }),
    ).then((rows) => {
      if (cancelled) return;
      setPortraits((current) => {
        const next = { ...current };
        rows.forEach(([id, src]) => {
          if (src) next[id] = src;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [politicians]);

  const selectedPoliticianLabel = useMemo(
    () => politicians.find((item) => item.value === selectedId)?.label ?? "",
    [politicians, selectedId],
  );

  const selectedRole = selectedPoliticianLabel.split(" · ")[1] ?? scorecard?.chamber ?? "";
  const partyColor = getColor(selectedId ?? "");

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

      <main className="page pmr-page">
        <section className="pmr-hero">
          <div>
            <p className="eyebrow">{lang === "es" ? "Promesas 2022 vs acción pública observable" : "2022 promises vs observable public action"}</p>
            <h1>{lang === "es" ? "Promesómetro con criterio, no con humo" : "A promise tracker with judgment, not hype"}</h1>
            <p className="pmr-hero__body">
              {lang === "es"
                ? "El módulo ahora prioriza lectura útil: personas reales, evidencia concreta, fotografía visible y una explicación de NLP que cualquier persona puede entender."
                : "The module now prioritizes useful reading: real people, concrete evidence, visible portraits, and an NLP explanation anyone can understand."}
            </p>
          </div>

          <div className="pmr-hero__stats">
            <article>
              <span>{copy.kpiPoliticians}</span>
              <strong>{payload?.kpis.politiciansTracked ?? 0}</strong>
            </article>
            <article>
              <span>{copy.kpiPromises}</span>
              <strong>{payload?.kpis.promisesTracked ?? 0}</strong>
            </article>
            <article>
              <span>{copy.kpiCoherence}</span>
              <strong>{payload?.kpis.coherenceRate ?? 0}%</strong>
            </article>
          </div>
        </section>

        <section className="pmr-board">
          <div className="pmr-board__top">
            <div className="pmr-board__note">
              <span>{lang === "es" ? "Fuentes" : "Sources"}</span>
              <strong>
                {lang === "es"
                  ? "Programas oficiales, Congreso, decretos y acciones públicas trazables"
                  : "Official programs, Congress, decrees, and traceable public actions"}
              </strong>
              <p>{payload?.meta.pilotNote ?? ""}</p>
            </div>

            <div className="pmr-filter-row">
              <label className="pmr-filter">
                <span>{copy.filterDomain}</span>
                <select value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)}>
                  {(payload?.options.domains ?? []).map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="pmr-filter">
                <span>{copy.filterStatus}</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  {(payload?.options.statuses ?? []).map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="pmr-politician-strip">
            {politicians.map((politician) => {
              const isActive = politician.value === selectedId;
              const name = politician.label.split(" · ")[0] ?? politician.label;
              const portrait = portraits[politician.value] || fallbackPortrait(name, getColor(politician.value));

              return (
                <button
                  key={politician.value}
                  type="button"
                  className={`pmr-politician-card ${isActive ? "pmr-politician-card--active" : ""}`}
                  onClick={() => setSelectedId(politician.value)}
                  style={isActive ? { borderColor: getColor(politician.value) } : undefined}
                >
                  <img src={portrait} alt={name} className="pmr-politician-card__img" />
                  <div>
                    <strong>{name}</strong>
                    <span>{politician.label.split(" · ")[1] ?? ""}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {scorecard ? (
            <section className="pmr-spotlight">
              <div className="pmr-spotlight__person">
                <img
                  src={portraits[scorecard.politicianId] || fallbackPortrait(scorecard.politicianName, partyColor)}
                  alt={scorecard.politicianName}
                  className="pmr-spotlight__img"
                />
                <div>
                  <span className="pmr-spotlight__role">{selectedRole || scorecard.chamber}</span>
                  <h2>{scorecard.politicianName}</h2>
                  <p>{scorecard.party}</p>
                </div>
              </div>

              <div className="pmr-spotlight__score">
                <div className="pmr-spotlight__score-ring" style={{ borderColor: partyColor, color: partyColor }}>
                  {scorecard.overallScore}
                </div>
                <div>
                  <span>{lang === "es" ? "lectura de coherencia" : "coherence read"}</span>
                  <strong>{lang === "es" ? "promesa vs acción observable" : "promise vs observable action"}</strong>
                </div>
              </div>

              <div className="pmr-spotlight__counts">
                <article>
                  <span>{copy.scoreFulfilled}</span>
                  <strong>{scorecard.statusCounts.fulfilled}</strong>
                </article>
                <article>
                  <span>{copy.scoreMonitoring}</span>
                  <strong>{scorecard.statusCounts.monitoring}</strong>
                </article>
                <article>
                  <span>{copy.scoreNoAction}</span>
                  <strong>{scorecard.statusCounts.noAction}</strong>
                </article>
              </div>

              <div className="pmr-domain-bars">
                {scorecard.domains.map((domain) => (
                  <article key={domain.key} className="pmr-domain-bars__item">
                    <div className="pmr-domain-bars__head">
                      <span>{domain.label}</span>
                      <strong>{Math.round(domain.score * 100)}%</strong>
                    </div>
                    <div className="pmr-domain-bars__track">
                      <span style={{ width: `${Math.max(8, domain.score * 100)}%`, background: partyColor }} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="pmr-promise-wall">
            <div className="pmr-promise-wall__header">
              <div>
                <p className="eyebrow">{lang === "es" ? "Promesas rastreadas" : "Tracked promises"}</p>
                <h2>{lang === "es" ? "Haz clic y la lectura de abajo cambia" : "Click a card and the readout below changes"}</h2>
              </div>
              <span>{cards.length} {lang === "es" ? "registros visibles" : "visible records"}</span>
            </div>

            {loading ? (
              <div className="surface-soft" style={{ padding: "2rem", textAlign: "center" }}>{copy.cardsEmpty}</div>
            ) : cards.length === 0 ? (
              <div className="surface-soft" style={{ padding: "2rem", textAlign: "center" }}>{copy.cardsEmpty}</div>
            ) : (
              <div className="pmr-card-grid">
                {cards.map((card) => {
                  const meta = getStatusMeta(card, lang);
                  const isActive = openCardId === card.id;

                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`pmr-promise-card ${isActive ? "pmr-promise-card--active" : ""}`}
                      onClick={() => setOpenCardId(card.id)}
                    >
                      <div className="pmr-promise-card__top">
                        <span className={`pmr-status-dot pmr-status-dot--${meta.tone}`} />
                        <span className={`pmr-status-pill pmr-status-pill--${meta.tone}`}>{meta.label}</span>
                        <strong>{card.similarityScore}%</strong>
                      </div>
                      <h3>{card.promiseText}</h3>
                      <p>{meta.summary}</p>
                      <div className="pmr-promise-card__meta">
                        <span>{card.domainLabel}</span>
                        <span>{card.actionDate || "—"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {openCard ? (
            <section className="pmr-detail">
              <div className="pmr-detail__header">
                <div>
                  <p className="eyebrow">{lang === "es" ? "Lectura detallada" : "Detailed readout"}</p>
                  <h2>{openCard.promiseText}</h2>
                </div>
                <div className="pmr-detail__scorebox">
                  <span>{lang === "es" ? "similitud" : "similarity"}</span>
                  <strong>{openCard.similarityScore}%</strong>
                </div>
              </div>

              <div className="pmr-detail__grid">
                <article className="pmr-detail-card">
                  <div className="pmr-detail-card__label">
                    <BookOpenText size={15} />
                    {lang === "es" ? "Promesa original" : "Original promise"}
                  </div>
                  <strong>{openCard.promiseSourceLabel}</strong>
                  <p>{openCard.promiseText}</p>
                  <a href={openCard.promiseSourceUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                    {copy.verifyPromise} <ArrowUpRight size={14} />
                  </a>
                </article>

                <article className="pmr-detail-card">
                  <div className="pmr-detail-card__label">
                    <Landmark size={15} />
                    {lang === "es" ? "Evidencia encontrada" : "Evidence found"}
                  </div>
                  <strong>{openCard.actionTitle}</strong>
                  <p>{openCard.actionSummary || copy.noEvidence}</p>
                  <a href={openCard.actionSourceUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                    {copy.verifyAction} <ArrowUpRight size={14} />
                  </a>
                </article>

                <article className="pmr-detail-card pmr-detail-card--analysis">
                  <div className="pmr-detail-card__label">
                    <ScanSearch size={15} />
                    {lang === "es" ? "Qué está diciendo el NLP" : "What the NLP is saying"}
                  </div>
                  <strong>{getSemanticReadout(openCard, lang).title}</strong>
                  <p>{getSemanticReadout(openCard, lang).body}</p>
                  <div className="pmr-metric-list">
                    <div>
                      <span>{copy.extraction}</span>
                      <strong>{openCard.extractionConfidence}%</strong>
                    </div>
                    <div>
                      <span>{copy.confidence}</span>
                      <strong>{openCard.statusConfidence}%</strong>
                    </div>
                    <div>
                      <span>{lang === "es" ? "fuente de acción" : "action source"}</span>
                      <strong>{openCard.actionSourceSystem || "—"}</strong>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          ) : null}
        </section>
      </main>
    </div>
  );
}
