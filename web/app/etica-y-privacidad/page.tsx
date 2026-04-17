import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { buildPageMetadata } from "@/lib/metadata";
import { resolveLang } from "@/lib/copy";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);

  return buildPageMetadata({
    lang,
    path: `/etica-y-privacidad?lang=${lang}`,
    title: lang === "es" ? "Privacidad y ética — VeedurIA" : "Privacy and ethics — VeedurIA",
    description:
      lang === "es"
        ? "Principios de verificación, trazabilidad y uso responsable de datos en VeedurIA."
        : "Principles of verification, traceability, and responsible data use in VeedurIA.",
    imagePath: "/opengraph-image",
  });
}

export default async function EthicsPrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);

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
        <section className="surface stripe-flag" style={{ padding: "2rem", marginTop: "1.4rem" }}>
          <p className="eyebrow">{lang === "es" ? "Privacidad y ética" : "Privacy and ethics"}</p>
          <h1 className="section-title" style={{ marginBottom: "0.8rem" }}>
            {lang === "es" ? "Cómo usar VeedurIA con criterio" : "How to use VeedurIA responsibly"}
          </h1>
          <div className="section-copy" style={{ maxWidth: 860, display: "grid", gap: "0.95rem" }}>
            <p>
              {lang === "es"
                ? "VeedurIA prioriza casos para revisión. No declara culpabilidad ni reemplaza expedientes oficiales, decisiones judiciales o control institucional."
                : "VeedurIA prioritizes cases for review. It does not assign guilt or replace official records, judicial decisions, or institutional oversight."}
            </p>
            <p>
              {lang === "es"
                ? "Cada módulo enlaza a sus fuentes para que cualquier persona pueda verificar la información, contrastar contexto y detectar vacíos antes de sacar conclusiones."
                : "Each module links back to its sources so anyone can verify the information, compare context, and detect gaps before drawing conclusions."}
            </p>
            <p>
              {lang === "es"
                ? "La plataforma evita exponer datos personales sensibles y muestra de forma visible cuándo una cobertura está incompleta, desfasada o todavía en construcción."
                : "The platform avoids exposing sensitive personal data and makes it clear when coverage is incomplete, stale, or still under construction."}
            </p>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
