"use client";

import { ExternalLink, Network, TrendingUp, Activity } from "lucide-react";
import { LoadingStage } from "@/components/loading-stage";
import type { NetworkNode, NetworkNodeDetail } from "@/lib/network/types";
import { hhiColor, hhiBarWidth } from "@/lib/network/buildNodes";
import { sigueDineroCopy } from "@/lib/copy";
import type { Lang } from "@/lib/types";

type Props = {
  node: NetworkNode | null;
  detail: NetworkNodeDetail | null;
  isLoading: boolean;
  lang: Lang;
  onExpand: (nodeId: string) => void;
  isExpanding: boolean;
};

export function NodePanel({ node, detail, isLoading, lang, onExpand, isExpanding }: Props) {
  const t = sigueDineroCopy[lang];

  if (!node) {
    return (
      <div className="sed-node-panel sed-node-panel--empty">
        <Network size={24} strokeWidth={1} style={{ opacity: 0.3, marginBottom: "0.75rem" }} />
        <span>{t.panelEmpty}</span>
      </div>
    );
  }

  const typeKey = `panelType_${node.type}` as keyof typeof t;
  const typeLabel = (t[typeKey] as string | undefined) ?? node.typeLabel;

  const pillClass =
    node.type === "entity"
      ? "sed-node-pill sed-node-pill--entity"
      : node.type === "provider"
      ? "sed-node-pill sed-node-pill--provider"
      : "sed-node-pill sed-node-pill--cluster";

  return (
    <div className="sed-node-panel">
      {/* Header */}
      <div className="sed-node-panel__header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className={pillClass}>{typeLabel}</span>
          <p className="sed-node-panel__name">{node.label}</p>
          {node.department && (
            <p className="sed-node-panel__dept">{node.department}</p>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="sed-node-stats">
        <div className="sed-node-stat">
          <span>{t.panelTotalValue}</span>
          <strong>{node.total_value_label}</strong>
        </div>
        <div className="sed-node-stat">
          <span>{t.panelConnections}</span>
          <strong>{node.connection_count.toLocaleString()}</strong>
        </div>
        {node.herfindahl !== null && (
          <div className="sed-node-stat sed-node-stat--full">
            <span>{t.panelConcentration}</span>
            <strong style={{ color: hhiColor(node.herfindahl) }}>
              {node.herfindahl_label || `${(node.herfindahl * 100).toFixed(0)}%`}
            </strong>
            <div className="sed-hhi-bar-track">
              <div
                className="sed-hhi-bar-fill"
                style={{
                  width: hhiBarWidth(node.herfindahl),
                  background: hhiColor(node.herfindahl),
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Zero connections notice */}
      {node.connection_count === 0 && (
        <div className="sed-node-zero-connections">
          <Activity size={14} />
          {t.nodeZeroConnections}
        </div>
      )}

      {/* Expand button */}
      {node.connection_count > 0 && (
        <button
          className="sed-panel-expand-btn"
          onClick={() => onExpand(node.id)}
          disabled={isExpanding}
        >
          {isExpanding ? t.panelExpanding : t.panelExpand}
          <Network size={14} />
        </button>
      )}

      {/* Top connections */}
      {isLoading && (
        <div className="sed-node-loading">
          <LoadingStage lang={lang} context="node" compact inline />
        </div>
      )}

      {detail && detail.top_connections.length > 0 && (
        <div>
          <p className="sed-panel-section-title">
            <TrendingUp size={13} />
            {t.panelTopConnections}
          </p>
          <div className="sed-connections-list">
            {detail.top_connections.map((conn) => (
              <div key={conn.node_id} className="sed-connection-item">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="sed-connection-label">{conn.label}</p>
                  <p className="sed-connection-meta">
                    {conn.contract_count} {lang === "es" ? "contratos" : "contracts"}
                    {" · "}
                    <span
                      style={{
                        color: conn.confidence >= 80 ? "#20c997" : conn.confidence >= 60 ? "#eab308" : "#ef4444",
                      }}
                    >
                      {conn.confidence}%
                    </span>
                  </p>
                </div>
                <span className="sed-connection-value">{conn.total_monto_label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top contracts */}
      {detail && detail.top_contracts.length > 0 && (
        <div>
          <p className="sed-panel-section-title">
            <ExternalLink size={13} />
            {t.panelEvidence}
          </p>
          <div className="sed-contracts-list">
            {detail.top_contracts.slice(0, 3).map((c) => (
              <a
                key={c.id}
                href={c.secop_url}
                target="_blank"
                rel="noopener noreferrer"
                className="sed-contract-link"
              >
                <span>{c.value_label}</span>
                <span className="sed-contract-link__date">{c.date}</span>
                <ExternalLink size={11} style={{ opacity: 0.5, flexShrink: 0 }} />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="sed-panel-disclaimer">{t.disclaimer}</p>
    </div>
  );
}
