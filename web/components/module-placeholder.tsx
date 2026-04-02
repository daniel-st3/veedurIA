import Link from "next/link";

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
          { href: `/promesmetro?lang=${lang}`, label: "PromesMetro" },
          { href: `/sigue-el-dinero?lang=${lang}`, label: "SigueElDinero" },
        ]}
        ctaHref={`/contrato-limpio?lang=${lang}`}
        ctaLabel="ContratoLimpio"
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
          <Link href={`/contrato-limpio?lang=${lang}`} className="btn-primary">
            Volver a ContratoLimpio
          </Link>
        </section>
      </main>
    </div>
  );
}
