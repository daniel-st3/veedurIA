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
        ? "Explora quién contrata con quién, cómo se concentra el gasto público y qué relaciones se repiten."
        : "Explore who contracts with whom, how public spending concentrates, and which relationships repeat.",
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
  return (
    <div className="sed-page">
      <SiteNav lang={lang} />
      <main className="module-construction">
        <section className="module-construction__panel">
          <span className="module-construction__eyebrow">
            {lang === "es" ? "SigueElDinero" : "FollowTheMoney"}
          </span>
          <h1>
            {lang === "es"
              ? "Módulo en construcción — próximamente"
              : "Module under construction — coming soon"}
          </h1>
          <p>
            {lang === "es"
              ? "Estamos conectando la red relacional con el cron diario antes de mostrar nodos, métricas o vínculos. No publicaremos una red vacía como si fuera un resultado."
              : "We are connecting the relationship network to the daily cron before showing nodes, metrics, or links. We will not present an empty network as a result."}
          </p>
          <div className="module-status-strip">
            <span>ContratoLimpio: {lang === "es" ? "activo" : "active"}</span>
            <span>Votómetro: {lang === "es" ? "disponible" : "available"}</span>
            <span>SigueElDinero: {lang === "es" ? "en construcción" : "under construction"}</span>
          </div>
          <Link href={`/?lang=${lang}`} className="btn-primary">
            {lang === "es" ? "Volver al inicio" : "Back home"}
          </Link>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
