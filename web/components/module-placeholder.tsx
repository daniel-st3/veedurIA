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
          { href: `/promesmetro?lang=${lang}`, label: "Promesómetro" },
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
                ? "Esta capa todavía no ofrece el mapa relacional completo. Aquí verás el avance del módulo y volverás a los módulos activos."
                : "This layer does not expose the full relationship map yet. Use it to track progress and jump back into the live modules."}
            </span>
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
