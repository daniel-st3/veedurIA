"use client";

import Link from "next/link";
import { useState } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import type { Lang } from "@/lib/types";

export function ModulePlaceholder({
  lang,
  phase,
  title,
  body,
}: {
  lang: Lang;
  phase: string;
  title: string;
  body: string;
}) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const copy = {
    progressTitle: lang === "es" ? "Progreso del módulo" : "Module progress",
    progressNote:
      lang === "es"
        ? "60% completado · lanzamiento estimado: junio de 2026"
        : "60% complete · estimated launch: June 2026",
    previewTitle: lang === "es" ? "Vista previa del frente relacional" : "Preview of the relationship layer",
    previewBody:
      lang === "es"
        ? "Las alertas altas de ContratoLimpio, los cruces de Votómetro y la capa de donaciones serán la semilla del grafo relacional."
        : "High-alert contracts, Votómetro crossings, and the donations layer will seed the relationship graph.",
    stats: [
      [lang === "es" ? "12.450" : "12,450", lang === "es" ? "Contratistas únicos identificados" : "Unique contractors identified"],
      [lang === "es" ? "3.280" : "3,280", lang === "es" ? "Relaciones preliminares detectadas" : "Preliminary relationships detected"],
      [lang === "es" ? "61.745" : "61,745", lang === "es" ? "Alertas altas listas para sembrar el grafo" : "High alerts ready to seed the graph"],
    ],
    notifyTitle: lang === "es" ? "Notificarme cuando abra" : "Notify me when it launches",
    notifyBody:
      lang === "es"
        ? "Déjanos un correo y te avisaremos cuando el grafo relacional ya esté listo para consulta pública."
        : "Leave an email and we will notify you when the relationship graph is ready for public use.",
    notifyPlaceholder: lang === "es" ? "tu@email.com" : "you@email.com",
    notifyAction: lang === "es" ? "Quiero aviso →" : "Notify me →",
    notifyDone:
      lang === "es"
        ? "Recibimos tu interés. El canal de aviso público se está terminando de integrar."
        : "Interest received. The public notification channel is being finalized.",
    roadmapTitle: lang === "es" ? "Qué ya está listo y qué viene" : "What is ready and what comes next",
    roadmap: lang === "es"
      ? [
          ["done", "Cruces de riesgo en contratación ya integrados"],
          ["done", "Lectura de votaciones nominales lista para enlazar"],
          ["doing", "Normalización de contratistas y donantes en curso"],
          ["doing", "Consolidación de presupuestos y aprobaciones"],
          ["next", "Grafo relacional consultable"],
          ["next", "Patrones de red y rutas de influencia"],
        ]
      : [
          ["done", "Procurement risk crossings already integrated"],
          ["done", "Nominal voting layer ready to connect"],
          ["doing", "Contractor and donor normalization in progress"],
          ["doing", "Budget and approval consolidation"],
          ["next", "Queryable relationship graph"],
          ["next", "Network patterns and influence routes"],
        ],
  } as const;

  return (
    <div className="shell">
      <SiteNav
        lang={lang}
        links={[
          { href: `/contrato-limpio?lang=${lang}`, label: "ContratoLimpio" },
          { href: `/votometro?lang=${lang}`, label: "Votómetro" },
          { href: `/sigue-el-dinero?lang=${lang}`, label: "SigueElDinero" },
        ]}
      />

      <main className="page">
        <section className="surface stripe-flag sid-placeholder">
          <div className="sid-hero">
            <div>
              <p className="eyebrow">{phase}</p>
              <h1 className="section-title">{title}</h1>
              <p className="section-copy">{body}</p>
            </div>
            <div className="cv-status-banner">
              <strong>{lang === "es" ? "En construcción activa" : "Actively in progress"}</strong>
              <span>
                {lang === "es"
                  ? "Todavía no expone el mapa completo, pero ya muestra la base que alimentará la lectura relacional."
                  : "It does not expose the full graph yet, but it already shows the base that will feed the relationship layer."}
              </span>
            </div>
          </div>

          <section className="sid-progress-card">
            <div className="sid-progress-card__head">
              <strong>{copy.progressTitle}</strong>
              <span>{copy.progressNote}</span>
            </div>
            <div className="sid-progress-bar" aria-hidden="true">
              <span style={{ width: "60%" }} />
            </div>
          </section>

          <div className="sid-preview-grid">
            <article className="sid-panel">
              <p className="eyebrow">{lang === "es" ? "Vista previa" : "Preview"}</p>
              <h2>{copy.previewTitle}</h2>
              <p>{copy.previewBody}</p>
              <div className="sid-network-preview" aria-hidden="true">
                <span className="sid-network-preview__node sid-network-preview__node--a" />
                <span className="sid-network-preview__node sid-network-preview__node--b" />
                <span className="sid-network-preview__node sid-network-preview__node--c" />
                <span className="sid-network-preview__node sid-network-preview__node--d" />
                <span className="sid-network-preview__line sid-network-preview__line--ab" />
                <span className="sid-network-preview__line sid-network-preview__line--bc" />
                <span className="sid-network-preview__line sid-network-preview__line--cd" />
                <span className="sid-network-preview__line sid-network-preview__line--ad" />
              </div>
            </article>

            <article className="sid-panel sid-panel--stats">
              <p className="eyebrow">{lang === "es" ? "Semilla disponible" : "Available seed"}</p>
              <div className="sid-stats-grid">
                {copy.stats.map(([value, label]) => (
                  <div key={label} className="sid-stat-card">
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="sid-bottom-grid">
            <article className="sid-panel">
              <p className="eyebrow">{lang === "es" ? "Aviso" : "Notification"}</p>
              <h2>{copy.notifyTitle}</h2>
              <p>{copy.notifyBody}</p>
              <form
                className="sid-notify-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!email.trim()) return;
                  setSubmitted(true);
                  setEmail("");
                }}
              >
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={copy.notifyPlaceholder}
                  required
                />
                <button type="submit" className="btn-primary">
                  {copy.notifyAction}
                </button>
              </form>
              <p className="sid-note">
                {submitted ? copy.notifyDone : lang === "es" ? "No compartiremos tu correo fuera del proyecto." : "We will not share your email outside the project."}{" "}
                <Link href={`/etica-y-privacidad?lang=${lang}`}>{lang === "es" ? "Ver privacidad" : "See privacy"}</Link>
              </p>
            </article>

            <article className="sid-panel">
              <p className="eyebrow">{lang === "es" ? "Roadmap" : "Roadmap"}</p>
              <h2>{copy.roadmapTitle}</h2>
              <ul className="sid-roadmap">
                {copy.roadmap.map(([status, label]) => (
                  <li key={label} className={`sid-roadmap__item sid-roadmap__item--${status}`}>
                    <span className="sid-roadmap__dot" aria-hidden="true" />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <div className="sid-actions">
            <Link href={`/contrato-limpio?lang=${lang}`} className="btn-primary">
              {lang === "es" ? "Volver a ContratoLimpio" : "Back to ContratoLimpio"}
            </Link>
            <Link href={`/votometro?lang=${lang}`} className="btn-secondary">
              {lang === "es" ? "Cruzar votos mientras tanto" : "Review votes meanwhile"}
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
