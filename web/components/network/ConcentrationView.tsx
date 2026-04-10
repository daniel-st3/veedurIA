"use client";

import type { NetworkNode } from "@/lib/network/types";
import { hhiColor } from "@/lib/network/buildNodes";
import { sigueDineroCopy } from "@/lib/copy";
import type { Lang } from "@/lib/types";

type Props = {
  nodes: NetworkNode[];
  lang: Lang;
};

export function ConcentrationView({ nodes, lang }: Props) {
  const t = sigueDineroCopy[lang];

  const entities = nodes
    .filter((n) => n.type === "entity" && n.herfindahl !== null)
    .sort((a, b) => (b.herfindahl ?? 0) - (a.herfindahl ?? 0))
    .slice(0, 15);

  const topByValue = [...nodes]
    .filter((n) => n.type === "entity")
    .sort((a, b) => b.total_value - a.total_value)
    .slice(0, 10);

  const maxValue = topByValue[0]?.total_value ?? 1;

  return (
    <div className="sed-concentration-view">
      <div className="sed-concentration-header">
        <h2 className="sed-concentration-title">{t.concentrationTitle}</h2>
        <p className="sed-concentration-subtitle">{t.concentrationSubtitle}</p>
      </div>

      {/* HHI ranking */}
      <div className="sed-concentration-section">
        <p className="sed-panel-section-title">{t.concentrationHhiLabel}</p>
        {entities.length === 0 && (
          <p className="sed-concentration-empty">
            {lang === "es" ? "Sin datos de concentración disponibles." : "No concentration data available."}
          </p>
        )}
        {entities.map((node) => {
          const hhi = node.herfindahl ?? 0;
          const pct = Math.round(hhi * 100);
          return (
            <div key={node.id} className="sed-ranking-row">
              <div className="sed-ranking-row__meta">
                <span className="sed-ranking-row__label" title={node.label}>
                  {node.label.length > 38 ? node.label.slice(0, 36) + "…" : node.label}
                </span>
                <span
                  className="sed-ranking-row__value"
                  style={{ color: hhiColor(hhi) }}
                >
                  {pct}%
                </span>
              </div>
              <div className="sed-ranking-bar-track">
                <div
                  className="sed-ranking-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: hhiColor(hhi),
                  }}
                />
              </div>
              <p className="sed-ranking-row__sublabel">{node.herfindahl_label}</p>
            </div>
          );
        })}
      </div>

      {/* Top entities by contract value */}
      <div className="sed-concentration-section">
        <p className="sed-panel-section-title">
          {lang === "es" ? "Entidades por volumen contratado" : "Entities by contract volume"}
        </p>
        {topByValue.map((node) => {
          const pct = Math.round((node.total_value / maxValue) * 100);
          return (
            <div key={node.id} className="sed-ranking-row">
              <div className="sed-ranking-row__meta">
                <span className="sed-ranking-row__label" title={node.label}>
                  {node.label.length > 38 ? node.label.slice(0, 36) + "…" : node.label}
                </span>
                <span className="sed-ranking-row__value sed-ranking-row__value--blue">
                  {node.total_value_label}
                </span>
              </div>
              <div className="sed-ranking-bar-track">
                <div
                  className="sed-ranking-bar-fill sed-ranking-bar-fill--blue"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Note */}
      <p className="sed-panel-disclaimer">
        {lang === "es"
          ? "HHI = suma de cuadrados de participación de cada proveedor. 0 = gasto disperso · 1 = monopolio."
          : "HHI = sum of squared shares per provider. 0 = dispersed · 1 = monopoly."}
      </p>
    </div>
  );
}
