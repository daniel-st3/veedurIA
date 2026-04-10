"use client";

import { useState } from "react";
import { X, ExternalLink, AlertTriangle } from "lucide-react";
import type { NetworkEdge } from "@/lib/network/types";
import { primaryEvidence, algorithmLabel } from "@/lib/network/buildEdges";
import { reportNetworkError } from "@/lib/api";
import { sigueDineroCopy } from "@/lib/copy";
import type { Lang } from "@/lib/types";

type Props = {
  edge: NetworkEdge | null;
  lang: Lang;
  onClose: () => void;
};

export function EdgeModal({ edge, lang, onClose }: Props) {
  const t = sigueDineroCopy[lang];
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportSent, setReportSent] = useState(false);

  if (!edge) return null;

  const ev = primaryEvidence(edge);
  const confidencePct = Math.round(edge.confidence);

  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    await reportNetworkError({ edge_id: edge!.id, description: reportText });
    setReportSent(true);
    setReportText("");
  }

  const bandStyle =
    edge.confidence >= 80
      ? { color: "#20c997", borderColor: "rgba(32,201,151,0.3)", bg: "rgba(32,201,151,0.08)" }
      : edge.confidence >= 60
      ? { color: "#eab308", borderColor: "rgba(234,179,8,0.3)", bg: "rgba(234,179,8,0.08)" }
      : { color: "#ef4444", borderColor: "rgba(239,68,68,0.3)", bg: "rgba(239,68,68,0.08)" };

  return (
    <div className="sed-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sed-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sed-modal__header">
          <div>
            <span
              className="sed-node-pill"
              style={{
                background: bandStyle.bg,
                borderColor: bandStyle.borderColor,
                color: bandStyle.color,
              }}
            >
              {edge.typeLabel}
            </span>
            <h2 className="sed-modal__title">{t.evidenceTitle}</h2>
          </div>
          <button className="sed-modal__close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <p className="sed-modal__desc">{edge.typeDescription}</p>

        {/* Confidence bar */}
        <div className="sed-modal__confidence">
          <div className="sed-modal__confidence-row">
            <span>{t.evidenceConfidence}</span>
            <span style={{ color: bandStyle.color, fontWeight: 700 }}>
              {confidencePct}% — {edge.confidenceLabel}
            </span>
          </div>
          <div className="sed-confidence-bar-track">
            <div
              className="sed-confidence-bar-fill"
              style={{
                width: `${confidencePct}%`,
                background: bandStyle.color,
              }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="sed-modal__stats">
          <div className="sed-modal__stat">
            <span>{lang === "es" ? "Total" : "Total"}</span>
            <strong>{edge.total_monto_label}</strong>
          </div>
          <div className="sed-modal__stat">
            <span>{lang === "es" ? "Contratos" : "Contracts"}</span>
            <strong>{edge.contract_count.toLocaleString()}</strong>
          </div>
          <div className="sed-modal__stat">
            <span>{lang === "es" ? "Período" : "Period"}</span>
            <strong>{edge.date_range.from} — {edge.date_range.to}</strong>
          </div>
          <div className="sed-modal__stat">
            <span>{lang === "es" ? "Modalidad" : "Modality"}</span>
            <strong>{edge.modalidad || "—"}</strong>
          </div>
        </div>

        {/* Evidence detail */}
        {ev && (
          <div className="sed-modal__evidence">
            <p className="sed-modal__evidence-title">{t.evidenceSource}: <strong>SECOP II</strong></p>
            <div className="sed-modal__evidence-row">
              <span>{t.evidenceDocument}</span>
              <span>{ev.sourceDocument}</span>
            </div>
            <div className="sed-modal__evidence-row">
              <span>{t.evidenceDate}</span>
              <span>{ev.sourceDate}</span>
            </div>
            <div className="sed-modal__evidence-row">
              <span>{t.evidenceAlgorithm}</span>
              <span>{algorithmLabel(ev.algorithm, lang)}</span>
            </div>
            <a
              href={ev.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="sed-modal__source-link"
            >
              <ExternalLink size={13} />
              {t.evidenceViewSource}
            </a>
          </div>
        )}

        {/* Disclaimer */}
        <p className="sed-ethical-note sed-ethical-note--sm">
          <AlertTriangle size={13} />
          {t.disclaimer}
        </p>

        {/* Report error section */}
        <div className="sed-modal__report">
          {!reportOpen && !reportSent && (
            <button
              className="sed-modal__report-toggle"
              onClick={() => setReportOpen(true)}
            >
              {t.evidenceReportError}
            </button>
          )}
          {reportOpen && !reportSent && (
            <form className="sed-modal__report-form" onSubmit={handleReport}>
              <textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder={t.evidenceReportDescription}
                rows={2}
                required
              />
              <button type="submit" className="sed-modal__report-submit">
                {t.evidenceReportSend}
              </button>
            </form>
          )}
          {reportSent && (
            <p className="sed-modal__report-sent">{t.evidenceReportSent}</p>
          )}
        </div>
      </div>
    </div>
  );
}
