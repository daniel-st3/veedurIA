"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { networkConfig } from "@/lib/network/config";
import type { Lang } from "@/lib/types";
import { sigueDineroCopy } from "@/lib/copy";

type Props = { lang: Lang };

export function NetworkLegend({ lang }: Props) {
  const t = sigueDineroCopy[lang];
  const [open, setOpen] = useState(false);

  return (
    <div className="sed-legend">
      <button
        className="sed-legend__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Info size={14} />
        <span>{t.legendTitle}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="sed-legend__body">
          {/* Node types */}
          <p className="sed-legend__section">
            {lang === "es" ? "Tipos de nodo" : "Node types"}
          </p>
          {networkConfig.nodeTypes.map((nt) => (
            <div key={nt.type} className="sed-legend__item">
              <span
                className="sed-legend__dot"
                style={{ background: nt.color }}
                aria-hidden="true"
              />
              <span>{nt.label[lang]}</span>
            </div>
          ))}

          <div className="sed-legend__divider" />

          {/* Edge types */}
          <p className="sed-legend__section">
            {lang === "es" ? "Tipos de relación" : "Relationship types"}
          </p>
          {networkConfig.edgeTypes.map((et) => (
            <div key={et.type} className="sed-legend__item">
              <span className="sed-legend__line sed-legend__line--green" aria-hidden="true" />
              <span>{et.label[lang]}</span>
            </div>
          ))}

          <div className="sed-legend__divider" />

          {/* Confidence scale */}
          <p className="sed-legend__section">
            {lang === "es" ? "Nivel de confianza" : "Confidence level"}
          </p>
          <div className="sed-legend__item">
            <span className="sed-legend__line sed-legend__line--green" aria-hidden="true" />
            <span>{t.legendConfidenceHigh}</span>
          </div>
          <div className="sed-legend__item">
            <span className="sed-legend__line sed-legend__line--yellow" aria-hidden="true" />
            <span>{t.legendConfidenceMed}</span>
          </div>
          <div className="sed-legend__item">
            <span className="sed-legend__line sed-legend__line--red" aria-hidden="true" />
            <span>{t.legendConfidenceLow}</span>
          </div>

          <div className="sed-legend__divider" />

          <p className="sed-legend__note">{t.legendNodeSize}</p>
          <p className="sed-legend__note">{t.legendEdgeWidth}</p>
        </div>
      )}
    </div>
  );
}
