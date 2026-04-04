"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import type { Lang, PromiseCard, PromisesPayload } from "@/lib/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

function statusColor(status: PromiseCard["status"]) {
  if (status === "con_accion_registrada") return "#10B981";
  if (status === "en_seguimiento") return "#F5C518";
  return "#64748B";
}

function buildTimeline(cards: PromiseCard[]) {
  const eligible = cards.filter((card) => card.actionDate && card.actionDate !== "—");
  return eligible
    .map((card) => ({
      x: card.actionDate,
      y: card.similarityScore,
      text: card.promiseText,
      status: card.status,
      domain: card.domainLabel,
      source: card.actionSourceSystem,
    }))
    .sort((left, right) => left.x.localeCompare(right.x));
}

export function PromisesAnalytics({
  lang,
  scorecard,
  cards,
}: {
  lang: Lang;
  scorecard: PromisesPayload["scorecard"];
  cards: PromiseCard[];
}) {
  const domainRadar = useMemo(
    () => ({
      type: "scatterpolar",
      r: scorecard.domains.map((item) => Math.round(item.score * 100)),
      theta: scorecard.domains.map((item) => item.label),
      fill: "toself",
      line: { color: "#2E5BFF", width: 3 },
      marker: { color: "#F5C518", size: 7 },
      fillcolor: "rgba(46, 91, 255, 0.18)",
      hovertemplate:
        lang === "es"
          ? "<b>%{theta}</b><br>%{r}/100 de consistencia<extra></extra>"
          : "<b>%{theta}</b><br>%{r}/100 consistency<extra></extra>",
    }),
    [lang, scorecard.domains],
  );

  const timeline = useMemo(() => buildTimeline(cards), [cards]);
  const timelineData = useMemo(
    () => [
      {
        x: timeline.map((item) => item.x),
        y: timeline.map((item) => item.y),
        type: "scatter",
        mode: "lines+markers",
        line: { color: "#93C5FD", width: 2, shape: "spline" },
        marker: {
          size: 12,
          color: timeline.map((item) => statusColor(item.status)),
          line: { color: "rgba(255,255,255,0.16)", width: 1 },
        },
        customdata: timeline.map((item) => [item.domain, item.source, item.text]),
        hovertemplate:
          lang === "es"
            ? "<b>%{x}</b><br>%{customdata[0]}<br>%{y}% de similitud<br>%{customdata[1]}<extra></extra>"
            : "<b>%{x}</b><br>%{customdata[0]}<br>%{y}% similarity<br>%{customdata[1]}<extra></extra>",
      },
    ],
    [lang, timeline],
  );

  const sourceMix = useMemo(() => {
    const buckets = new Map<string, number>();
    cards.forEach((card) => {
      const key = card.actionSourceSystem || (lang === "es" ? "Sin fuente" : "No source");
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    });
    return [...buckets.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);
  }, [cards, lang]);

  const baseLayout = {
    autosize: true,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#d8e2f0", family: "ui-sans-serif, system-ui, sans-serif" },
  } as const;

  return (
    <section className="pmr-analytics surface">
      <div className="pmr-section-header">
        <div>
          <p className="eyebrow">{lang === "es" ? "Lectura visual" : "Visual readout"}</p>
          <h2>{lang === "es" ? "Tema dominante, tracción y fuentes" : "Dominant themes, traction, and sources"}</h2>
        </div>
        <p>
          {lang === "es"
            ? "El radar muestra dónde se concentra el seguimiento del actor. La línea temporal deja ver cuándo aparece evidencia y desde qué institución."
            : "The radar shows where the actor concentrates their trackable work. The timeline shows when evidence appears and from which institution."}
        </p>
      </div>

      <div className="pmr-analytics__grid">
        <article className="pmr-analytics-card">
          <div className="pmr-analytics-card__head">
            <strong>{lang === "es" ? "Radar temático" : "Theme radar"}</strong>
            <span>{lang === "es" ? "Qué dominios tienen más tracción visible" : "Which domains have the strongest visible traction"}</span>
          </div>
          <div className="pmr-analytics-card__plot">
            <Plot
              data={[domainRadar as any]}
              layout={{
                ...baseLayout,
                margin: { l: 32, r: 32, t: 8, b: 8 },
                polar: {
                  bgcolor: "rgba(0,0,0,0)",
                  radialaxis: { range: [0, 100], gridcolor: "rgba(149, 168, 194, 0.14)" },
                  angularaxis: { gridcolor: "rgba(149, 168, 194, 0.14)" },
                },
                showlegend: false,
              }}
              config={{ responsive: true, displaylogo: false }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </article>

        <article className="pmr-analytics-card">
          <div className="pmr-analytics-card__head">
            <strong>{lang === "es" ? "Línea de evidencia" : "Evidence timeline"}</strong>
            <span>{lang === "es" ? "Cuándo se registran acciones y qué tan cercanas son a la promesa" : "When actions are recorded and how close they are to the promise"}</span>
          </div>
          <div className="pmr-analytics-card__plot">
            <Plot
              data={timelineData as any}
              layout={{
                ...baseLayout,
                margin: { l: 44, r: 18, t: 12, b: 48 },
                xaxis: { gridcolor: "rgba(149, 168, 194, 0.12)", tickangle: -28 },
                yaxis: { range: [0, 100], gridcolor: "rgba(149, 168, 194, 0.12)", title: lang === "es" ? "Similitud" : "Similarity" },
                showlegend: false,
              }}
              config={{ responsive: true, displaylogo: false }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </article>
      </div>

      <div className="pmr-source-band">
        {sourceMix.map((source) => (
          <article key={source.label} className="pmr-source-band__card">
            <span>{source.label}</span>
            <strong>{source.count}</strong>
            <p>{lang === "es" ? "registros visibles" : "visible records"}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
