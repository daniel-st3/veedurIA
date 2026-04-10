"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import type { DepartmentDatum, Lang, OverviewPayload, TableRow } from "@/lib/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });
const CHART_PALETTE = ["#015f65", "#5a9da3", "#b0d4d7", "#7a6a55", "#c8bfaf"];
const RISK_COLORS = {
  high: "#c0392b",
  medium: "#d4800a",
  low: "#27a647",
};
const GRID_COLOR = "rgba(40, 37, 29, 0.08)";
const TOOLTIP_THEME = {
  bgcolor: "#f9f8f5",
  bordercolor: "rgba(40, 37, 29, 0.1)",
  font: { color: "#1e1c17", size: 13, family: "Inter, ui-sans-serif, system-ui, sans-serif" },
} as const;

function truncateLabel(label: string, max = 28) {
  if (label.length <= max) return label;
  return `${label.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function formatMonthTick(month: string, lang: Lang) {
  const date = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return month;
  return new Intl.DateTimeFormat(lang === "es" ? "es-CO" : "en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function groupByMonth(rows: TableRow[]) {
  const buckets = new Map<string, number>();
  rows.forEach((row) => {
    const month = row.date ? row.date.slice(0, 7) : "Sin fecha";
    buckets.set(month, (buckets.get(month) ?? 0) + 1);
  });
  return [...buckets.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([month, count]) => ({ month, count }));
}

function groupByLabel(rows: TableRow[], key: "modality" | "entity") {
  const buckets = new Map<string, { count: number; totalValue: number; peakScore: number }>();
  rows.forEach((row) => {
    const label = key === "modality" ? row.modality : row.entity;
    const current = buckets.get(label) ?? { count: 0, totalValue: 0, peakScore: 0 };
    current.count += 1;
    current.totalValue += row.value;
    current.peakScore = Math.max(current.peakScore, row.score);
    buckets.set(label, current);
  });

  return [...buckets.entries()]
    .map(([label, value]) => ({
      label,
      count: value.count,
      totalValue: value.totalValue,
      peakScore: value.peakScore,
    }))
    .sort((left, right) => right.count - left.count || right.totalValue - left.totalValue);
}

export function ContractsDashboard({
  lang,
  departments,
  rows,
  summaryEntities = [],
  summaryModalities = [],
  onDepartmentPick,
  onMonthPick,
}: {
  lang: Lang;
  departments: DepartmentDatum[];
  rows: TableRow[];
  summaryEntities?: OverviewPayload["summaries"]["entities"];
  summaryModalities?: OverviewPayload["summaries"]["modalities"];
  onDepartmentPick?: (department: string) => void;
  onMonthPick?: (month: string) => void;
}) {
  const timeline = useMemo(() => groupByMonth(rows), [rows]);
  const topDepartments = useMemo(
    () =>
      [...departments]
        .sort((left, right) => right.contractCount - left.contractCount || right.avgRisk - left.avgRisk)
        .slice(0, 8),
    [departments],
  );
  const modalityMix = useMemo(
    () =>
      summaryModalities.length
        ? summaryModalities.slice(0, 6).map((item) => ({
            label: item.modalidad_de_contratacion,
            count: item.contracts,
            meanRisk: item.meanRisk,
          }))
        : groupByLabel(rows, "modality").slice(0, 6).map((item) => ({
            label: item.label,
            count: item.count,
            meanRisk: item.peakScore / 100,
          })),
    [rows, summaryModalities],
  );
  const topEntities = useMemo(
    () =>
      summaryEntities.length
        ? summaryEntities.slice(0, 7).map((item) => ({
            label: item.nombre_entidad,
            count: item.contracts,
            meanRisk: item.meanRisk,
          }))
        : groupByLabel(rows, "entity").slice(0, 7).map((item) => ({
            label: item.label,
            count: item.count,
            meanRisk: item.peakScore / 100,
          })),
    [rows, summaryEntities],
  );

  const territoryData = useMemo(
    () => [
      {
        x: topDepartments.map((item) => item.contractCount).reverse(),
        y: topDepartments.map((item) => truncateLabel(item.label, 24)).reverse(),
        type: "bar",
        orientation: "h",
        customdata: topDepartments.map((item) => [item.label, Math.round(item.avgRisk * 100)]).reverse(),
        marker: {
          color: topDepartments
            .map((item) =>
              item.avgRisk >= 0.7 ? RISK_COLORS.high : item.avgRisk >= 0.4 ? RISK_COLORS.medium : RISK_COLORS.low,
            )
            .reverse(),
          line: { color: "rgba(40, 37, 29, 0.1)", width: 1 },
        },
        text: topDepartments.map((item) => item.contractCount.toLocaleString(lang === "es" ? "es-CO" : "en-US")).reverse(),
        textposition: "outside",
        cliponaxis: false,
        hovertemplate:
          lang === "es"
            ? "<b>%{customdata[0]}</b><br>%{x:,} contratos<br>Intensidad %{customdata[1]}/100<extra></extra>"
            : "<b>%{customdata[0]}</b><br>%{x:,} contracts<br>Intensity %{customdata[1]}/100<extra></extra>",
      },
    ],
    [lang, topDepartments],
  );

  const timelineData = useMemo(
    () => [
      {
        x: timeline.map((item) => item.month),
        y: timeline.map((item) => item.count),
        type: "scatter",
        mode: "lines+markers",
        fill: "tozeroy",
        fillcolor: "rgba(1, 95, 101, 0.16)",
        line: { color: CHART_PALETTE[0], width: 3.2, shape: "spline" },
        marker: { color: "#f9f8f5", size: 8, line: { color: CHART_PALETTE[0], width: 2 } },
        hovertemplate:
          lang === "es"
            ? "<b>%{x}</b><br>%{y} contratos visibles<extra></extra>"
            : "<b>%{x}</b><br>%{y} visible contracts<extra></extra>",
      },
    ],
    [lang, timeline],
  );

  const modalityData = useMemo(
    () => [
      {
        x: modalityMix.map((item) => item.count).reverse(),
        y: modalityMix.map((item) => truncateLabel(item.label, 26)).reverse(),
        type: "bar",
        orientation: "h",
        customdata: modalityMix.map((item) => [item.label, Math.round(item.meanRisk * 100)]).reverse(),
        marker: {
          color: modalityMix.map((item) =>
            item.meanRisk >= 0.7 ? RISK_COLORS.high : item.meanRisk >= 0.4 ? RISK_COLORS.medium : CHART_PALETTE[0],
          ).reverse(),
          line: { color: "rgba(40, 37, 29, 0.08)", width: 1 },
        },
        text: modalityMix.map((item) => item.count.toLocaleString(lang === "es" ? "es-CO" : "en-US")).reverse(),
        textposition: "outside",
        cliponaxis: false,
        hovertemplate:
          lang === "es"
            ? "<b>%{customdata[0]}</b><br>%{x} contratos<br>Riesgo medio %{customdata[1]}/100<extra></extra>"
            : "<b>%{customdata[0]}</b><br>%{x} contracts<br>Average risk %{customdata[1]}/100<extra></extra>",
      },
    ],
    [lang, modalityMix],
  );

  const entityData = useMemo(
    () => [
      {
        x: topEntities.map((item) => item.count).reverse(),
        y: topEntities.map((item) => truncateLabel(item.label, 28)).reverse(),
        type: "bar",
        orientation: "h",
        customdata: topEntities.map((item) => [item.label, Math.round(item.meanRisk * 100)]).reverse(),
        marker: {
          color: topEntities.map((item) =>
            item.meanRisk >= 0.7
              ? RISK_COLORS.high
              : item.meanRisk >= 0.4
                ? RISK_COLORS.medium
                : CHART_PALETTE[0],
          ),
          line: { color: "rgba(40, 37, 29, 0.08)", width: 1 },
        },
        text: topEntities.map((item) => item.count.toLocaleString(lang === "es" ? "es-CO" : "en-US")).reverse(),
        textposition: "outside",
        cliponaxis: false,
        hovertemplate:
          lang === "es"
            ? "<b>%{customdata[0]}</b><br>%{x} contratos<br>Riesgo medio %{customdata[1]}/100<extra></extra>"
            : "<b>%{customdata[0]}</b><br>%{x} contracts<br>Average risk %{customdata[1]}/100<extra></extra>",
      },
    ],
    [lang, topEntities],
  );

  const visibleCount = rows.length;

  const baseLayout = {
    autosize: true,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#1e1c17", family: "Inter, ui-sans-serif, system-ui, sans-serif" },
    hoverlabel: TOOLTIP_THEME,
    margin: { l: 28, r: 22, t: 16, b: 40 },
  } as const;

  return (
    <section className="cv-dashboard surface-soft">
      <div className="cv-block__header cv-dashboard__header">
        <div>
          <p className="eyebrow">{lang === "es" ? "Visualiza el corte" : "Visualize the slice"}</p>
          <h2>{lang === "es" ? "Cuatro lecturas rápidas del corte" : "Four quick reads of the slice"}</h2>
        </div>
        <p>
          {lang === "es"
            ? "Territorio, tiempo, modalidad y entidades con una lectura visual más limpia del corte visible."
            : "Territory, time, modality, and entities in a cleaner visual readout of the visible slice."}
        </p>
      </div>

      <div className="cv-dashboard__grid">
        <article className="cv-dashboard-card">
          <div className="cv-dashboard-card__head">
            <p className="cv-dashboard-card__kicker">{lang === "es" ? "Territorio" : "Territory"}</p>
            <strong>{lang === "es" ? "Departamentos con más volumen visible" : "Departments with the most visible volume"}</strong>
            <span>
              {lang === "es"
                ? "Color por intensidad media y volumen ordenado para detectar dónde conviene empezar."
                : "Colored by average intensity and ordered by volume so you can see where to start."}
            </span>
          </div>
          <div className="cv-dashboard-card__plot">
            <Plot
              data={territoryData as any}
              layout={{
                ...baseLayout,
                margin: { l: 158, r: 56, t: 16, b: 34 },
                xaxis: {
                  title: { text: lang === "es" ? "Contratos visibles" : "Visible contracts", standoff: 8 },
                  gridcolor: GRID_COLOR,
                  zeroline: false,
                  tickfont: { size: 12 },
                  automargin: true,
                },
                yaxis: { tickfont: { size: 12 }, automargin: true },
              }}
              config={{ responsive: true, displaylogo: false, displayModeBar: false }}
              onClick={(event: any) => {
                const label = event.points?.[0]?.y;
                const department = departments.find((item) => truncateLabel(item.label, 24) === label);
                if (department?.geoName) onDepartmentPick?.(department.geoName);
              }}
              style={{ width: "100%", height: 282 }}
            />
          </div>
        </article>

        <article className="cv-dashboard-card">
          <div className="cv-dashboard-card__head">
            <p className="cv-dashboard-card__kicker">{lang === "es" ? "Tiempo" : "Time"}</p>
            <strong>{lang === "es" ? "Ritmo visible por mes" : "Visible monthly pace"}</strong>
            <span>
              {lang === "es"
                ? "Curva de la muestra actual. Haz clic en un mes para volver a ordenar el corte."
                : "Curve of the current sample. Click a month to reorganize the slice."}
            </span>
          </div>
          <div className="cv-dashboard-card__plot">
            <Plot
              data={timelineData as any}
              layout={{
                ...baseLayout,
                margin: { l: 62, r: 24, t: 16, b: 56 },
                yaxis: {
                  title: { text: lang === "es" ? "Contratos" : "Contracts", standoff: 8 },
                  gridcolor: GRID_COLOR,
                  zeroline: false,
                  tickfont: { size: 12 },
                  automargin: true,
                },
                xaxis: {
                  tickvals: timeline.map((item) => item.month),
                  ticktext: timeline.map((item) => formatMonthTick(item.month, lang)),
                  tickfont: { size: 11 },
                  automargin: true,
                },
                hovermode: "x unified",
              }}
              config={{ responsive: true, displaylogo: false, displayModeBar: false }}
              onClick={(event: any) => {
                const month = event.points?.[0]?.x;
                if (month && typeof month === "string") onMonthPick?.(month);
              }}
              style={{ width: "100%", height: 282 }}
            />
          </div>
        </article>

        <article className="cv-dashboard-card">
          <div className="cv-dashboard-card__head">
            <p className="cv-dashboard-card__kicker">{lang === "es" ? "Modalidad" : "Modality"}</p>
            <strong>{lang === "es" ? "Modalidades que dominan el corte" : "Modalities driving the slice"}</strong>
            <span>
              {lang === "es"
                ? "Las barras combinan volumen visible y tono de riesgo medio por modalidad."
                : "Bars combine visible volume and average risk tone per modality."}
            </span>
          </div>
          <div className="cv-dashboard-card__plot">
            <Plot
              data={modalityData as any}
              layout={{
                ...baseLayout,
                margin: { l: 166, r: 54, t: 16, b: 34 },
                xaxis: {
                  title: { text: lang === "es" ? "Contratos visibles" : "Visible contracts", standoff: 8 },
                  gridcolor: GRID_COLOR,
                  zeroline: false,
                  tickfont: { size: 12 },
                  automargin: true,
                },
                yaxis: { tickfont: { size: 12 }, automargin: true },
              }}
              config={{ responsive: true, displaylogo: false, displayModeBar: false }}
              style={{ width: "100%", height: 282 }}
            />
          </div>
        </article>

        <article className="cv-dashboard-card">
          <div className="cv-dashboard-card__head">
            <p className="cv-dashboard-card__kicker">{lang === "es" ? "Entidades" : "Entities"}</p>
            <strong>{lang === "es" ? "Entidades con mayor carga visible" : "Entities carrying the visible load"}</strong>
            <span>
              {lang === "es"
                ? `${visibleCount.toLocaleString("es-CO")} filas visibles en tabla; aquí se resume quién concentra más contratos.`
                : `${visibleCount.toLocaleString("en-US")} visible rows in the table; this summarizes who concentrates the most contracts.`}
            </span>
          </div>
          <div className="cv-dashboard-card__plot">
            <Plot
              data={entityData as any}
              layout={{
                ...baseLayout,
                margin: { l: 188, r: 56, t: 16, b: 34 },
                xaxis: {
                  title: { text: lang === "es" ? "Contratos visibles" : "Visible contracts", standoff: 8 },
                  gridcolor: GRID_COLOR,
                  zeroline: false,
                  tickfont: { size: 12 },
                  automargin: true,
                },
                yaxis: { tickfont: { size: 12 }, automargin: true },
              }}
              config={{ responsive: true, displaylogo: false, displayModeBar: false }}
              style={{ width: "100%", height: 282 }}
            />
          </div>
        </article>
      </div>
    </section>
  );
}
