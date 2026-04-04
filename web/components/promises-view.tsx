"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ArrowUpRight,
  BookOpenText,
  Landmark,
  Quote,
  ScanSearch,
  ShieldCheck,
  Users,
} from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { fetchPromisesOverview } from "@/lib/api";
import { promisesCopy } from "@/lib/copy";
import type { Lang, PromiseCard, PromisesPayload } from "@/lib/types";

type ReferenceCard = {
  id: string;
  name: string;
  role: string;
  period: string;
  party: string;
  promiseQuote: string;
  outcomeQuote: string;
  sourceLabel: string;
  sourceUrl: string;
  outcomeLabel: string;
  outcomeUrl: string;
  note: string;
};

const PARTY_COLORS: Record<string, string> = {
  "gustavo-petro": "#d08b23",
  "francia-marquez": "#16b1ff",
  "maria-jose-pizarro": "#ef476f",
  "paloma-valencia": "#f2b94b",
  "katherine-miranda": "#5de2a5",
  "inti-asprilla": "#7bb6ff",
  "david-luna": "#a3c6ff",
  "rodrigo-lara": "#ff8f70",
  duque_2018: "#e9bd54",
  petro_2018: "#3cb7ff",
  fajardo_2018: "#8fdc7a",
  cepeda_2026: "#ff9f1c",
  valencia_2026: "#6fa8ff",
  lopez_2026: "#78d7c4",
  espriella_2026: "#ff7b7b",
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
  duque_2018: "Iv%C3%A1n_Duque_M%C3%A1rquez",
  petro_2018: "Gustavo_Petro",
  fajardo_2018: "Sergio_Fajardo",
  cepeda_2026: "Iv%C3%A1n_Cepeda_Castro",
  valencia_2026: "Paloma_Valencia",
  lopez_2026: "Claudia_L%C3%B3pez_Hern%C3%A1ndez",
  espriella_2026: "Abelardo_De_La_Espriella",
};

const HISTORICAL_REFERENCES: ReferenceCard[] = [
  {
    id: "duque_2018",
    name: "Iván Duque",
    role: "Presidencia",
    period: "2018-2022",
    party: "Centro Democrático",
    promiseQuote: "“Legalidad, emprendimiento y equidad” como marco para crecimiento, seguridad y reactivación.",
    outcomeQuote: "El ciclo cerró con un PND ejecutado, pero con rezagos visibles en implementación territorial y conflictividad social alta.",
    sourceLabel: "Plan Nacional de Desarrollo 2018-2022",
    sourceUrl: "https://www.dnp.gov.co/Plan-Nacional-de-Desarrollo/Paginas/Plan-Nacional-de-Desarrollo-2018-2022.aspx",
    outcomeLabel: "DNP / cierre del cuatrienio",
    outcomeUrl: "https://www.dnp.gov.co/Plan-Nacional-de-Desarrollo/Paginas/Plan-Nacional-de-Desarrollo-2018-2022.aspx",
    note: "Sirve como referencia histórica para comparar promesa de campaña, plan de gobierno y cierre real del periodo.",
  },
  {
    id: "petro_2018",
    name: "Gustavo Petro",
    role: "Presidencia",
    period: "2018-2022",
    party: "Colombia Humana",
    promiseQuote: "“Transición energética y cambio del modelo productivo” como eje de campaña presidencial.",
    outcomeQuote: "La promesa quedó en fase programática y se volvió útil como antecedente para comparar con el gobierno iniciado en 2022.",
    sourceLabel: "Programa presidencial 2018",
    sourceUrl: "https://gustavopetro.co/",
    outcomeLabel: "Comparativo con agenda 2022-2026",
    outcomeUrl: "https://gustavopetro.co/",
    note: "En este ciclo funciona como línea base para medir continuidad entre oposición, campaña y gobierno posterior.",
  },
  {
    id: "fajardo_2018",
    name: "Sergio Fajardo",
    role: "Presidencia",
    period: "2018-2022",
    party: "Centro",
    promiseQuote: "“Educación primero” y gestión pública con foco técnico y territorial.",
    outcomeQuote: "Quedó como referencia programática y permite contrastar cómo envejecen las promesas cuando no pasan a gobierno.",
    sourceLabel: "Propuestas presidenciales 2018",
    sourceUrl: "https://sergiofajardo.co/",
    outcomeLabel: "Seguimiento comparativo",
    outcomeUrl: "https://sergiofajardo.co/",
    note: "Es útil para leer promesas no ejecutadas, promesas retomadas por otros actores y continuidad temática en 2022.",
  },
];

const LEGISLATIVE_SPOTLIGHTS: ReferenceCard[] = [
  {
    id: "katherine-miranda",
    name: "Katherine Miranda",
    role: "Cámara",
    period: "2022-2026",
    party: "Alianza Verde",
    promiseQuote: "“Más transparencia contractual y mejor control político sobre compras públicas.”",
    outcomeQuote: "Su actividad pública visible se concentra en debates de control y proyectos sobre trazabilidad contractual.",
    sourceLabel: "Cámara de Representantes",
    sourceUrl: "https://www.camara.gov.co/",
    outcomeLabel: "Actividad legislativa visible",
    outcomeUrl: "https://www.camara.gov.co/",
    note: "Perfil útil para leer promesas anticorrupción y control político con foco contractual.",
  },
  {
    id: "maria-jose-pizarro",
    name: "María José Pizarro",
    role: "Senado",
    period: "2022-2026",
    party: "Pacto Histórico",
    promiseQuote: "“Paz, garantías democráticas y reformas sociales con seguimiento legislativo.”",
    outcomeQuote: "La evidencia visible se concentra en debates, ponencias y posicionamiento de proyectos en el Senado.",
    sourceLabel: "Senado de la República",
    sourceUrl: "https://www.senado.gov.co/",
    outcomeLabel: "Actividad legislativa visible",
    outcomeUrl: "https://www.senado.gov.co/",
    note: "Ayuda a contrastar promesa programática con acción legislativa, no solo con ejecución gubernamental.",
  },
  {
    id: "david-luna",
    name: "David Luna",
    role: "Senado",
    period: "2022-2026",
    party: "Cambio Radical",
    promiseQuote: "“Control político fuerte, enfoque digital y vigilancia al gasto público.”",
    outcomeQuote: "El seguimiento visible muestra control político, debate público y oposición documentada frente a reformas clave.",
    sourceLabel: "Senado de la República",
    sourceUrl: "https://www.senado.gov.co/",
    outcomeLabel: "Actividad legislativa visible",
    outcomeUrl: "https://www.senado.gov.co/",
    note: "Sirve para leer cómo se traducen promesas de oposición en acción parlamentaria verificable.",
  },
];

const RADAR_2026: ReferenceCard[] = [
  {
    id: "cepeda_2026",
    name: "Iván Cepeda",
    role: "Presidencia",
    period: "2026",
    party: "Pacto Histórico",
    promiseQuote: "Promesas en observación sobre paz, reforma institucional y continuidad de agenda social.",
    outcomeQuote: "Todavía no hay gestión ejecutiva que medir para este ciclo; aquí solo se documenta promesa, fuente y lenguaje programático.",
    sourceLabel: "Perfil público / lanzamiento 2026",
    sourceUrl: "https://www.senado.gov.co/index.php/el-senado/senadores/280-ivan-cepeda-castro",
    outcomeLabel: "Ciclo aún sin ejecución",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "Radar presidencial 2026: el valor hoy está en leer promesas tempranas y cómo se diferencian antes de la elección.",
  },
  {
    id: "valencia_2026",
    name: "Paloma Valencia",
    role: "Presidencia",
    period: "2026",
    party: "Centro Democrático",
    promiseQuote: "Promesas en observación sobre seguridad, crecimiento y oposición a reformas estructurales del actual gobierno.",
    outcomeQuote: "En 2026 todavía corresponde leer propuestas, discursos y consistencia programática; no hay ejecución gubernamental que comparar.",
    sourceLabel: "Perfil público / aspiración 2026",
    sourceUrl: "https://www.senado.gov.co/index.php/el-senado/senadores/355-paloma-susana-valencia-laserna",
    outcomeLabel: "Ciclo aún sin ejecución",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "El radar 2026 separa promesa pura de evidencia de gobierno para no mezclar campaña con gestión.",
  },
  {
    id: "lopez_2026",
    name: "Claudia López",
    role: "Presidencia",
    period: "2026",
    party: "Por firmas",
    promiseQuote: "Promesas en observación sobre seguridad urbana, gerencia pública y reactivación económica con foco local.",
    outcomeQuote: "La comparación todavía es programática: el módulo muestra fuente, lenguaje y temas dominantes, no cumplimiento.",
    sourceLabel: "Sitio público / candidatura 2026",
    sourceUrl: "https://claudialopez.com/",
    outcomeLabel: "Ciclo aún sin ejecución",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "El objetivo aquí es ver qué promete cada candidatura antes de que exista acción pública que medir.",
  },
  {
    id: "espriella_2026",
    name: "Abelardo de la Espriella",
    role: "Presidencia",
    period: "2026",
    party: "Por firmas",
    promiseQuote: "Promesas en observación sobre seguridad, justicia y endurecimiento institucional.",
    outcomeQuote: "No hay resultado que comparar todavía: el tablero los muestra solo como promesas tempranas verificables en fuente pública.",
    sourceLabel: "Sitio público / aspiración 2026",
    sourceUrl: "https://abelardodelaespriella.com/",
    outcomeLabel: "Ciclo aún sin ejecución",
    outcomeUrl: "https://www.registraduria.gov.co/",
    note: "Promesa 2026 significa lenguaje de campaña. El cumplimiento empieza a medirse después de la elección y el acceso al cargo.",
  },
];

const SOURCE_MATRIX = {
  es: [
    { label: "Promesas", detail: "Programas de gobierno, páginas públicas y documentos de campaña." },
    { label: "Acción pública", detail: "Senado, Cámara, gacetas, ministerios, decretos y registros oficiales." },
    { label: "Radar 2026", detail: "Perfiles públicos, lanzamientos y fuentes abiertas en etapa preelectoral." },
  ],
  en: [
    { label: "Promises", detail: "Government plans, public campaign pages, and source documents." },
    { label: "Public action", detail: "Senate, House, gazettes, ministries, decrees, and official registries." },
    { label: "2026 radar", detail: "Public profiles, launches, and open sources in the pre-electoral phase." },
  ],
};

function getColor(id: string) {
  return PARTY_COLORS[id] ?? "#f0c351";
}

function fallbackPortrait(name: string, color: string) {
  const hex = color.replace("#", "");
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${hex}&color=06111f&size=512&bold=true`;
}

function getStatusMeta(card: PromiseCard, lang: Lang) {
  if (card.status === "con_accion_registrada") {
    return {
      tone: "green",
      label: card.statusLabel,
      summary:
        lang === "es"
          ? "Hay una acción pública claramente conectada con esta promesa."
          : "There is a public action clearly connected with this promise.",
    };
  }
  if (card.status === "en_seguimiento") {
    return {
      tone: "yellow",
      label: card.statusLabel,
      summary:
        lang === "es"
          ? "Existe movimiento relacionado, pero todavía parcial o incompleto."
          : "There is related movement, but it remains partial or incomplete.",
    };
  }
  return {
    tone: "muted",
    label: card.statusLabel,
    summary:
      lang === "es"
        ? "No aparece evidencia suficiente dentro de la cobertura visible."
        : "No sufficient evidence appears inside the visible coverage.",
  };
}

function getSemanticReadout(card: PromiseCard, lang: Lang) {
  if (card.status === "con_accion_registrada") {
    return {
      title: lang === "es" ? "Coincidencia alta" : "High match",
      body:
        lang === "es"
          ? "La promesa y la acción pública comparten tema, verbo y objetivo. Por eso la coincidencia sube y el caso se marca como evidencia fuerte."
          : "The promise and the public action share topic, verb, and objective. That is why the match rises and the case is marked as strong evidence.",
    };
  }
  if (card.status === "en_seguimiento") {
    return {
      title: lang === "es" ? "Coincidencia parcial" : "Partial match",
      body:
        lang === "es"
          ? "Se encontró una acción relacionada, pero todavía cubre solo una parte de la promesa o sigue en trámite."
          : "A related action was found, but it still covers only part of the promise or remains in progress.",
    };
  }
  return {
    title: lang === "es" ? "Sin evidencia cercana" : "No close evidence",
    body:
      lang === "es"
        ? "La cobertura actual no encontró una acción pública suficientemente parecida para sostener el vínculo."
        : "The current coverage did not find a sufficiently similar public action to sustain the link.",
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
  const portraitTargets = useMemo(
    () => [
      ...politicians.map((politician) => {
        const name = politician.label.split(" · ")[0] ?? politician.label;
        return { id: politician.value, name };
      }),
      ...HISTORICAL_REFERENCES.map((item) => ({ id: item.id, name: item.name })),
      ...RADAR_2026.map((item) => ({ id: item.id, name: item.name })),
    ],
    [politicians],
  );

  useEffect(() => {
    const relevant = portraitTargets.filter((item) => WIKIPEDIA_PAGES[item.id]);
    if (!relevant.length) return;

    let cancelled = false;
    Promise.all(
      relevant.map(async (item) => {
        try {
          const response = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${WIKIPEDIA_PAGES[item.id]}`);
          if (!response.ok) return [item.id, ""] as const;
          const data = await response.json();
          return [item.id, data?.thumbnail?.source ?? ""] as const;
        } catch {
          return [item.id, ""] as const;
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
  }, [portraitTargets]);

  const selectedPoliticianLabel = useMemo(
    () => politicians.find((item) => item.value === selectedId)?.label ?? "",
    [politicians, selectedId],
  );

  const selectedRole = selectedPoliticianLabel.split(" · ")[1] ?? scorecard?.chamber ?? "";
  const partyColor = getColor(selectedId ?? "");
  const trackedPortrait = scorecard
    ? portraits[scorecard.politicianId] || fallbackPortrait(scorecard.politicianName, partyColor)
    : fallbackPortrait("VeedurIA", "#f0c351");

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
          <div className="pmr-hero__copy">
            <p className="eyebrow">{lang === "es" ? "Promesas, evidencia y comparación por ciclo político" : "Promises, evidence, and comparison by political cycle"}</p>
            <h1>{lang === "es" ? "Promesómetro con más contexto y menos ruido" : "A promise tracker with more context and less noise"}</h1>
            <p className="pmr-hero__body">
              {lang === "es"
                ? "El tablero separa tres lecturas: seguimiento detallado 2022-2026, referencias del ciclo 2018-2022 y radar presidencial 2026, donde todavía solo existen promesas."
                : "The board separates three reads: detailed 2022-2026 tracking, 2018-2022 historical references, and the 2026 presidential radar, where only promises exist so far."}
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
            <article>
              <span>{lang === "es" ? "Radar visible" : "Visible radar"}</span>
              <strong>{HISTORICAL_REFERENCES.length + RADAR_2026.length + politicians.length}</strong>
            </article>
          </div>
        </section>

        <section className="pmr-board">
          <div className="pmr-board__top">
            <div className="pmr-board__note">
              <span>{lang === "es" ? "Cobertura principal" : "Main coverage"}</span>
              <strong>{lang === "es" ? "Seguimiento 2022-2026" : "2022-2026 tracking"}</strong>
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
              const role = politician.label.split(" · ")[1] ?? "";
              const portrait = portraits[politician.value] || fallbackPortrait(name, getColor(politician.value));

              return (
                <button
                  key={politician.value}
                  type="button"
                  className={`pmr-politician-card ${isActive ? "pmr-politician-card--active" : ""}`}
                  onClick={() => setSelectedId(politician.value)}
                  style={isActive ? { borderColor: getColor(politician.value) } : undefined}
                >
                  <div className="pmr-politician-card__media">
                    <img src={portrait} alt={name} className="pmr-politician-card__img" />
                    <span className="pmr-politician-card__glow" style={{ background: `linear-gradient(135deg, ${getColor(politician.value)}, transparent)` }} />
                  </div>
                  <div>
                    <strong>{name}</strong>
                    <span>{role}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {scorecard ? (
            <section className="pmr-spotlight">
              <div className="pmr-spotlight__media">
                <img src={trackedPortrait} alt={scorecard.politicianName} className="pmr-spotlight__img" />
                <div className="pmr-spotlight__overlay" />
              </div>

              <div className="pmr-spotlight__content">
                <div className="pmr-spotlight__person">
                  <div>
                    <span className="pmr-spotlight__role">{selectedRole || scorecard.chamber}</span>
                    <h2>{scorecard.politicianName}</h2>
                    <p>{scorecard.party}</p>
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
              </div>
            </section>
          ) : null}

          <section className="pmr-promise-wall">
            <div className="pmr-promise-wall__header">
              <div>
                <p className="eyebrow">{lang === "es" ? "Promesas rastreadas" : "Tracked promises"}</p>
                <h2>{lang === "es" ? "Promesa, evidencia y lectura comparada" : "Promise, evidence, and compared reading"}</h2>
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

              <div className="pmr-quote-grid">
                <article className="pmr-quote-card">
                  <div className="pmr-detail-card__label">
                    <Quote size={15} />
                    {lang === "es" ? "Lo prometido" : "What was promised"}
                  </div>
                  <p>“{openCard.promiseText}”</p>
                </article>
                <article className="pmr-quote-card">
                  <div className="pmr-detail-card__label">
                    <Quote size={15} />
                    {lang === "es" ? "Lo observado" : "What was observed"}
                  </div>
                  <p>“{openCard.actionSummary || copy.noEvidence}”</p>
                </article>
              </div>

              <div className="pmr-detail__grid">
                <article className="pmr-detail-card">
                  <div className="pmr-detail-card__label">
                    <BookOpenText size={15} />
                    {lang === "es" ? "Fuente de la promesa" : "Promise source"}
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
                    {lang === "es" ? "Fuente de la acción" : "Action source"}
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
                    {lang === "es" ? "Cómo se enlaza" : "How the link is built"}
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

        <section className="pmr-reference-section surface-soft">
          <div className="pmr-section-header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Perfiles legislativos 2022-2026" : "2022-2026 legislative profiles"}</p>
              <h2>{lang === "es" ? "Senado y Cámara en la lectura principal" : "Senate and House in the main read"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "Además del Ejecutivo, el tablero deja visibles perfiles legislativos con promesas, control político y huella pública rastreable."
                : "Beyond the executive branch, the board keeps visible legislative profiles with promises, oversight, and traceable public footprint."}
            </p>
          </div>

          <div className="pmr-reference-grid">
            {LEGISLATIVE_SPOTLIGHTS.map((item) => {
              const portrait = portraits[item.id] || fallbackPortrait(item.name, getColor(item.id));
              return (
                <article key={item.id} className="pmr-reference-card">
                  <div className="pmr-reference-card__media">
                    <img src={portrait} alt={item.name} />
                    <span style={{ background: `linear-gradient(180deg, transparent, ${getColor(item.id)})` }} />
                  </div>
                  <div className="pmr-reference-card__body">
                    <small>{item.period} · {item.role}</small>
                    <strong>{item.name}</strong>
                    <p>{item.promiseQuote}</p>
                    <p>{item.outcomeQuote}</p>
                    <div className="pmr-reference-card__links">
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceLabel}</a>
                      <a href={item.outcomeUrl} target="_blank" rel="noreferrer">{item.outcomeLabel}</a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="pmr-reference-section surface-soft">
          <div className="pmr-section-header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Comparativos 2018-2022" : "2018-2022 comparisons"}</p>
              <h2>{lang === "es" ? "Referencias históricas para leer el siguiente ciclo" : "Historical references to read the next cycle"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "Estas tarjetas no miden cumplimiento en tiempo real: ayudan a contrastar cómo envejece una promesa cuando cambia el ciclo político."
                : "These cards do not measure real-time compliance: they help contrast how a promise ages as the political cycle changes."}
            </p>
          </div>

          <div className="pmr-reference-grid">
            {HISTORICAL_REFERENCES.map((item) => {
              const portrait = portraits[item.id] || fallbackPortrait(item.name, getColor(item.id));
              return (
                <article key={item.id} className="pmr-reference-card">
                  <div className="pmr-reference-card__media">
                    <img src={portrait} alt={item.name} />
                    <span style={{ background: `linear-gradient(180deg, transparent, ${getColor(item.id)})` }} />
                  </div>
                  <div className="pmr-reference-card__body">
                    <small>{item.period} · {item.role}</small>
                    <strong>{item.name}</strong>
                    <p>{item.promiseQuote}</p>
                    <p>{item.outcomeQuote}</p>
                    <div className="pmr-reference-card__links">
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceLabel}</a>
                      <a href={item.outcomeUrl} target="_blank" rel="noreferrer">{item.outcomeLabel}</a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="pmr-reference-section pmr-reference-section--dark surface">
          <div className="pmr-section-header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Radar presidencial 2026" : "2026 presidential radar"}</p>
              <h2>{lang === "es" ? "Promesas tempranas, todavía sin ejecución" : "Early promises, still without execution"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "Aquí no se mezcla campaña con cumplimiento. Por ahora solo importa la fuente, el lenguaje de la promesa y el tema dominante."
                : "Campaign and compliance are not mixed here. For now, only the source, the promise language, and the dominant theme matter."}
            </p>
          </div>

          <div className="pmr-reference-grid pmr-reference-grid--radar">
            {RADAR_2026.map((item) => {
              const portrait = portraits[item.id] || fallbackPortrait(item.name, getColor(item.id));
              return (
                <article key={item.id} className="pmr-reference-card pmr-reference-card--radar">
                  <div className="pmr-reference-card__media">
                    <img src={portrait} alt={item.name} />
                    <span style={{ background: `linear-gradient(180deg, transparent, ${getColor(item.id)})` }} />
                  </div>
                  <div className="pmr-reference-card__body">
                    <small>{item.period} · {item.role}</small>
                    <strong>{item.name}</strong>
                    <p>{item.promiseQuote}</p>
                    <p>{item.note}</p>
                    <div className="pmr-reference-card__links">
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceLabel}</a>
                      <a href={item.outcomeUrl} target="_blank" rel="noreferrer">{item.outcomeLabel}</a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="pmr-reference-section surface-soft">
          <div className="pmr-section-header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Fuentes del módulo" : "Module sources"}</p>
              <h2>{lang === "es" ? "De dónde sale la información" : "Where the information comes from"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "Cada bloque usa una fuente distinta según el tipo de evidencia: promesa, acción pública o radar de campaña."
                : "Each block uses a different source depending on the evidence type: promise, public action, or campaign radar."}
            </p>
          </div>

          <div className="pmr-source-grid">
            {SOURCE_MATRIX[lang].map((item) => (
              <article key={item.label} className="pmr-source-card">
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pmr-reference-section surface">
          <div className="pmr-section-header">
            <div>
              <p className="eyebrow">{lang === "es" ? "Cómo se lee el matching" : "How to read the matching"}</p>
              <h2>{lang === "es" ? "Explicación formal, sin jerga inútil" : "Formal explanation, without useless jargon"}</h2>
            </div>
            <p>
              {lang === "es"
                ? "El sistema no decide si una promesa se cumplió jurídicamente. Lo que hace es medir cercanía entre promesa y acción pública usando tres preguntas simples."
                : "The system does not decide whether a promise was legally fulfilled. It measures closeness between a promise and a public action using three simple questions."}
            </p>
          </div>

          <div className="pmr-method-grid">
            <article className="pmr-method-card">
              <ShieldCheck size={18} />
              <strong>{lang === "es" ? "¿Hablan del mismo tema?" : "Do they speak about the same topic?"}</strong>
              <p>{lang === "es" ? "Salud, seguridad, educación, transición energética, contratación o reforma institucional." : "Health, security, education, energy transition, procurement, or institutional reform."}</p>
            </article>
            <article className="pmr-method-card">
              <Users size={18} />
              <strong>{lang === "es" ? "¿Apuntan al mismo objetivo?" : "Do they aim at the same objective?"}</strong>
              <p>{lang === "es" ? "No basta compartir una palabra. La acción debe empujar el mismo objetivo público de la promesa." : "Sharing a word is not enough. The action must push the same public objective as the promise."}</p>
            </article>
            <article className="pmr-method-card">
              <ScanSearch size={18} />
              <strong>{lang === "es" ? "¿Qué tan fuerte es la evidencia?" : "How strong is the evidence?"}</strong>
              <p>{lang === "es" ? "Una ley aprobada pesa más que un debate; un debate pesa más que una mención aislada." : "An approved law weighs more than a debate; a debate weighs more than an isolated mention."}</p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
