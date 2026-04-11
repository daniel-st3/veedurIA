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

/** Normalize a modality/entity label for deduplication (case + accent insensitive) */
function normalizeLabel(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function groupByLabel(rows: TableRow[], key: "modality" | "entity") {
  // Use a normalized key for bucketing so case/accent variants are merged.
  // Keep the first-seen display label for each bucket.
  const displayLabel = new Map<string, string>();
  const buckets = new Map<string, { count: number; totalValue: number; peakScore: number }>();
  rows.forEach((row) => {
    const raw = key === "modality" ? row.modality : row.entity;
    const norm = normalizeLabel(raw ?? "Sin dato");
    if (!displayLabel.has(norm)) displayLabel.set(norm, raw ?? "Sin dato");
    const current = buckets.get(norm) ?? { count: 0, totalValue: 0, peakScore: 0 };
    current.count += 1;
    current.totalValue += row.value;
    current.peakScore = Math.max(current.peakScore, row.score);
    buckets.set(norm, current);
  });

  return [...buckets.entries()]
    .map(([norm, value]) => ({
      label: displayLabel.get(norm) ?? norm,
      count: value.count,
      totalValue: value.totalValue,
      peakScore: value.peakScore,
    }))
    .sort((left, right) => right.count - left.count || right.totalValue - left.totalValue);
}

function riskBandLabel(lang: Lang, band: "high" | "medium" | "low") {
  if (band === "high") return lang === "es" ? "Alto" : "High";
  if (band === "medium") return lang === "es" ? "Medio" : "Medium";
  return lang === "es" ? "Bajo" : "Low";
}

export function ContractsDashboard({
  lang,
  departments,
  rows,
  summaryEntities = [],
  summaryModalities = [],
  analytics,
  activeDepartmentLabel,
  onDepartmentPick,
  onMonthPick,
}: {
  lang: Lang;
  departments: DepartmentDatum[];
  rows: TableRow[];
  summaryEntities?: OverviewPayload["summaries"]["entities"];
  summaryModalities?: OverviewPayload["summaries"]["modalities"];
  analytics?: OverviewPayload["analytics"];
  activeDepartmentLabel?: string | null;
  onDepartmentPick?: (department: string) => void;
  onMonthPick?: (month: string) => void;
}) {
  const timeline = useMemo(
    () =>
      analytics?.months?.length
        ? analytics.months.map((item) => ({ month: item.month, count: item.contracts }))
        : groupByMonth(rows),
    [analytics?.months, rows],
  );
  const topDepartments = useMemo(
    () =>
      analytics?.departments?.length
        ? analytics.departments.slice(0, 8)
        : [...departments]
            .sort((left, right) => right.contractCount - left.contractCount || right.avgRisk - left.avgRisk)
            .slice(0, 8),
    [analytics?.departments, departments],
  );
  const modalityMix = useMemo(() => {
    const raw = analytics?.modalities?.length
      ? analytics.modalities.map((item) => ({
          label: item.modalidad_de_contratacion,
          count: item.contracts,
          meanRisk: item.meanRisk,
        }))
      : summaryModalities.length
        ? summaryModalities.map((item) => ({
            label: item.modalidad_de_contratacion,
            count: item.contracts,
            meanRisk: item.meanRisk,
          }))
        : groupByLabel(rows, "modality").map((item) => ({
            label: item.label,
            count: item.count,
            meanRisk: item.peakScore / 100,
          }));

    // Deduplicate by normalized label, summing counts
    const seen = new Map<string, { label: string; count: number; meanRisk: number }>();
    raw.forEach((item) => {
      const key = normalizeLabel(item.label);
      const existing = seen.get(key);
      if (existing) {
        existing.count += item.count;
        existing.meanRisk = Math.max(existing.meanRisk, item.meanRisk);
      } else {
        seen.set(key, { ...item });
      }
    });
    return [...seen.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [analytics?.modalities, rows, summaryModalities]);
  const topEntities = useMemo(
    () =>
      analytics?.entities?.length
        ? analytics.entities.slice(0, 7).map((item) => ({
            label: item.nombre_entidad,
            count: item.contracts,
            meanRisk: item.meanRisk,
          }))
        : summaryEntities.length
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
    [analytics?.entities, rows, summaryEntities],
  );
  const riskBandMix = useMemo(
    () =>
      analytics?.riskBands?.length
        ? analytics.riskBands.map((item) => ({
            label: riskBandLabel(lang, item.riskBand),
            count: item.contracts,
            meanRisk: item.meanRisk,
            band: item.riskBand,
          }))
        : [
            {
              label: riskBandLabel(lang, "high"),
              count: rows.filter((row) => row.riskBand === "high").length,
              meanRisk: 0.85,
              band: "high" as const,
            },
            {
              label: riskBandLabel(lang, "medium"),
              count: rows.filter((row) => row.riskBand === "medium").length,
              meanRisk: 0.58,
              band: "medium" as const,
            },
            {
              label: riskBandLabel(lang, "low"),
              count: rows.filter((row) => row.riskBand === "low").length,
              meanRisk: 0.24,
              band: "low" as const,
            },
          ].filter((item) => item.count > 0),
    [analytics?.riskBands, lang, rows],
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
          color: topEntities
            .map((item) =>
              item.meanRisk >= 0.7
                ? RISK_COLORS.high
                : item.meanRisk >= 0.4
                  ? RISK_COLORS.medium
                  : CHART_PALETTE[0],
            )
            .reverse(),
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
  const riskBandData = useMemo(
    () => [
      {
        x: riskBandMix.map((item) => item.count).reverse(),
        y: riskBandMix.map((item) => item.label).reverse(),
        type: "bar",
        orientation: "h",
        customdata: riskBandMix.map((item) => Math.round(item.meanRisk * 100)).reverse(),
        marker: {
          color: riskBandMix
            .map((item) =>
              item.band === "high" ? RISK_COLORS.high : item.band === "medium" ? RISK_COLORS.medium : RISK_COLORS.low,
            )
            .reverse(),
          line: { color: "rgba(40, 37, 29, 0.08)", width: 1 },
        },
        text: riskBandMix.map((item) => item.count.toLocaleString(lang === "es" ? "es-CO" : "en-US")).reverse(),
        textposition: "outside",
        cliponaxis: false,
        hovertemplate:
          lang === "es"
            ? "<b>%{y}</b><br>%{x:,} contratos<br>Intensidad media %{customdata}/100<extra></extra>"
            : "<b>%{y}</b><br>%{x:,} contracts<br>Average intensity %{customdata}/100<extra></extra>",
      },
    ],
    [lang, riskBandMix],
  );

  const visibleCount = rows.length;
  const tooFewRows = rows.length < 4 && (modalityMix.length + topEntities.length) < 4;

  const baseLayout = {
    autosize: true,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#1e1c17", family: "Inter, ui-sans-serif, system-ui, sans-serif" },
    hoverlabel: TOOLTIP_THEME,
    margin: { l: 28, r: 22, t: 16, b: 40 },
  } as const;

  if (tooFewRows) {
    return (
      <section className="cv-dashboard surface-soft">
        <div className="cv-block__header cv-dashboard__header">
          <div>
            <p className="eyebrow">{lang === "es" ? "Visualiza el corte" : "Visualize the slice"}</p>
            <h2>{lang === "es" ? "Datos insuficientes para gráficas" : "Not enough data for charts"}</h2>
          </div>
          <p>
            {lang === "es"
              ? `Solo hay ${rows.length} contrato${rows.length === 1 ? "" : "s"} visibles con el filtro activo${activeDepartmentLabel ? ` en ${activeDepartmentLabel}` : ""}. Amplía el corte para ver las gráficas de distribución.`
              : `Only ${rows.length} contract${rows.length === 1 ? "" : "s"} visible under the current filter${activeDepartmentLabel ? ` in ${activeDepartmentLabel}` : ""}. Widen the slice to see distribution charts.`}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="cv-dashboard surface-soft">
      <div className="cv-block__header cv-dashboard__header">
        <div>
          <p className="eyebrow">{lang === "es" ? "Visualiza el corte" : "Visualize the slice"}</p>
          <h2>{lang === "es" ? "Cuatro lecturas que reaccionan al corte completo" : "Four reads that react to the full slice"}</h2>
        </div>
        <p>
          {lang === "es"
            ? activeDepartmentLabel
              ? `Territorio activo: ${activeDepartmentLabel}. Todo este bloque se recalcula con el corte completo, no solo con la tabla visible.`
              : "Territorio, tiempo, modalidad y entidades recalculados con el corte completo, no con una sola página de resultados."
            : activeDepartmentLabel
              ? `Active territory: ${activeDepartmentLabel}. This block recalculates from the full slice, not only the visible table page.`
              : "Territory, time, modality, and entities recalculated from the full slice, not from a single page of results."}
        </p>
      </div>

      <div className="cv-dashboard__grid">
        <article className="cv-dashboard-card">
          <div className="cv-dashboard-card__head">
            <p className="cv-dashboard-card__kicker">{activeDepartmentLabel ? (lang === "es" ? "Riesgo" : "Risk") : lang === "es" ? "Territorio" : "Territory"}</p>
            <strong>
              {activeDepartmentLabel
                ? lang === "es"
                  ? `Bandas de riesgo dentro de ${activeDepartmentLabel}`
                  : `Risk bands inside ${activeDepartmentLabel}`
                : lang === "es"
                  ? "Departamentos con más contratos del corte"
                  : "Departments with the most contracts in the slice"}
            </strong>
            <span>
              {activeDepartmentLabel
                ? lang === "es"
                  ? "Ordenado de mayor a menor para ver si el departamento está cargado arriba, mezclado o más cerca del patrón típico."
                  : "Sorted high to low so you can tell whether the department skews high, mixed, or closer to the usual pattern."
                : lang === "es"
                  ? "Ordenado de mayor a menor y coloreado por intensidad media para detectar dónde conviene empezar."
                  : "Sorted high to low and colored by average intensity so you can see where to start."}
            </span>
          </div>
          <div className="cv-dashboard-card__plot">
            <Plot
              data={(activeDepartmentLabel ? riskBandData : territoryData) as any}
              layout={{
                ...baseLayout,
                margin: { l: 158, r: 56, t: 16, b: 34 },
                xaxis: {
                  title: { text: lang === "es" ? "Contratos visibles" : "Visible contracts", standoff: 8 },
                  gridcolor: GRID_COLOR,
                  zeroline: false,
                  tickfont: { size: 13 },
                  automargin: true,
                },
                yaxis: { tickfont: { size: 13 }, automargin: true },
              }}
              config={{ responsive: true, displaylogo: false, displayModeBar: false }}
              onClick={(event: any) => {
                if (activeDepartmentLabel) return;
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
                ? "Curva del corte completo. Haz clic en un mes para concentrar el tablero en esa ventana."
                : "Curve of the full slice. Click a month to focus the board on that window."}
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
                  tickfont: { size: 13 },
                  automargin: true,
                },
                xaxis: {
                  tickvals: timeline.map((item) => item.month),
                  ticktext: timeline.map((item) => formatMonthTick(item.month, lang)),
                  tickfont: { size: 12 },
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
                ? "Modalidades agrupadas por familia y ordenadas de mayor a menor para evitar duplicados engañosos."
                : "Modalities grouped by family and sorted high to low to avoid misleading duplicates."}
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
                  tickfont: { size: 13 },
                  automargin: true,
                },
                yaxis: { tickfont: { size: 13 }, automargin: true },
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
                ? `${visibleCount.toLocaleString("es-CO")} filas visibles en tabla, pero este ranking sale del corte completo activo.`
                : `${visibleCount.toLocaleString("en-US")} visible table rows, but this ranking comes from the full active slice.`}
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
                  tickfont: { size: 13 },
                  automargin: true,
                },
                yaxis: { tickfont: { size: 13 }, automargin: true },
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
