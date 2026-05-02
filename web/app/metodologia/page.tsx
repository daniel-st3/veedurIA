import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { resolveLang } from "@/lib/copy";
import { buildPageMetadata } from "@/lib/metadata";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  return buildPageMetadata({
    lang,
    path: `/metodologia?lang=${lang}`,
    title: lang === "es" ? "Metodología — VeedurIA" : "Methodology — VeedurIA",
    description: lang === "es" ? "Cómo se calculan las señales analíticas de VeedurIA." : "How VeedurIA analytical signals are computed.",
    imagePath: "/opengraph-image",
  });
}

export default async function MethodologyPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const es = lang === "es";

  return (
    <div className="shell">
      <SiteNav lang={lang} />
      <main className="legal-page">
        <section className="legal-hero surface">
          <p className="eyebrow">{es ? "Metodología" : "Methodology"}</p>
          <h1>{es ? "Cómo leer las señales" : "How to read the signals"}</h1>
          <p>
            {es
              ? "VeedurIA produce señales de priorización para revisión ciudadana. No determina culpabilidad ni reemplaza el expediente oficial."
              : "VeedurIA produces prioritization signals for civic review. It does not determine wrongdoing or replace the official record."}
          </p>
        </section>

        <section className="legal-grid">
          <article className="surface legal-card">
            <h2>IsolationForest</h2>
            <p>
              {es
                ? "ContratoLimpio usa un modelo IsolationForest con 100 estimadores y contaminación 0.05 para detectar contratos atípicos dentro del corte importado."
                : "ContratoLimpio uses an IsolationForest model with 100 estimators and contamination 0.05 to detect atypical contracts inside the imported slice."}
            </p>
          </article>
          <article className="surface legal-card">
            <h2>{es ? "Familias de scoring" : "Scoring families"}</h2>
            <p>
              {es
                ? "La señal combina competencia, precio/valor, concentración y temporalidad. Cada familia aporta contexto; ninguna es una acusación por sí sola."
                : "The signal combines competition, price/value, concentration, and timing. Each family adds context; none is an accusation by itself."}
            </p>
          </article>
          <article className="surface legal-card">
            <h2>{es ? "Rojo vs. amarillo" : "Red vs. yellow"}</h2>
            <p>
              {es
                ? "Rojo indica prioridad alta de revisión. Amarillo indica una señal intermedia. Ambos requieren abrir SECOP y revisar documentos primarios."
                : "Red means high review priority. Yellow means an intermediate signal. Both require opening SECOP and reviewing primary documents."}
            </p>
          </article>
          <article className="surface legal-card">
            <h2>{es ? "Falsos positivos" : "False positives"}</h2>
            <p>
              {es
                ? "Los modelos de anomalías generan falsos positivos. Un contrato atípico puede estar plenamente justificado por condiciones técnicas, territoriales o presupuestales."
                : "Anomaly models produce false positives. An atypical contract can be fully justified by technical, territorial, or budget conditions."}
            </p>
          </article>
        </section>

        <section className="surface legal-card">
          <h2>{es ? "Correcciones" : "Corrections"}</h2>
          <p>
            {es
              ? "Para solicitar una corrección, envía el enlace oficial, el campo que debe ajustarse y la evidencia primaria. Priorizamos correcciones que afecten identidad, fuente o estado público."
              : "To submit a correction, send the official link, the field to adjust, and primary evidence. We prioritize corrections affecting identity, source, or public status."}
          </p>
          <Link href={`/etica-y-privacidad?lang=${lang}`} className="btn-secondary">
            {es ? "Ver límites éticos" : "View ethical limits"}
          </Link>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
