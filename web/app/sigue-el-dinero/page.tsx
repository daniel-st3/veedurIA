import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { resolveLang } from "@/lib/copy";
import { buildPageMetadata } from "@/lib/metadata";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  return buildPageMetadata({
    lang,
    path: `/sigue-el-dinero?lang=${lang}`,
    title: lang === "es" ? "SigueElDinero — VeedurIA" : "SigueElDinero — VeedurIA",
    description:
      lang === "es"
        ? "La capa relacional de SigueElDinero está en construcción. Volveremos cuando los nodos, vínculos y evidencia estén listos."
        : "The SigueElDinero relationship layer is in progress. We will return when nodes, links, and evidence are ready.",
    imagePath: "/sigue-el-dinero/opengraph-image",
  });
}

export default async function SigueElDineroPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const es = lang === "es";

  return (
    <div className="sed-page">
      <SiteNav lang={lang} />
      <main className="module-construction">
        <section className="module-construction__panel">
          <span className="module-construction__eyebrow">
            {es ? "SigueElDinero" : "FollowTheMoney"}
          </span>
          <h1>
            {es
              ? "SigueElDinero está en construcción"
              : "SigueElDinero is in progress"}
          </h1>
          <p>
            {es
              ? "La capa de red todavía no tiene datos públicos suficientes para lectura ciudadana. Mantendremos este módulo cerrado hasta que los nodos, vínculos y evidencia estén listos."
              : "The relationship layer does not yet have enough public data for civic review. This module will remain gated until nodes, links, and evidence are ready."}
          </p>
          <div className="module-status-strip">
            <span>ContratoLimpio: {es ? "activo" : "active"}</span>
            <span>Votómetro: {es ? "disponible" : "available"}</span>
            <span>SigueElDinero: {es ? "en construcción" : "in progress"}</span>
          </div>
          <Link href={`/etica-y-privacidad?lang=${lang}`} className="module-disclaimer">
            <strong>
              {es
                ? "Señal analítica, no acusación. Verifica la fuente oficial antes de concluir o publicar."
                : "Analytical signal, not accusation. Verify the official source before drawing conclusions or publishing."}
            </strong>
          </Link>
          <div className="module-construction__actions">
            <Link href={`/?lang=${lang}`} className="btn-primary">
              {es ? "Volver al inicio" : "Back home"}
            </Link>
            <Link href={`/contrato-limpio?lang=${lang}`} className="btn-secondary">
              {es ? "Ver ContratoLimpio" : "See ContratoLimpio"}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
