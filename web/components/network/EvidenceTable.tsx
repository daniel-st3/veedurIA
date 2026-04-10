"use client";

import { ExternalLink, AlertTriangle } from "lucide-react";
import type { NetworkEdge, NetworkNode } from "@/lib/network/types";
import { sigueDineroCopy } from "@/lib/copy";
import type { Lang } from "@/lib/types";

type Props = {
  edges: NetworkEdge[];
  nodes: NetworkNode[];
  lang: Lang;
  selectedNodeId: string | null;
};

export function EvidenceTable({ edges, nodes, lang, selectedNodeId }: Props) {
  const t = sigueDineroCopy[lang];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // If a node is selected, show its edges; otherwise show top 30 by monto
  const relevant = selectedNodeId
    ? edges.filter((e) => e.source === selectedNodeId || e.target === selectedNodeId)
    : [...edges].sort((a, b) => b.total_monto - a.total_monto).slice(0, 30);

  return (
    <div className="sed-evidence-view">
      <div className="sed-concentration-header">
        <h2 className="sed-concentration-title">{t.tabEvidence}</h2>
        <p className="sed-concentration-subtitle">
          {selectedNodeId
            ? (lang === "es" ? "Contratos que sustentan las relaciones del nodo seleccionado." : "Contracts supporting the selected node's relationships.")
            : (lang === "es" ? "Top relaciones por monto contratado." : "Top relationships by contract value.")}
        </p>
      </div>

      {/* Disclaimer */}
      <div className="sed-ethical-banner" role="note">
        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{t.disclaimer}</span>
      </div>

      {relevant.length === 0 && (
        <p className="sed-concentration-empty">
          {lang === "es" ? "Sin contratos disponibles para mostrar." : "No contracts available to display."}
        </p>
      )}

      {/* Table */}
      {relevant.length > 0 && (
        <div className="sed-evidence-table-wrapper">
          <table className="sed-evidence-table">
            <thead>
              <tr>
                <th>{lang === "es" ? "Entidad" : "Entity"}</th>
                <th>{lang === "es" ? "Proveedor" : "Provider"}</th>
                <th>{lang === "es" ? "Monto" : "Amount"}</th>
                <th>{lang === "es" ? "Contratos" : "Contracts"}</th>
                <th>{lang === "es" ? "Confianza" : "Confidence"}</th>
                <th>{lang === "es" ? "Fuente" : "Source"}</th>
              </tr>
            </thead>
            <tbody>
              {relevant.map((edge) => {
                const entity = nodeMap.get(edge.source);
                const provider = nodeMap.get(edge.target);
                const ev = edge.evidence?.[0];
                const bandColor =
                  edge.confidence >= 80 ? "#20c997"
                  : edge.confidence >= 60 ? "#eab308"
                  : "#ef4444";

                return (
                  <tr key={edge.id}>
                    <td title={entity?.label}>
                      {(entity?.label ?? edge.source).slice(0, 32)}
                      {(entity?.label?.length ?? 0) > 32 && "…"}
                    </td>
                    <td title={provider?.label}>
                      {(provider?.label ?? edge.target).slice(0, 32)}
                      {(provider?.label?.length ?? 0) > 32 && "…"}
                    </td>
                    <td className="sed-evidence-table__value">{edge.total_monto_label}</td>
                    <td>{edge.contract_count.toLocaleString()}</td>
                    <td>
                      <span
                        className="sed-confidence-badge"
                        style={{ color: bandColor, borderColor: `${bandColor}40` }}
                      >
                        {edge.confidence}%
                      </span>
                    </td>
                    <td>
                      {ev?.sourceUrl ? (
                        <a
                          href={ev.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sed-evidence-table__link"
                          title={ev.sourceDocument}
                        >
                          <ExternalLink size={12} />
                          SECOP II
                        </a>
                      ) : (
                        <span className="sed-evidence-table__nosource">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
