"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";

import { Download, Grip, ImageDown, LayoutPanelLeft, MoveRight, Rows3 } from "lucide-react";

import type { Lang, PromiseCard } from "@/lib/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type MetricKey = "count" | "similarity" | "statusConfidence" | "extractionConfidence";
type ChartKey = "bar" | "line" | "area";
type DimensionKey =
  | "politicianName"
  | "domainLabel"
  | "statusLabel"
  | "actionSourceSystem"
  | "actionYear"
  | "none";

type AggregatedRow = {
  x: string;
  series: string;
  count: number;
  similarity: number;
  statusConfidence: number;
  extractionConfidence: number;
};

const DIMENSIONS: Array<{
  key: Exclude<DimensionKey, "none">;
  labelEs: string;
  labelEn: string;
  accessor: (card: PromiseCard) => string;
}> = [
  {
    key: "politicianName",
    labelEs: "Actor público",
    labelEn: "Public actor",
    accessor: (card) => card.politicianName,
  },
  {
    key: "domainLabel",
    labelEs: "Tema",
    labelEn: "Theme",
    accessor: (card) => card.domainLabel,
  },
  {
    key: "statusLabel",
    labelEs: "Estado",
    labelEn: "Status",
    accessor: (card) => card.statusLabel,
  },
  {
    key: "actionSourceSystem",
    labelEs: "Fuente de acción",
    labelEn: "Action source",
    accessor: (card) => card.actionSourceSystem || "Sin fuente",
  },
  {
    key: "actionYear",
    labelEs: "Año visible",
    labelEn: "Visible year",
    accessor: (card) => {
      const match = card.actionDate?.match(/\d{4}/);
      return match?.[0] ?? "Sin fecha";
    },
  },
];

const METRICS: Array<{ key: MetricKey; labelEs: string; labelEn: string; suffix: string }> = [
  { key: "count", labelEs: "Registros", labelEn: "Records", suffix: "" },
  { key: "similarity", labelEs: "Similitud promedio", labelEn: "Average similarity", suffix: "%" },
  { key: "statusConfidence", labelEs: "Confianza promedio", labelEn: "Average confidence", suffix: "%" },
  { key: "extractionConfidence", labelEs: "Extracción promedio", labelEn: "Average extraction", suffix: "%" },
];

const CHARTS: Array<{ key: ChartKey; labelEs: string; labelEn: string }> = [
  { key: "bar", labelEs: "Barras", labelEn: "Bars" },
  { key: "line", labelEs: "Líneas", labelEn: "Lines" },
  { key: "area", labelEs: "Área", labelEn: "Area" },
];

const PALETTE = ["#f3c322", "#1b74ff", "#e24152", "#10b981", "#fb7185", "#8b5cf6", "#22c55e", "#f97316"];

function metricLabel(lang: Lang, key: MetricKey) {
  return METRICS.find((item) => item.key === key)?.[lang === "es" ? "labelEs" : "labelEn"] ?? key;
}

function dimensionLabel(lang: Lang, key: DimensionKey) {
  if (key === "none") return lang === "es" ? "Sin segmentación" : "No split";
  const found = DIMENSIONS.find((item) => item.key === key);
  return found ? found[lang === "es" ? "labelEs" : "labelEn"] : key;
}

function formatMetricValue(value: number, metric: MetricKey, lang: Lang) {
  if (metric === "count") return Math.round(value).toLocaleString(lang === "es" ? "es-CO" : "en-US");
  return `${Math.round(value)}%`;
}

function downloadCsv(rows: AggregatedRow[], lang: Lang) {
  const header =
    lang === "es"
      ? ["eje_x", "serie", "registros", "similitud_promedio", "confianza_promedio", "extraccion_promedio"]
      : ["x_axis", "series", "records", "avg_similarity", "avg_confidence", "avg_extraction"];
  const csv = [
    header.join(","),
    ...rows.map((row) =>
      [row.x, row.series, row.count, row.similarity, row.statusConfidence, row.extractionConfidence]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "veeduria-promesometro-sandbox.csv";
  link.click();
  window.URL.revokeObjectURL(url);
}

export function PromisePivotSandbox({
  lang,
  cards,
}: {
  lang: Lang;
  cards: PromiseCard[];
}) {
  const [xKey, setXKey] = useState<DimensionKey>("domainLabel");
  const [seriesKey, setSeriesKey] = useState<DimensionKey>("statusLabel");
  const [metric, setMetric] = useState<MetricKey>("count");
  const [chart, setChart] = useState<ChartKey>("bar");
  const [topN, setTopN] = useState(8);
  const [draggingKey, setDraggingKey] = useState<DimensionKey | null>(null);

  const groupedRows = useMemo(() => {
    const xAccessor = DIMENSIONS.find((item) => item.key === xKey)?.accessor;
    const seriesAccessor = DIMENSIONS.find((item) => item.key === seriesKey)?.accessor;
    const buckets = new Map<string, AggregatedRow>();

    cards.forEach((card) => {
      const x = xAccessor ? xAccessor(card) : lang === "es" ? "Total" : "Total";
      const series = seriesAccessor ? seriesAccessor(card) : lang === "es" ? "Total" : "Total";
      const bucketKey = `${x}__${series}`;
      const current =
        buckets.get(bucketKey) ??
        {
          x,
          series,
          count: 0,
          similarity: 0,
          statusConfidence: 0,
          extractionConfidence: 0,
        };

      current.count += 1;
      current.similarity += card.similarityScore;
      current.statusConfidence += card.statusConfidence;
      current.extractionConfidence += card.extractionConfidence;
      buckets.set(bucketKey, current);
    });

    return [...buckets.values()]
      .map((row) => ({
        ...row,
        similarity: row.count ? row.similarity / row.count : 0,
        statusConfidence: row.count ? row.statusConfidence / row.count : 0,
        extractionConfidence: row.count ? row.extractionConfidence / row.count : 0,
      }))
      .sort((left, right) => right[metric] - left[metric]);
  }, [cards, lang, metric, seriesKey, xKey]);

  const chartRows = useMemo(() => {
    if (topN === -1) return groupedRows;
    const ranked = new Map<string, number>();
    groupedRows.forEach((row) => {
      ranked.set(row.x, (ranked.get(row.x) ?? 0) + row[metric]);
    });
    const allowed = [...ranked.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, topN)
      .map(([key]) => key);
    return groupedRows.filter((row) => allowed.includes(row.x));
  }, [groupedRows, metric, topN]);

  const traces = useMemo(() => {
    const categories = [...new Set(chartRows.map((row) => row.x))];
    const seriesValues = [...new Set(chartRows.map((row) => row.series))];

    return seriesValues.map((series, index) => {
      const rows = chartRows.filter((row) => row.series === series);
      const values = categories.map((category) => rows.find((row) => row.x === category)?.[metric] ?? 0);

      return {
        type: "scatter",
        mode: chart === "bar" ? undefined : "lines+markers",
        fill: chart === "area" ? "tozeroy" : undefined,
        x: categories,
        y: values,
        name: series,
        marker: { color: PALETTE[index % PALETTE.length], line: { width: 0 } },
        line: { color: PALETTE[index % PALETTE.length], width: 3, shape: "spline" },
      };
    });
  }, [chart, chartRows, metric]);

  const barTraces = useMemo(() => {
    if (chart !== "bar") return traces;
    return traces.map((trace) => ({ ...trace, type: "bar" }));
  }, [chart, traces]);

  const summary = useMemo(() => {
    return {
      visibleRows: chartRows.length,
      actors: new Set(cards.map((card) => card.politicianId)).size,
      domains: new Set(cards.map((card) => card.domain)).size,
    };
  }, [cards, chartRows.length]);

  const dropZone = (
    zoneKey: "x" | "series",
    currentKey: DimensionKey,
    setter: (value: DimensionKey) => void,
    icon: ReactNode,
  ) => (
    <div
      className="pmr-sandbox-dropzone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const key = (event.dataTransfer.getData("text/plain") || draggingKey || "") as DimensionKey;
        if (!key || key === currentKey) return;
        setter(key);
        setDraggingKey(null);
      }}
    >
      <span>{icon}</span>
      <div>
        <small>{zoneKey === "x" ? (lang === "es" ? "Eje X" : "X axis") : lang === "es" ? "Serie" : "Series"}</small>
        <strong>{dimensionLabel(lang, currentKey)}</strong>
      </div>
    </div>
  );

  return (
    <section className="pmr-sandbox surface">
      <div className="pmr-section-header">
        <div>
          <p className="eyebrow">{lang === "es" ? "Sandbox analítico" : "Analytical sandbox"}</p>
          <h2>{lang === "es" ? "Cruza promesas como una tabla dinámica viva" : "Cross promises like a live pivot table"}</h2>
        </div>
        <p>
          {lang === "es"
            ? "Arrastra dimensiones al eje o a la serie, cambia la métrica y exporta la visual desde el botón de imagen del gráfico."
            : "Drag dimensions into the axis or the series, switch the metric, and export the visual from the chart image button."}
        </p>
      </div>

      <div className="pmr-sandbox__deck">
        <div className="pmr-sandbox__controls">
          <div className="pmr-sandbox-toolbar">
            {dropZone("x", xKey, setXKey, <LayoutPanelLeft size={16} />)}
            {dropZone("series", seriesKey, setSeriesKey, <Rows3 size={16} />)}
          </div>

          <div className="pmr-sandbox-chips">
            {DIMENSIONS.map((dimension) => (
              <button
                key={dimension.key}
                type="button"
                className="pmr-sandbox-chip"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", dimension.key);
                  setDraggingKey(dimension.key);
                }}
                onDragEnd={() => setDraggingKey(null)}
                onClick={() => {
                  if (xKey === "none") setXKey(dimension.key);
                  else setSeriesKey(dimension.key);
                }}
              >
                <Grip size={14} />
                {dimension[lang === "es" ? "labelEs" : "labelEn"]}
              </button>
            ))}
            <button type="button" className="pmr-sandbox-chip" onClick={() => setSeriesKey("none")}>
              <MoveRight size={14} />
              {lang === "es" ? "Quitar serie" : "Clear series"}
            </button>
          </div>

          <div className="pmr-sandbox-toolbar">
            <div className="pmr-sandbox-toggle">
              {METRICS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={metric === item.key ? "pmr-sandbox-toggle__button pmr-sandbox-toggle__button--active" : "pmr-sandbox-toggle__button"}
                  onClick={() => setMetric(item.key)}
                >
                  {item[lang === "es" ? "labelEs" : "labelEn"]}
                </button>
              ))}
            </div>

            <div className="pmr-sandbox-toggle">
              {CHARTS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={chart === item.key ? "pmr-sandbox-toggle__button pmr-sandbox-toggle__button--active" : "pmr-sandbox-toggle__button"}
                  onClick={() => setChart(item.key)}
                >
                  {item[lang === "es" ? "labelEs" : "labelEn"]}
                </button>
              ))}
            </div>
          </div>

          <div className="pmr-sandbox-toolbar">
            <label className="pmr-sandbox-select">
              <span>{lang === "es" ? "Top visible" : "Visible top"}</span>
              <select value={topN} onChange={(event) => setTopN(Number(event.target.value))}>
                <option value={8}>Top 8</option>
                <option value={12}>Top 12</option>
                <option value={-1}>{lang === "es" ? "Todos" : "All"}</option>
              </select>
            </label>

            <button type="button" className="btn-secondary" onClick={() => downloadCsv(chartRows, lang)}>
              <Download size={15} />
              {lang === "es" ? "Exportar tabla" : "Export table"}
            </button>
            <span className="pmr-sandbox-exporthint">
              <ImageDown size={15} />
              {lang === "es" ? "La gráfica exporta PNG desde su barra interna." : "The chart exports PNG from its own toolbar."}
            </span>
          </div>
        </div>

        <div className="pmr-sandbox__visual">
          <div className="pmr-sandbox__stats">
            <article>
              <span>{lang === "es" ? "Actores" : "Actors"}</span>
              <strong>{summary.actors}</strong>
            </article>
            <article>
              <span>{lang === "es" ? "Temas" : "Themes"}</span>
              <strong>{summary.domains}</strong>
            </article>
            <article>
              <span>{lang === "es" ? "Filas agregadas" : "Aggregated rows"}</span>
              <strong>{summary.visibleRows}</strong>
            </article>
            <article>
              <span>{lang === "es" ? "Métrica activa" : "Active metric"}</span>
              <strong>{metricLabel(lang, metric)}</strong>
            </article>
          </div>

          <div className="pmr-sandbox-chart">
            <Plot
              data={barTraces as any}
              layout={{
                autosize: true,
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)",
                font: { color: "#d8e2f0", family: "Sora, sans-serif" },
                margin: { l: 40, r: 18, t: 18, b: 48 },
                barmode: seriesKey === "none" ? "group" : "stack",
                showlegend: seriesKey !== "none",
                legend: { orientation: "h", y: -0.22, x: 0 },
                xaxis: {
                  tickfont: { color: "#c8d4e6" },
                  gridcolor: "rgba(120, 139, 165, 0.12)",
                  zerolinecolor: "rgba(120, 139, 165, 0.12)",
                },
                yaxis: {
                  title: metricLabel(lang, metric),
                  tickfont: { color: "#c8d4e6" },
                  gridcolor: "rgba(120, 139, 165, 0.12)",
                  zerolinecolor: "rgba(120, 139, 165, 0.12)",
                },
              }}
              config={{
                responsive: true,
                displaylogo: false,
                modeBarButtonsToRemove: ["lasso2d", "select2d", "toggleSpikelines"],
                toImageButtonOptions: {
                  format: "png",
                  filename: "veeduria-promesometro",
                  scale: 2,
                },
              }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          <div className="pmr-sandbox-table">
            {chartRows.slice(0, 12).map((row) => (
              <article key={`${row.x}-${row.series}`} className="pmr-sandbox-row">
                <div>
                  <strong>{row.x}</strong>
                  <span>{row.series}</span>
                </div>
                <div>
                  <strong>{formatMetricValue(row[metric], metric, lang)}</strong>
                  <span>{row.count} {lang === "es" ? "registros" : "records"}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
