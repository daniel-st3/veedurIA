import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { buildPageMetadata } from "@/lib/metadata";
import { resolveLang } from "@/lib/copy";

const sections = {
  es: [
    {
      title: "Naturaleza del servicio",
      body: [
        "VeedurIA es una herramienta cívica de lectura, priorización y visualización de información pública. No es una autoridad administrativa, judicial, disciplinaria, fiscal ni penal.",
        "Las alertas, puntajes, rankings, redes y gráficas son señales analíticas para orientar revisión humana. No declaran culpabilidad, responsabilidad contractual, hallazgos fiscales, sanciones, conflictos de interés ni irregularidades comprobadas.",
      ],
    },
    {
      title: "Fuentes y verificación",
      body: [
        "La plataforma usa fuentes abiertas u oficiales como SECOP II, datos.gov.co, Senado abierto y registros públicos disponibles. Cuando una fuente cambia, se cae o publica campos incompletos, el tablero puede mostrar brechas, datos parciales o resultados no actualizados.",
        "Antes de publicar, denunciar, tomar una decisión jurídica o contactar a una persona señalada por el sistema, debes abrir el expediente oficial, revisar documentos, fechas, adendas, contexto contractual y posibles homónimos.",
      ],
    },
    {
      title: "Protección de datos personales",
      body: [
        "VeedurIA evita solicitar datos personales sensibles, contraseñas, documentos privados, información financiera, datos médicos o datos de menores. El foco son registros públicos de contratación, actividad legislativa y relaciones institucionales.",
        "Si aparece un dato personal que no debería ser público, una identificación errada, un homónimo o un dato desactualizado, debe tratarse como incidente de calidad de datos y corregirse o retirarse cuando exista soporte verificable.",
      ],
    },
    {
      title: "Seguridad y uso permitido",
      body: [
        "No está permitido usar VeedurIA para doxxing, acoso, amenazas, extorsión, discriminación, persecución política o publicación de acusaciones sin verificación documental.",
        "No intentes evadir límites técnicos, extraer masivamente datos personales, forzar credenciales, probar vulnerabilidades sin autorización o usar el sitio como fuente única para decisiones de alto impacto.",
      ],
    },
    {
      title: "Responsabilidad del usuario",
      body: [
        "Quien usa la plataforma asume la responsabilidad de interpretar los datos con contexto y de verificar la fuente primaria antes de actuar. VeedurIA no reemplaza asesoría legal, auditoría profesional, investigación periodística completa ni trámite ante autoridad competente.",
        "La plataforma puede contener errores de normalización, desfases de sincronización, duplicados, datos faltantes o inferencias imperfectas. Las correcciones razonables se deben hacer sobre evidencia y trazabilidad, no sobre presión reputacional.",
      ],
    },
    {
      title: "Alcance legal realista",
      body: [
        "Esta página no libera automáticamente de cualquier riesgo legal. Su función es dejar claros los límites de uso, reducir interpretaciones engañosas y documentar que el producto muestra señales revisables, no conclusiones jurídicas.",
        "Si necesitas una opinión vinculante sobre habeas data, protección de datos, difamación, contratación estatal, responsabilidad fiscal o seguridad de la información, consulta a un abogado o autoridad competente en Colombia.",
      ],
    },
  ],
  en: [
    {
      title: "Nature of the service",
      body: [
        "VeedurIA is a civic tool for reading, prioritizing, and visualizing public information. It is not an administrative, judicial, disciplinary, fiscal, or criminal authority.",
        "Alerts, scores, rankings, networks, and charts are analytical signals for human review. They do not establish guilt, contractual liability, fiscal findings, sanctions, conflicts of interest, or proven wrongdoing.",
      ],
    },
    {
      title: "Sources and verification",
      body: [
        "The platform uses open or official sources such as SECOP II, datos.gov.co, open Senate data, and available public records. If a source changes, fails, or publishes incomplete fields, the product may show gaps, partial data, or stale results.",
        "Before publishing, filing a complaint, making a legal decision, or contacting a person surfaced by the system, open the official record and review documents, dates, amendments, contractual context, and possible homonyms.",
      ],
    },
    {
      title: "Personal data protection",
      body: [
        "VeedurIA avoids requesting sensitive personal data, passwords, private documents, financial information, medical data, or minors' data. Its focus is public procurement records, legislative activity, and institutional relationships.",
        "If personal data appears where it should not, or if an identity is wrong, stale, or affected by a homonym, treat it as a data-quality incident and correct or remove it when verifiable support exists.",
      ],
    },
    {
      title: "Security and permitted use",
      body: [
        "VeedurIA may not be used for doxxing, harassment, threats, extortion, discrimination, political persecution, or publishing accusations without documentary verification.",
        "Do not bypass technical limits, mass-extract personal data, force credentials, test vulnerabilities without authorization, or use the site as the sole source for high-impact decisions.",
      ],
    },
    {
      title: "User responsibility",
      body: [
        "Users are responsible for interpreting data with context and checking the primary source before acting. VeedurIA does not replace legal advice, professional audit, complete journalistic investigation, or proceedings before a competent authority.",
        "The platform may contain normalization errors, sync delays, duplicates, missing data, or imperfect inferences. Reasonable corrections should be made from evidence and traceability, not reputational pressure.",
      ],
    },
    {
      title: "Realistic legal scope",
      body: [
        "This page does not automatically eliminate every legal risk. It clarifies limits of use, reduces misleading interpretations, and documents that the product shows reviewable signals, not legal conclusions.",
        "For a binding opinion on habeas data, data protection, defamation, public procurement, fiscal liability, or information security, consult a lawyer or competent authority in Colombia.",
      ],
    },
  ],
} as const;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  try {
    const params = await searchParams;
    const lang = resolveLang(params.lang);

    return buildPageMetadata({
      lang,
      path: `/etica-y-privacidad?lang=${lang}`,
      title: lang === "es" ? "Legal, privacidad y seguridad — VeedurIA" : "Legal, privacy, and security — VeedurIA",
      description:
        lang === "es"
          ? "Límites legales, protección de datos, seguridad y uso responsable de VeedurIA."
          : "Legal limits, data protection, security, and responsible use of VeedurIA.",
      imagePath: "/opengraph-image",
    });
  } catch (err) {
    console.error("[etica-y-privacidad] generateMetadata failed", err);
    return { title: "Legal, privacidad y seguridad — VeedurIA" };
  }
}

export default async function EthicsPrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const copy = sections[lang];

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

      <main className="page legal-page">
        <section className="legal-hero stripe-flag">
          <p className="eyebrow">{lang === "es" ? "Legal · privacidad · seguridad" : "Legal · privacy · security"}</p>
          <h1>
            {lang === "es"
              ? "Uso responsable de señales públicas, sin convertirlas en acusaciones."
              : "Responsible use of public signals, without turning them into accusations."}
          </h1>
          <p>
            {lang === "es"
              ? "VeedurIA ayuda a priorizar revisión ciudadana. El usuario debe verificar la fuente primaria y el contexto antes de publicar, denunciar o tomar decisiones."
              : "VeedurIA helps prioritize civic review. Users must verify primary sources and context before publishing, reporting, or making decisions."}
          </p>
        </section>

        <section className="legal-grid" aria-label={lang === "es" ? "Condiciones de uso" : "Use terms"}>
          {copy.map((section) => (
            <article key={section.title} className="legal-card">
              <h2>{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>
          ))}
        </section>

        <section className="legal-note">
          <strong>{lang === "es" ? "Última actualización" : "Last updated"}</strong>
          <span>2026-04-28</span>
          <p>
            {lang === "es"
              ? "La política se revisa cuando cambian las fuentes, el alcance de los módulos, la arquitectura de datos o los controles de seguridad."
              : "This policy is reviewed when sources, module scope, data architecture, or security controls change."}
          </p>
        </section>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
