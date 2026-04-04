"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import type { DepartmentDatum, Lang, TableRow } from "@/lib/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

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
  onDepartmentPick,
  onMonthPick,
}: {
  lang: Lang;
  departments: DepartmentDatum[];
  rows: TableRow[];
  onDepartmentPick?: (department: string) => void;
  onMonthPick?: (month: string) => void;
}) {
  const timeline = useMemo(() => groupByMonth(rows), [rows]);
  const modalityMix = useMemo(() => groupByLabel(rows, "modality").slice(0, 6), [rows]);
  const topEntities = useMemo(() => groupByLabel(rows, "entity").slice(0, 8), [rows]);

  const treemapData = useMemo(
    () => ({
      labels: departments.map((item) => item.label),
      parents: departments.map(() => ""),
      values: departments.map((item) => item.contractCount),
      ids: departments.map((item) => item.geoName),
      customdata: departments.map((item) => [Math.round(item.avgRisk * 100), item.contractCount]),
      marker: {
        colors: departments.map((item) =>
          item.avgRisk >= 0.7 ? "#E63946" : item.avgRisk >= 0.4 ? "#F5C518" : "#2E5BFF",
        ),
        line: { color: "rgba(255,255,255,0.22)", width: 1.2 },
      },
      texttemplate: "%{label}<br>%{value:,}",
      hovertemplate:
        lang === "es"
          ? "<b>%{label}</b><br>%{value:,} contratos<br>Intensidad %{customdata[0]}/100<extra></extra>"
          : "<b>%{label}</b><br>%{value:,} contracts<br>Intensity %{customdata[0]}/100<extra></extra>",
      type: "treemap",
      pathbar: { visible: false },
      tiling: { pad: 4 },
    }),
    [departments, lang],
  );

  const timelineData = useMemo(
    () => [
      {
        x: timeline.map((item) => item.month),
        y: timeline.map((item) => item.count),
        type: "scatter",
        mode: "lines+markers",
        fill: "tozeroy",
        line: { color: "#2E5BFF", width: 3, shape: "spline" },
        marker: { color: "#F5C518", size: 8 },
        hovertemplate:
          lang === "es"
            ? "<b>%{x}</b><br>%{y} contratos visibles<extra></extra>"
            : "<b>%{x}</b><br>%{y} visible contracts<extra></extra>",
      },
    ],
    [lang, timeline],
  );

  const donutData = useMemo(
    () => [
      {
        labels: modalityMix.map((item) => item.label),
        values: modalityMix.map((item) => item.count),
        type: "pie",
        hole: 0.62,
        marker: {
          colors: ["#F5C518", "#2E5BFF", "#E63946", "#10B981", "#F97316", "#8B5CF6"],
        },
        textinfo: "label+percent",
        hovertemplate:
          lang === "es"
            ? "<b>%{label}</b><br>%{value} contratos<extra></extra>"
            : "<b>%{label}</b><br>%{value} contracts<extra></extra>",
      },
    ],
    [lang, modalityMix],
  );

  const entityData = useMemo(
    () => [
      {
        x: topEntities.map((item) => item.count).reverse(),
        y: topEntities.map((item) => item.label).reverse(),
        type: "bar",
        orientation: "h",
        marker: {
          color: topEntities.map((item) =>
            item.peakScore >= 80 ? "#E63946" : item.peakScore >= 55 ? "#F5C518" : "#2E5BFF",
          ),
        },
        hovertemplate:
          lang === "es"
            ? "<b>%{y}</b><br>%{x} contratos<extra></extra>"
            : "<b>%{y}</b><br>%{x} contracts<extra></extra>",
      },
    ],
    [lang, topEntities],
  );

  const baseLayout = {
    autosize: true,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#d7deeb", family: "ui-sans-serif, system-ui, sans-serif" },
    margin: { l: 28, r: 16, t: 16, b: 38 },
  } as const;

  return (
    <section className="cv-dashboard surface-soft">
      <div className="cv-block__header">
        <div>
          <p className="eyebrow">{lang === "es" ? "Visualiza el corte" : "Visualize the slice"}</p>
          <h2>{lang === "es" ? "Territorio, ritmo y concentración" : "Territory, pace, and concentration"}</h2>
        </div>
        <p>
          {lang === "es"
            ? "Haz clic en un departamento del treemap o en un mes de la curva para reordenar el corte visible."
            : "Click a department in the treemap or a month in the curve to reorganize the visible slice."}
        </p>
      </div>

      <div className="cv-dashboard__grid">
        <article className="cv-dashboard-card">
          <div className="cv-dashboard-card__head">
            <strong>{lang === "es" ? "Mapa compacto del país" : "Compact country map"}</strong>
            <span>{lang === "es" ? "Tamaño = contratos · color = intensidad" : "Size = contracts · color = intensity"}</span>
          </div>
          <div className="cv-dashboard-card__plot">
            <Plot
              data={[treemapData as any]}
              layout={{ ...baseLayout, margin: { l: 10, r: 10, t: 10, b: 10 } }}
              config={{ responsive: true, displaylogo: false }}
              onClick={(event: any) => {
                const department = event.points?.[0]?.id;
                if (department && typeof department === "string") onDepartmentPick?.(department);
              }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </article>

        <article className="cv-dashboard-card">
          <div className="cv-dashboard-card__head">
            <strong>{lang === "es" ? "Ritmo de firmas" : "Signing pace"}</strong>
            <span>{lang === "es" ? "Pulsa un mes para filtrar por fecha" : "Tap a month to filter by date"}</span>
          </div>
          <div className="cv-dashboard-card__plot">
            <Plot
              data={timelineData as any}
              layout={{
                ...baseLayout,
                yaxis: { gridcolor: "rgba(138, 154, 179, 0.12)", zeroline: false },
                xaxis: { tickangle: -35 },
              }}
              config={{ responsive: true, displaylogo: false }}
              onClick={(event: any) => {
                const month = event.points?.[0]?.x;
                if (month && typeof month === "string") onMonthPick?.(month);
              }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </article>

        <article className="cv-dashboard-card">
          <div className="cv-dashboard-card__head">
            <strong>{lang === "es" ? "Modalidades del corte" : "Slice modalities"}</strong>
            <span>{lang === "es" ? "Composición del corte visible" : "Composition of the visible slice"}</span>
          </div>
          <div className="cv-dashboard-card__plot">
            <Plot
              data={donutData as any}
              layout={{ ...baseLayout, margin: { l: 20, r: 20, t: 10, b: 10 }, showlegend: false }}
              config={{ responsive: true, displaylogo: false }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </article>

        <article className="cv-dashboard-card">
          <div className="cv-dashboard-card__head">
            <strong>{lang === "es" ? "Entidades que más pesan" : "Entities carrying the slice"}</strong>
            <span>{lang === "es" ? "Ordenadas por número de contratos visibles" : "Ordered by visible contract count"}</span>
          </div>
          <div className="cv-dashboard-card__plot">
            <Plot
              data={entityData as any}
              layout={{
                ...baseLayout,
                margin: { l: 170, r: 16, t: 12, b: 24 },
                xaxis: { gridcolor: "rgba(138, 154, 179, 0.12)", zeroline: false },
              }}
              config={{ responsive: true, displaylogo: false }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </article>
      </div>
    </section>
  );
}
