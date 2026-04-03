"use client";

import { useMemo, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { ColombiaMap } from "@/components/colombia-map";
import type { Lang } from "@/lib/types";

type SignalCard = {
  label: string;
  title: string;
  body: string;
};

type Props = {
  lang: Lang;
  status: string;
  title: string;
  body: string;
  legend: [string, string, string];
  graphLabel: string;
  notes: [SignalCard, SignalCard, SignalCard];
  geojson: any | null;
};

const HERO_DEPARTMENTS = [
  { key: "SANTAFE DE BOGOTA D.C", label: "Bogotá D.C.", geoName: "SANTAFE DE BOGOTA D.C", avgRisk: 0.78, contractCount: 18432 },
  { key: "ANTIOQUIA", label: "Antioquia", geoName: "ANTIOQUIA", avgRisk: 0.68, contractCount: 16218 },
  { key: "VALLE DEL CAUCA", label: "Valle del Cauca", geoName: "VALLE DEL CAUCA", avgRisk: 0.6, contractCount: 13742 },
  { key: "ATLANTICO", label: "Atlántico", geoName: "ATLANTICO", avgRisk: 0.55, contractCount: 8420 },
] as const;

function formatPercent(value: number) {
  return `${Math.round(value * 100)} / 100`;
}

export function HeroField({ lang, status, title, body, legend, graphLabel, notes, geojson }: Props) {
  const scope = useRef<HTMLDivElement | null>(null);
  const [activeDepartment, setActiveDepartment] = useState<string>(HERO_DEPARTMENTS[0].geoName);

  useGSAP(
    () => {
      gsap.fromTo(
        ".hero-field, .hero-field__summary-card, .hero-field__phase-card, .hero-field__territory-chip",
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.64, stagger: 0.05, ease: "power3.out" },
      );
    },
    { scope },
  );

  const currentDepartment = useMemo(
    () => HERO_DEPARTMENTS.find((item) => item.geoName === activeDepartment) ?? HERO_DEPARTMENTS[0],
    [activeDepartment],
  );

  const phaseCards = useMemo(
    () => [
      {
        tone: "blue",
        label: notes[0].label,
        title: notes[0].title,
        body:
          lang === "es"
            ? `${currentDepartment.label}: ${currentDepartment.contractCount.toLocaleString()} contratos visibles en la capa marcada hoy.`
            : `${currentDepartment.label}: ${currentDepartment.contractCount.toLocaleString()} contracts visible in the active layer today.`,
      },
      {
        tone: "yellow",
        label: notes[1].label,
        title: notes[1].title,
        body:
          lang === "es"
            ? `El territorio activo cambia la lectura: contratos, promesas y luego redes se explican desde la misma base territorial.`
            : `The active territory changes the reading: contracts, promises, and later networks are explained from the same territorial base.`,
      },
      {
        tone: "red",
        label: notes[2].label,
        title: notes[2].title,
        body:
          lang === "es"
            ? `La interacción no navega el mapa por navegarlo: actualiza el foco del producto y la señal visible.`
            : `This interaction is not map-for-map's-sake: it updates the product focus and the visible signal.`,
      },
    ],
    [currentDepartment, lang, notes],
  );

  return (
    <div ref={scope} className="surface hero-field hero-field--map stripe-flag">
      <div className="hero-field__intro">
        <div>
          <div className="hero-field__topline">
            <span className="hero-field__status label">{status}</span>
            <span className="hero-field__graph label">{graphLabel}</span>
          </div>
          <h2>{title}</h2>
          <p className="body-copy">{body}</p>
        </div>
        <div className="hero-field__legend">
          <span className="label hero-field__legend-item">
            <span className="status-dot" style={{ background: "var(--yellow)" }} /> {legend[0]}
          </span>
          <span className="label hero-field__legend-item">
            <span className="status-dot" style={{ background: "var(--blue)" }} /> {legend[1]}
          </span>
          <span className="label hero-field__legend-item">
            <span className="status-dot" style={{ background: "var(--red)" }} /> {legend[2]}
          </span>
        </div>
      </div>

      <div className="hero-field__canvas">
        <div className="hero-field__map-panel surface-soft">
          <div className="hero-field__map-copy">
            <div>
              <div className="label">{lang === "es" ? "Foco territorial" : "Territorial focus"}</div>
              <strong>{currentDepartment.label}</strong>
            </div>
            <div className="tiny-pill">
              {lang === "es"
                ? `${currentDepartment.contractCount.toLocaleString()} contratos`
                : `${currentDepartment.contractCount.toLocaleString()} contracts`}
            </div>
          </div>
          <div className="hero-field__map-shell">
            {geojson ? (
              <ColombiaMap
                geojson={geojson}
                departments={[...HERO_DEPARTMENTS]}
                activeDepartment={activeDepartment}
                onSelect={setActiveDepartment}
                mode="hero"
                showCaption={false}
              />
            ) : (
              <div className="hero-map-skeleton">
                <div className="hero-map-skeleton__blob" />
                <div className="hero-map-skeleton__outline" />
              </div>
            )}
          </div>
          <div className="hero-field__map-foot">
            <article className="hero-field__summary-card">
              <span className="label">{lang === "es" ? "Señal media" : "Mean signal"}</span>
              <strong>{formatPercent(currentDepartment.avgRisk)}</strong>
            </article>
            <article className="hero-field__summary-card">
              <span className="label">{lang === "es" ? "Lectura sugerida" : "Suggested reading"}</span>
              <strong>{currentDepartment.avgRisk >= 0.7 ? "ContratoLimpio" : "PromesMetro"}</strong>
            </article>
            <article className="hero-field__summary-card">
              <span className="label">{lang === "es" ? "Interacción" : "Interaction"}</span>
              <strong>{lang === "es" ? "Pulsa un territorio" : "Tap a territory"}</strong>
            </article>
          </div>
        </div>

        <div className="hero-field__rail">
          <div className="hero-field__quick">
            {HERO_DEPARTMENTS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`hero-field__territory-chip territory-chip ${item.geoName === activeDepartment ? "territory-chip--active" : ""}`}
                onClick={() => setActiveDepartment(item.geoName)}
              >
                <span>{item.label}</span>
                <span className="territory-chip__meter" style={{ width: `${Math.max(20, item.avgRisk * 100)}%` }} />
              </button>
            ))}
          </div>

          <div className="hero-field__phases">
            {phaseCards.map((item) => (
              <article key={item.title} className={`hero-field__phase-card surface-soft stripe-${item.tone}`}>
                <div className="label">{item.label}</div>
                <h3>{item.title}</h3>
                <p className="body-copy">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
