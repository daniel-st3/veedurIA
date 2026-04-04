"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ArrowRight, FileSearch, Radar, Waypoints } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { fetchOverview } from "@/lib/api";
import type { Lang, OverviewPayload } from "@/lib/types";

type FeatureTone = "yellow" | "blue" | "red";

const FEATURES = (lang: Lang, totalContracts: number, redAlerts: number) => [
  {
    index: "01",
    title: "ContratoLimpio",
    tone: "yellow" as FeatureTone,
    eyebrow: lang === "es" ? "Contratos públicos" : "Public contracts",
    description:
      lang === "es"
        ? "Empieza por lo que sí vale la pena revisar: filtros claros, mapa territorial, casos guía y retorno directo a SECOP II."
        : "Start with what is worth reviewing: clear filters, a territorial map, guided cases, and a direct jump back to SECOP II.",
    detail:
      lang === "es"
        ? `${totalContracts.toLocaleString("es-CO")} contratos visibles en la capa nacional`
        : `${totalContracts.toLocaleString("en-US")} contracts visible in the national layer`,
    href: `/contrato-limpio?lang=${lang}`,
    cta: lang === "es" ? "Abrir módulo" : "Open module",
    icon: FileSearch,
  },
  {
    index: "02",
    title: "Promesómetro",
    tone: "blue" as FeatureTone,
    eyebrow: lang === "es" ? "Promesas y evidencia" : "Promises and evidence",
    description:
      lang === "es"
        ? "Compara promesa original, acción pública y cercanía temática en una sola lectura. Cada tarjeta te muestra qué sí existe y qué todavía no aparece."
        : "Compare the original promise, public action, and thematic closeness in one read. Each card shows what exists and what still does not.",
    detail:
      lang === "es"
        ? "Promesas 2022 frente a acciones públicas observables"
        : "2022 promises against observable public action",
    href: `/promesmetro?lang=${lang}`,
    cta: lang === "es" ? "Ver tablero" : "View board",
    icon: Radar,
  },
  {
    index: "03",
    title: "SigueElDinero",
    tone: "red" as FeatureTone,
    eyebrow: lang === "es" ? "Redes y trazabilidad" : "Networks and traceability",
    description:
      lang === "es"
        ? "La siguiente capa conectará contratistas, donantes y funcionarios para pasar de contratos aislados a relaciones persistentes."
        : "The next layer will connect contractors, donors, and officials to move from isolated contracts to persistent relationships.",
    detail:
      lang === "es"
        ? `${redAlerts.toLocaleString("es-CO")} señales altas ya sirven de base para esa red`
        : `${redAlerts.toLocaleString("en-US")} high-signal cases already form that base`,
    href: "#",
    cta: lang === "es" ? "En preparación" : "In progress",
    icon: Waypoints,
    disabled: true,
  },
];

export function LandingPage({
  lang,
  initialOverview,
}: {
  lang: Lang;
  initialOverview: OverviewPayload;
}) {
  const [overview, setOverview] = useState<OverviewPayload>(initialOverview);

  useEffect(() => {
    let alive = true;
    fetchOverview({ lang, full: false })
      .then((data) => {
        if (alive) setOverview(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lang]);

  const totalContracts = overview.meta.totalRows || overview.slice.totalContracts;
  const redAlerts = overview.slice.redAlerts;
  const latestDate = overview.meta.latestContractDate ?? "—";
  const features = FEATURES(lang, totalContracts, redAlerts);

  return (
    <div className="shell">
      <SiteNav
        lang={lang}
        links={[
          { href: `/contrato-limpio?lang=${lang}`, label: "ContratoLimpio" },
          { href: `/promesmetro?lang=${lang}`, label: "Promesómetro" },
          { href: "#", label: "SigueElDinero" },
        ]}
      />

      <main className="page lp-page">
        <section className="lp-stack surface stripe-flag">
          <div className="lp-stack__eyebrow eyebrow">
            {lang === "es"
              ? "VeedurIA · lectura pública para contratación, promesas y poder"
              : "VeedurIA · public reading layer for contracts, promises, and power"}
          </div>

          <h1 className="lp-stack__title">
            <span className="flag-yellow">{lang === "es" ? "Vigila" : "Watch"}</span>{" "}
            <span className="flag-blue">{lang === "es" ? "el poder" : "power"}</span>{" "}
            <span className="flag-red">{lang === "es" ? "sin perderte" : "without getting lost"}</span>
          </h1>

          <p className="lp-stack__body">
            {lang === "es"
              ? "La landing ahora entra directo al punto: qué puedes auditar hoy, por dónde empezar y cómo llegar a cada módulo sin ruido ni relleno."
              : "The landing now goes straight to the point: what you can audit today, where to start, and how to reach each module without noise or filler."}
          </p>

          <div className="lp-quickline">
            <span>{lang === "es" ? "Base nacional visible" : "Visible national base"}: {totalContracts.toLocaleString("es-CO")}</span>
            <span>{lang === "es" ? "Señales prioritarias" : "Priority signals"}: {redAlerts.toLocaleString("es-CO")}</span>
            <span>{lang === "es" ? "Último corte puntuado" : "Latest scored cut"}: {latestDate}</span>
          </div>
        </section>

        <section className="lp-flow surface-soft">
          <div className="lp-flow__header">
            <p className="eyebrow">{lang === "es" ? "Cómo se usa" : "How to use it"}</p>
            <h2>{lang === "es" ? "Una sola ruta de entrada" : "One clear entry route"}</h2>
          </div>

          <div className="lp-flow__steps">
            <article className="lp-flow__step">
              <span>01</span>
              <strong>{lang === "es" ? "Elige una pregunta" : "Pick a question"}</strong>
              <p>{lang === "es" ? "¿Quieres revisar contratos, promesas o relaciones?" : "Do you want to review contracts, promises, or relationships?"}</p>
            </article>
            <article className="lp-flow__step">
              <span>02</span>
              <strong>{lang === "es" ? "Entra al módulo" : "Open the module"}</strong>
              <p>{lang === "es" ? "Cada módulo arranca con un contexto corto y una lectura útil desde el primer scroll." : "Each module starts with short context and a useful reading from the first scroll."}</p>
            </article>
            <article className="lp-flow__step">
              <span>03</span>
              <strong>{lang === "es" ? "Verifica la fuente" : "Verify the source"}</strong>
              <p>{lang === "es" ? "Todo termina en SECOP, programas oficiales o acciones públicas verificables." : "Everything ends in SECOP, official programs, or verifiable public actions."}</p>
            </article>
          </div>
        </section>

        <section className="lp-modules">
          {features.map((feature) => {
            const Icon = feature.icon;

            const content = (
              <>
                <div className="lp-module__head">
                  <span className={`lp-module__index lp-module__index--${feature.tone}`}>{feature.index}</span>
                  <div>
                    <p className="lp-module__eyebrow">{feature.eyebrow}</p>
                    <h2>{feature.title}</h2>
                  </div>
                </div>
                <p className="lp-module__description">{feature.description}</p>
                <div className="lp-module__foot">
                  <span className="lp-module__detail">{feature.detail}</span>
                  <span className={`lp-module__cta lp-module__cta--${feature.tone}`}>
                    <Icon size={16} />
                    {feature.cta}
                    {!feature.disabled ? <ArrowRight size={16} /> : null}
                  </span>
                </div>
              </>
            );

            return feature.disabled ? (
              <article key={feature.title} className={`lp-module lp-module--${feature.tone} lp-module--disabled surface`}>
                {content}
              </article>
            ) : (
              <Link key={feature.title} href={feature.href} className={`lp-module lp-module--${feature.tone} surface`}>
                {content}
              </Link>
            );
          })}
        </section>

        <section className="lp-close surface">
          <div>
            <p className="eyebrow">{lang === "es" ? "Lo importante" : "What matters"}</p>
            <h2>{lang === "es" ? "Menos marketing, más lectura accionable" : "Less marketing, more actionable reading"}</h2>
          </div>
          <p>
            {lang === "es"
              ? "La landing queda condensada para empujar a la experiencia real. No vende humo: te deja entrar rápido, entender qué ofrece cada feature y empezar a auditar."
              : "The landing stays condensed to push users into the real experience. It does not oversell anything: it gets you in fast, explains what each feature does, and starts the audit."}
          </p>
        </section>
      </main>
    </div>
  );
}
