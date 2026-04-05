import Link from "next/link";

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
  return (
    <div className="shell">
      <SiteNav
        lang={lang}
        links={[
          { href: `/contrato-limpio?lang=${lang}`, label: "ContratoLimpio" },
          { href: `/votometro?lang=${lang}`, label: "VotóMeter" },
          { href: `/sigue-el-dinero?lang=${lang}`, label: "SigueElDinero" },
        ]}
      />
      <main className="page">
        <section className="surface stripe-flag" style={{ padding: "2rem", marginTop: "1.5rem" }}>
          <p className="eyebrow">{phase}</p>
          <h1 className="section-title" style={{ marginBottom: "0.8rem" }}>
            {title}
          </h1>
          <p className="section-copy" style={{ maxWidth: 760, marginBottom: "1.4rem" }}>
            {body}
          </p>
          <div className="cv-status-banner" style={{ marginBottom: "1.2rem" }}>
            <strong>{lang === "es" ? "En construcción" : "Under construction"}</strong>
            <span>
              {lang === "es"
                ? "Esta capa todavía no expone el mapa relacional completo. Mientras tanto muestra qué conexiones se abrirán y te deja volver directo a los módulos ya activos."
                : "This layer does not expose the full relationship map yet. For now it shows which connections are coming next and lets you jump back into the active modules."}
            </span>
          </div>
          <div className="lp-entry-grid" style={{ marginBottom: "1.2rem" }}>
            <article className="lp-entry-card lp-entry-card--red">
              <span className="lp-entry-card__kicker">{lang === "es" ? "PRÓXIMO" : "COMING NEXT"}</span>
              <div className="lp-entry-card__row">
                <strong>{lang === "es" ? "Red de contratistas" : "Contractor network"}</strong>
              </div>
              <p>
                {lang === "es"
                  ? "Cruces entre contratistas, entidades, territorios y patrones repetidos para pasar del caso aislado al circuito."
                  : "Crossings between contractors, entities, territories, and repeated patterns to move from isolated cases to the wider circuit."}
              </p>
            </article>
            <article className="lp-entry-card lp-entry-card--blue">
              <span className="lp-entry-card__kicker">{lang === "es" ? "PRÓXIMO" : "COMING NEXT"}</span>
              <div className="lp-entry-card__row">
                <strong>{lang === "es" ? "Financiadores y donaciones" : "Funders and donations"}</strong>
              </div>
              <p>
                {lang === "es"
                  ? "Relación entre plata de campaña, proveedores recurrentes y focos territoriales."
                  : "Relationships between campaign money, repeated vendors, and territorial hotspots."}
              </p>
            </article>
            <article className="lp-entry-card lp-entry-card--yellow">
              <span className="lp-entry-card__kicker">{lang === "es" ? "PRÓXIMO" : "COMING NEXT"}</span>
              <div className="lp-entry-card__row">
                <strong>{lang === "es" ? "Trazas públicas" : "Public traces"}</strong>
              </div>
              <p>
                {lang === "es"
                  ? "Rutas para abrir SECOP II, CNE y otras fuentes desde un mismo grafo consultable."
                  : "Routes into SECOP II, CNE, and other sources from one consultable graph."}
              </p>
            </article>
          </div>
          <Link href={`/contrato-limpio?lang=${lang}`} className="btn-primary">
            {lang === "es" ? "Volver a ContratoLimpio" : "Back to ContratoLimpio"}
          </Link>
        </section>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
