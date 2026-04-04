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
    eyebrow: lang === "es" ? "Contratación pública" : "Public procurement",
    description:
      lang === "es"
        ? "Busca por entidad, territorio, fechas y modalidad; abre casos guía y vuelve directo al expediente en SECOP II."
        : "Search by entity, territory, date, and modality; open guide cases and jump back to the record in SECOP II.",
    detail:
      lang === "es"
        ? `${totalContracts.toLocaleString("es-CO")} contratos en el universo cargado`
        : `${totalContracts.toLocaleString("en-US")} contracts in the loaded universe`,
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
        ? "Compara lo prometido, la fuente original y la acción pública observada en una sola lectura, con cortes por periodo político."
        : "Compare the original pledge, the source document, and the observed public action in one read, by political cycle.",
    detail:
      lang === "es" ? "Seguimiento ejecutivo, Senado, Cámara y radar presidencial" : "Executive, Senate, House, and presidential watch",
    href: `/promesmetro?lang=${lang}`,
    cta: lang === "es" ? "Ver seguimiento" : "View tracker",
    icon: Radar,
  },
  {
    index: "03",
    title: "SigueElDinero",
    tone: "red" as FeatureTone,
    eyebrow: lang === "es" ? "Relaciones y trazabilidad" : "Networks and traceability",
    description:
      lang === "es"
        ? "La siguiente capa unirá contratistas, donaciones y redes de poder para pasar del caso aislado al patrón persistente."
        : "The next layer connects contractors, donations, and power networks to move from isolated cases to persistent patterns.",
    detail:
      lang === "es"
        ? `${redAlerts.toLocaleString("es-CO")} alertas altas ya sirven de semilla`
        : `${redAlerts.toLocaleString("en-US")} high-signal alerts already seed the graph`,
    href: "#",
    cta: lang === "es" ? "Próximo módulo" : "Next module",
    icon: Waypoints,
    disabled: true,
  },
];

const ENTRY_POINTS = (lang: Lang) => [
  {
    title: lang === "es" ? "Si quieres revisar contratos" : "If you want to review contracts",
    body:
      lang === "es"
        ? "Empieza por territorio, identifica el caso principal y revisa los últimos contratos cargados desde la fuente oficial."
        : "Start by territory, inspect the lead case, and review the most recent contracts loaded from the official source.",
  },
  {
    title: lang === "es" ? "Si quieres seguir promesas" : "If you want to track promises",
    body:
      lang === "es"
        ? "Abre el periodo político, compara la promesa original y salta a la acción pública o al programa que la respalda."
        : "Open the political cycle, compare the original promise, and jump to the public action or source program behind it.",
  },
  {
    title: lang === "es" ? "Si quieres entender redes" : "If you want to understand networks",
    body:
      lang === "es"
        ? "Usa la capa de señales actuales para ubicar proveedores, entidades y territorios que merecen una revisión relacional."
        : "Use the current signal layer to locate providers, entities, and territories worth relational review.",
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

  const totalContracts = overview.meta.sourceRows || overview.meta.totalRows || overview.slice.totalContracts;
  const redAlerts = overview.slice.redAlerts;
  const latestDate = overview.meta.sourceLatestContractDate ?? overview.meta.latestContractDate ?? "—";
  const features = FEATURES(lang, totalContracts, redAlerts);
  const entryPoints = ENTRY_POINTS(lang);

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
        <section className="lp-hero-shell surface stripe-flag">
          <div className="lp-hero-copy">
            <p className="eyebrow">
              {lang === "es"
                ? "VeedurIA · contratos, promesas y señales de poder en una sola entrada"
                : "VeedurIA · contracts, promises, and power signals in one entry point"}
            </p>

            <h1 className="lp-hero-title">
              <span className="flag-yellow">{lang === "es" ? "Ver" : "See"}</span>{" "}
              <span className="flag-blue">{lang === "es" ? "qué pasó" : "what happened"}</span>{" "}
              <span className="flag-red">{lang === "es" ? "y dónde mirar" : "and where to look"}</span>
            </h1>

            <p className="lp-hero-body">
              {lang === "es"
                ? "VeedurIA organiza lo importante primero: contratación pública, promesas rastreables y los patrones que ameritan revisión humana."
                : "VeedurIA puts the important signals first: public procurement, traceable promises, and the patterns worth human review."}
            </p>
          </div>

          <div className="lp-kpi-row">
            <article className="lp-kpi-card lp-kpi-card--yellow">
              <span>{lang === "es" ? "Universo visible" : "Visible universe"}</span>
              <strong>{totalContracts.toLocaleString("es-CO")}</strong>
              <p>{lang === "es" ? "filas oficiales cargadas" : "official rows loaded"}</p>
            </article>
            <article className="lp-kpi-card lp-kpi-card--blue">
              <span>{lang === "es" ? "Último dato fuente" : "Latest source date"}</span>
              <strong>{latestDate}</strong>
              <p>{lang === "es" ? "desde SECOP II / datos.gov.co" : "from SECOP II / datos.gov.co"}</p>
            </article>
            <article className="lp-kpi-card lp-kpi-card--red">
              <span>{lang === "es" ? "Alertas altas" : "High alerts"}</span>
              <strong>{redAlerts.toLocaleString("es-CO")}</strong>
              <p>{lang === "es" ? "casos que conviene abrir primero" : "cases worth opening first"}</p>
            </article>
          </div>

          <div className="lp-entry-grid">
            {entryPoints.map((item) => (
              <article key={item.title} className="lp-entry-card">
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-modules">
          {features.map((feature) => {
            const Icon = feature.icon;

            const content = (
              <>
                <div className="lp-module__head">
                  <div className={`lp-module__index lp-module__index--${feature.tone}`}>{feature.index}</div>
                  <div>
                    <p className="lp-module__eyebrow">{feature.eyebrow}</p>
                    <h2>{feature.title}</h2>
                  </div>
                </div>

                <p className="lp-module__description">{feature.description}</p>

                <div className="lp-module__detailband">
                  <span>{feature.detail}</span>
                </div>

                <div className={`lp-module__cta lp-module__cta--${feature.tone}`}>
                  <Icon size={16} />
                  <span>{feature.cta}</span>
                  {!feature.disabled ? <ArrowRight size={16} /> : null}
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

        <section className="lp-proof-strip surface-soft">
          <article>
            <span>{lang === "es" ? "Fuente verificable" : "Verifiable source"}</span>
            <strong>{lang === "es" ? "SECOP II, Congreso, Cámara, Senado y programas públicos" : "SECOP II, Congress, House, Senate, and public programs"}</strong>
          </article>
          <article>
            <span>{lang === "es" ? "Lectura corta" : "Short read"}</span>
            <strong>{lang === "es" ? "Cada módulo arranca con el caso, el contexto y el siguiente clic útil" : "Each module starts with the case, the context, and the next useful click"}</strong>
          </article>
          <article>
            <span>{lang === "es" ? "Escala nacional" : "National scale"}</span>
            <strong>{lang === "es" ? "Cobertura territorial con filtros, contraste y retorno a la fuente" : "Territorial coverage with filters, contrast, and direct return to source"}</strong>
          </article>
        </section>
      </main>
    </div>
  );
}
