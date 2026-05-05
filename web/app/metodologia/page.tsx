import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { resolveLang } from "@/lib/copy";
import { buildPageMetadata } from "@/lib/metadata";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  try {
    const params = await searchParams;
    const lang = resolveLang(params.lang);
    return buildPageMetadata({
      lang,
      path: `/metodologia?lang=${lang}`,
      title: lang === "es" ? "Metodología — VeedurIA" : "Methodology — VeedurIA",
      description: lang === "es" ? "Cómo se calculan las señales analíticas de VeedurIA." : "How VeedurIA analytical signals are computed.",
      imagePath: "/opengraph-image",
    });
  } catch (err) {
    console.error("[metodologia] generateMetadata failed", err);
    return { title: "Metodología — VeedurIA" };
  }
}

export default async function MethodologyPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const es = lang === "es";
  const cards = es
    ? [
        {
          title: "Qué hace VeedurIA",
          body: "VeedurIA organiza datos públicos para priorizar revisión ciudadana sobre contratación, votaciones legislativas y redes de gasto. La plataforma muestra señales analíticas, no conclusiones judiciales ni disciplinarias.",
        },
        {
          title: "ContratoLimpio",
          body: "ContratoLimpio mide qué contratos del corte visible se apartan del patrón esperado por valor, modalidad, territorio, concentración y temporalidad. Un puntaje alto indica prioridad de revisión y siempre debe contrastarse con SECOP II.",
        },
        {
          title: "Votómetro",
          body: "Votómetro organiza perfiles legislativos, asistencia, votos indexados y coherencia pública cuando hay promesas verificadas contra votaciones nominales. Cuando faltan filas individuales validadas, el perfil muestra Pipeline activo en lugar de inventar una tabla.",
        },
        {
          title: "SigueElDinero",
          body: "SigueElDinero muestra nodos y vínculos de contratación conforme se verifican contra fuentes públicas. Si la red aparece en validación, los vínculos detallados todavía no están listos para publicación.",
        },
        {
          title: "Fuentes",
          body: "Las fuentes principales son SECOP II y datos.gov.co para contratación, registros públicos del Congreso para Votómetro y capas verificadas de relación entidad-proveedor para SigueElDinero. Las fuentes pueden tener retrasos, campos vacíos o cambios de esquema.",
        },
        {
          title: "Límites y falsos positivos",
          body: "Un contrato, voto o vínculo atípico puede tener explicación técnica, territorial, presupuestal o procedimental. Las señales sirven para decidir qué revisar primero, no para afirmar irregularidades.",
        },
        {
          title: "Pipeline activo en Votómetro",
          body: "Algunos perfiles tienen métricas agregadas, pero no filas individuales de votación publicables. En esos casos mostramos el estado del pipeline, los votos indexados y la asistencia disponible sin fabricar proyectos, votos o fuentes.",
        },
        {
          title: "Filas de voto pendientes",
          body: "Las votaciones individuales se publicarán cuando exista una unión auditable por legislator_id estable o, de forma excepcional, por nombre normalizado con evidencia suficiente. Hasta entonces la tabla permanece diferida.",
        },
      ]
    : [
        {
          title: "What VeedurIA does",
          body: "VeedurIA organizes public data to prioritize civic review of public contracting, legislative voting, and spending networks. The platform shows analytical signals, not judicial or disciplinary conclusions.",
        },
        {
          title: "ContratoLimpio",
          body: "ContratoLimpio measures which contracts in the visible slice depart from expected patterns by value, modality, territory, concentration, and timing. A high score means review priority and must always be checked against SECOP II.",
        },
        {
          title: "Votómetro",
          body: "Votómetro organizes legislative profiles, attendance, indexed votes, and public coherence when verified promises can be compared with roll-call votes. When validated individual rows are missing, the profile shows an Active pipeline card instead of inventing a table.",
        },
        {
          title: "SigueElDinero",
          body: "SigueElDinero shows contracting nodes and links as they are verified against public sources. If the network is marked as source validation, detailed links are not ready for publication yet.",
        },
        {
          title: "Sources",
          body: "Primary sources include SECOP II and datos.gov.co for contracting, public congressional records for Votómetro, and verified entity-provider relationship layers for SigueElDinero. Sources may lag, omit fields, or change schema.",
        },
        {
          title: "Limits and false positives",
          body: "An atypical contract, vote, or link can have a technical, territorial, budgetary, or procedural explanation. Signals help decide what to review first; they do not assert wrongdoing.",
        },
        {
          title: "Active pipeline in Votómetro",
          body: "Some profiles have aggregate metrics but no publishable individual vote rows. In those cases we show pipeline status, indexed votes, and available attendance without fabricating bills, votes, or sources.",
        },
        {
          title: "Pending vote rows",
          body: "Individual votes will be published once there is an auditable join by stable legislator_id or, exceptionally, by normalized name with enough evidence. Until then the table remains deferred.",
        },
      ];

  return (
    <div className="shell">
      <SiteNav lang={lang} />
      <main className="legal-page">
        <section className="legal-hero surface">
          <p className="eyebrow">{es ? "Metodología" : "Methodology"}</p>
          <h1>{es ? "Cómo leer las señales" : "How to read the signals"}</h1>
          <p>
            {es
              ? "VeedurIA produce señales de priorización para revisión ciudadana. Señal analítica, no prueba de irregularidad: no determina culpabilidad ni reemplaza el expediente oficial."
              : "VeedurIA produces prioritization signals for civic review. Analytical signal, not proof of wrongdoing: it does not determine wrongdoing or replace the official record."}
          </p>
        </section>

        <section className="legal-grid">
          {cards.map((card) => (
            <article key={card.title} className="surface legal-card">
              <h2>{card.title}</h2>
              <p>{card.body}</p>
            </article>
          ))}
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
