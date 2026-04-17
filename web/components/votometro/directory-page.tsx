import Link from "next/link";
import { ArrowRight, Filter, Landmark, ShieldCheck, Users } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import type { Lang } from "@/lib/types";
import { VOTOMETRO_TOPICS } from "@/lib/votometro-topics";
import type {
  LegislatorListItem,
  PartySummary,
  VotometroDataIssue,
  VotometroDirectoryPayload,
  VotometroFilters,
} from "@/lib/votometro-types";

import styles from "./votometro.module.css";

function buildHref(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function percentLabel(value: number | null, lang: Lang) {
  return value == null ? (lang === "es" ? "Sin revisar" : "Not reviewed") : `${Math.round(value)}%`;
}

function statNumber(value: number) {
  return new Intl.NumberFormat("es-CO").format(value);
}

function localizedChamberLabel(chamber: LegislatorListItem["chamber"], lang: Lang) {
  if (lang === "es") {
    return chamber === "camara" ? "Cámara de Representantes" : "Senado";
  }
  return chamber === "camara" ? "House of Representatives" : "Senate";
}

function localizedRoleLabel(profile: LegislatorListItem, lang: Lang) {
  if (lang === "es") return profile.roleLabel;
  return profile.chamber === "camara" ? "Representative" : "Senator";
}

function avatarFor(profile: LegislatorListItem) {
  if (profile.imageUrl) {
    return (
      <div className={styles.avatar}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={profile.imageUrl} alt={profile.canonicalName} />
      </div>
    );
  }
  return <div className={styles.avatarPlaceholder}>{profile.initials}</div>;
}

function profileHref(lang: Lang, slug: string) {
  return `/votometro/legislador/${slug}?lang=${lang}`;
}

function IssuePanel({
  lang,
  issue,
}: {
  lang: Lang;
  issue: VotometroDataIssue;
}) {
  const steps =
    issue.code === "missing_schema"
      ? lang === "es"
        ? [
            "Ejecuta scripts/setup_supabase.sql en el proyecto Supabase conectado a este entorno.",
            "Corre un primer sync con python scripts/sync_votometro.py --mode=daily.",
            "Verifica que el frontend tenga SUPABASE_URL y que el entorno server-side tenga SUPABASE_SERVICE_KEY o SUPABASE_KEY.",
          ]
        : [
            "Run scripts/setup_supabase.sql in the Supabase project connected to this environment.",
            "Run an initial sync with python scripts/sync_votometro.py --mode=daily.",
            "Confirm the frontend has SUPABASE_URL and the server-side environment has SUPABASE_SERVICE_KEY or SUPABASE_KEY.",
          ]
      : issue.code === "missing_env"
        ? lang === "es"
          ? [
              "Define SUPABASE_URL en el entorno del frontend.",
              "Define SUPABASE_SERVICE_KEY o SUPABASE_KEY para las rutas server-side y review.",
              "Si usas lectura pública con RLS, define también SUPABASE_ANON_KEY.",
            ]
          : [
              "Set SUPABASE_URL in the frontend environment.",
              "Set SUPABASE_SERVICE_KEY or SUPABASE_KEY for the server-side and review routes.",
              "If you use public reads with RLS, also set SUPABASE_ANON_KEY.",
            ]
        : lang === "es"
          ? [
              "Revisa la conectividad del proyecto Supabase.",
              "Valida que las vistas públicas de Votómetro sigan existiendo y respondan.",
              "Inspecciona el último run de sync y confirma que no quedó en warning.",
            ]
          : [
              "Check connectivity to the Supabase project.",
              "Validate that the public Votometer views still exist and respond.",
              "Inspect the latest sync run and confirm it did not finish with warnings.",
            ];

  return (
    <section className={styles.alertCard}>
      <span className={styles.eyebrow}>{lang === "es" ? "Estado del módulo" : "Module status"}</span>
      <h2 className={styles.alertTitle}>{issue.title}</h2>
      <p className={styles.alertBody}>{issue.message}</p>
      {issue.detail ? (
        <p className={styles.smallMuted}>
          {lang === "es" ? "Detalle técnico" : "Technical detail"}: {issue.detail}
        </p>
      ) : null}
      <ol className={styles.alertList}>
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}

function Card({ profile, lang }: { profile: LegislatorListItem; lang: Lang }) {
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        {avatarFor(profile)}
        <div>
          <h3 className={styles.cardTitle}>{profile.canonicalName}</h3>
          <p className={styles.cardMeta}>
            {localizedRoleLabel(profile, lang)} · {profile.party}
            {profile.circunscription ? ` · ${profile.circunscription}` : ""}
          </p>
          <div className={styles.chips}>
            <span className={styles.chip}>{localizedChamberLabel(profile.chamber, lang)}</span>
            {profile.commission ? <span className={styles.chip}>{profile.commission}</span> : null}
          </div>
        </div>
      </div>

      <div className={styles.metricRow}>
        <div className={styles.metricTile}>
          <strong>{percentLabel(profile.coherenceScore, lang)}</strong>
          <span>{lang === "es" ? "Coherencia" : "Coherence"}</span>
        </div>
        <div className={styles.metricTile}>
          <strong>{percentLabel(profile.attendanceRate, lang)}</strong>
          <span>{lang === "es" ? "Asistencia" : "Attendance"}</span>
        </div>
        <div className={styles.metricTile}>
          <strong>{statNumber(profile.votesIndexed)}</strong>
          <span>{lang === "es" ? "Votos indexados" : "Indexed votes"}</span>
        </div>
      </div>

      <div className={styles.chips}>
        {profile.topTopics.length ? (
          profile.topTopics.slice(0, 3).map((topic) => (
            <span key={topic} className={`${styles.chip} ${styles.chipGood}`}>
              {topic}
            </span>
          ))
        ) : (
          <span className={`${styles.chip} ${styles.chipWarn}`}>
            {lang === "es" ? "Sin temas clasificados aún" : "No classified topics yet"}
          </span>
        )}
      </div>

      <Link href={profileHref(lang, profile.slug)} className={styles.inlineLink}>
        {lang === "es" ? "Abrir perfil completo" : "Open full profile"}
        <ArrowRight size={16} />
      </Link>
    </article>
  );
}

function Pagination({
  lang,
  filters,
  page,
  pageCount,
}: {
  lang: Lang;
  filters: VotometroFilters;
  page: number;
  pageCount: number;
}) {
  const baseParams = {
    lang,
    chamber: filters.chamber,
    party: filters.party,
    circunscription: filters.circunscription,
    commission: filters.commission,
    topic: filters.topic,
    attendance_min: filters.attendanceMin,
    coherence_min: filters.coherenceMin,
  };

  return (
    <div className={styles.pagination}>
      <span className={styles.smallMuted}>
        {lang === "es" ? "Página" : "Page"} {page} / {pageCount}
      </span>
      <div className={styles.filterActions}>
        <Link
          href={buildHref("/votometro", { ...baseParams, page: Math.max(1, page - 1) })}
          className={styles.ghostLink}
          aria-disabled={page <= 1}
        >
          {lang === "es" ? "Anterior" : "Previous"}
        </Link>
        <Link
          href={buildHref("/votometro", { ...baseParams, page: Math.min(pageCount, page + 1) })}
          className={styles.ghostLink}
          aria-disabled={page >= pageCount}
        >
          {lang === "es" ? "Siguiente" : "Next"}
        </Link>
      </div>
    </div>
  );
}

export function VotometroDirectoryPage({
  lang,
  payload,
  parties,
}: {
  lang: Lang;
  payload: VotometroDirectoryPayload;
  parties: PartySummary[];
}) {
  const hasIndexedCoverage = payload.meta.indexedVotes > 0;
  const showCoverageNotice =
    !payload.issue && payload.meta.activeLegislators > 0 && payload.meta.indexedVotes === 0;

  const copy =
    lang === "es"
      ? {
          eyebrow: hasIndexedCoverage ? "Cobertura oficial viva 2022-2026" : "Roster público sincronizado 2022-2026",
          title: hasIndexedCoverage
            ? "Votómetro ya está leyendo el Congreso desde fuentes sincronizadas."
            : "El directorio público ya está sincronizado, pero la indexación de votos sigue pendiente.",
          body:
            hasIndexedCoverage
              ? "El directorio usa Supabase como capa pública, sincroniza roster y actividad desde fuentes oficiales, y solo expone coherencia donde exista una promesa revisada por backoffice."
              : "Este entorno ya muestra la nómina pública de congresistas y el reparto por partido. Las votaciones nominales, asistencia y coherencia seguirán vacías hasta que corra la indexación de actividad y se aprueben relaciones promesa → voto.",
          stats: [
            { label: "Legisladores activos", value: statNumber(payload.meta.activeLegislators), icon: Users },
            { label: "Votos indexados", value: statNumber(payload.meta.indexedVotes), icon: Landmark },
            { label: "Coherencia promedio", value: percentLabel(payload.meta.averageCoherence, lang), icon: ShieldCheck },
            { label: "Partidos visibles", value: statNumber(parties.length), icon: Filter },
          ],
          filtersTitle: "Filtros compartibles por URL",
          filtersIntro:
            "Los filtros son acumulativos y se resuelven del lado del servidor. La paginación pública entrega 24 perfiles por página.",
          resultsTitle: "Directorio actual",
          partyTitle: "Lectura por partido",
          partyIntro:
            "Las métricas de partido salen de agregados precalculados. Si un partido todavía no tiene promesas revisadas, la coherencia se deja vacía en lugar de inventarla.",
          coverageTitle: "Cobertura pendiente de indexación",
          coverageBody:
            "La app ya no cae al mock cuando hay roster real disponible. Por eso este directorio enseña los 45 legisladores sembrados en Supabase, aunque las métricas de voto sigan en cero hasta completar el sync de actividad.",
          empty: "Todavía no hay datos sincronizados para este corte o el filtro dejó el conjunto vacío.",
          clear: "Limpiar filtros",
          apply: "Aplicar filtros",
          searchParty: "Partido",
          searchCirc: "Circunscripción",
          searchCommission: "Comisión",
          searchTopic: "Tema",
          searchAttendance: "Asistencia mínima",
          searchCoherence: "Coherencia mínima",
          searchChamber: "Cámara",
          bothChambers: "Ambas",
          senate: "Senado",
          house: "Cámara",
          technicalDetail: "Detalle técnico",
        }
      : {
          eyebrow: hasIndexedCoverage ? "Live official coverage 2022-2026" : "Public roster synced for 2022-2026",
          title: hasIndexedCoverage
            ? "Votometer is now reading Congress from synced sources."
            : "The public directory is synced, but vote indexing is still pending.",
          body:
            hasIndexedCoverage
              ? "The directory uses Supabase as the public layer, syncs roster and activity from official sources, and only exposes coherence when a reviewed promise exists."
              : "This environment already shows the public legislator roster and party distribution. Nominal votes, attendance, and coherence stay empty until activity indexing runs and promise-to-vote links are reviewed.",
          stats: [
            { label: "Active legislators", value: statNumber(payload.meta.activeLegislators), icon: Users },
            { label: "Indexed votes", value: statNumber(payload.meta.indexedVotes), icon: Landmark },
            { label: "Average coherence", value: percentLabel(payload.meta.averageCoherence, lang), icon: ShieldCheck },
            { label: "Visible parties", value: statNumber(parties.length), icon: Filter },
          ],
          filtersTitle: "Shareable URL filters",
          filtersIntro:
            "Filters stack on the server. Public pagination returns 24 profiles per page.",
          resultsTitle: "Current directory",
          partyTitle: "Party view",
          partyIntro:
            "Party metrics come from precomputed aggregates. If a party still has no reviewed promises, coherence stays empty instead of being guessed.",
          coverageTitle: "Coverage still waiting for indexing",
          coverageBody:
            "The app no longer falls back to the 12-profile mock when a real roster exists. That is why this directory shows the 45 legislators currently seeded in Supabase, even though vote metrics remain at zero until the activity sync finishes.",
          empty: "There is no synced data for this slice yet, or the filter left the set empty.",
          clear: "Clear filters",
          apply: "Apply filters",
          searchParty: "Party",
          searchCirc: "Constituency",
          searchCommission: "Commission",
          searchTopic: "Topic",
          searchAttendance: "Min attendance",
          searchCoherence: "Min coherence",
          searchChamber: "Chamber",
          bothChambers: "Both",
          senate: "Senate",
          house: "House",
          technicalDetail: "Technical detail",
        };

  return (
    <div className={styles.shell}>
      <SiteNav lang={lang} />
      <main className={styles.main}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>{copy.eyebrow}</span>
          <div className={styles.heroGrid}>
            <div>
              <h1 className={styles.title}>{copy.title}</h1>
              <p className={styles.body}>{copy.body}</p>
            </div>
            <div className={styles.statsGrid}>
              {copy.stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className={styles.statCard}>
                    <Icon size={18} />
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {payload.issue ? <IssuePanel lang={lang} issue={payload.issue} /> : null}
        {showCoverageNotice ? (
          <section className={styles.surface}>
            <span className={styles.eyebrow}>{copy.eyebrow}</span>
            <h2 className={styles.surfaceTitle}>{copy.coverageTitle}</h2>
            <p className={styles.surfaceIntro}>{copy.coverageBody}</p>
          </section>
        ) : null}

        <section className={styles.surface}>
          <h2 className={styles.surfaceTitle}>{copy.filtersTitle}</h2>
          <p className={styles.surfaceIntro}>{copy.filtersIntro}</p>
          <form method="get" className={styles.filterGrid}>
            <input type="hidden" name="lang" value={lang} />

            <div className={styles.filterField}>
              <label htmlFor="party">{copy.searchParty}</label>
              <select id="party" name="party" defaultValue={payload.filters.party ?? ""}>
                <option value="">{lang === "es" ? "Todos" : "All"}</option>
                {payload.options.parties.map((party) => (
                  <option key={party} value={party}>
                    {party}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterField}>
              <label htmlFor="circunscription">{copy.searchCirc}</label>
              <select id="circunscription" name="circunscription" defaultValue={payload.filters.circunscription ?? ""}>
                <option value="">{lang === "es" ? "Todas" : "All"}</option>
                {payload.options.circunscriptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterField}>
              <label htmlFor="commission">{copy.searchCommission}</label>
              <select id="commission" name="commission" defaultValue={payload.filters.commission ?? ""}>
                <option value="">{lang === "es" ? "Todas" : "All"}</option>
                {payload.options.commissions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterField}>
              <label htmlFor="topic">{copy.searchTopic}</label>
              <select id="topic" name="topic" defaultValue={payload.filters.topic ?? ""}>
                <option value="">{lang === "es" ? "Todos" : "All"}</option>
                {VOTOMETRO_TOPICS.filter((topic) => topic.key !== "sin-clasificar").map((topic) => (
                  <option key={topic.key} value={topic.key}>
                    {topic.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterField}>
              <label htmlFor="attendance_min">{copy.searchAttendance}</label>
              <input
                id="attendance_min"
                name="attendance_min"
                type="number"
                min={0}
                max={100}
                defaultValue={payload.filters.attendanceMin ?? ""}
              />
            </div>

            <div className={styles.filterField}>
              <label htmlFor="coherence_min">{copy.searchCoherence}</label>
              <input
                id="coherence_min"
                name="coherence_min"
                type="number"
                min={0}
                max={100}
                defaultValue={payload.filters.coherenceMin ?? ""}
              />
            </div>

            <div className={styles.filterField}>
              <label htmlFor="chamber">{copy.searchChamber}</label>
              <select id="chamber" name="chamber" defaultValue={payload.filters.chamber ?? ""}>
                <option value="">{copy.bothChambers}</option>
                <option value="senado">{copy.senate}</option>
                <option value="camara">{copy.house}</option>
              </select>
            </div>

            <div className={styles.filterActions}>
              <button type="submit" className={styles.button}>
                {copy.apply}
              </button>
              <Link href={`/votometro?lang=${lang}`} className={styles.ghostLink}>
                {copy.clear}
              </Link>
            </div>
          </form>
        </section>

        <section className={styles.surface}>
          <h2 className={styles.surfaceTitle}>{copy.resultsTitle}</h2>
          <p className={styles.surfaceIntro}>
            {payload.meta.total} {lang === "es" ? "resultados en este corte." : "results in this slice."}
          </p>
          {payload.items.length ? (
            <>
              <div className={styles.cardsGrid}>
                {payload.items.map((profile) => (
                  <Card key={profile.id} profile={profile} lang={lang} />
                ))}
              </div>
              <Pagination
                lang={lang}
                filters={payload.filters}
                page={payload.meta.page}
                pageCount={payload.meta.pageCount}
              />
            </>
          ) : (
            <div className={styles.emptyState}>
              {payload.issue
                ? lang === "es"
                  ? "El directorio no está vacío por falta de legisladores: la capa de datos no quedó lista en este entorno."
                  : "The directory is not empty because of missing legislators: the data layer is not ready in this environment."
                : copy.empty}
            </div>
          )}
        </section>

        <section className={styles.tableSurface}>
          <h2 className={styles.surfaceTitle}>{copy.partyTitle}</h2>
          <p className={styles.surfaceIntro}>{copy.partyIntro}</p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{lang === "es" ? "Partido" : "Party"}</th>
                <th>{lang === "es" ? "Miembros" : "Members"}</th>
                <th>{lang === "es" ? "Coherencia" : "Coherence"}</th>
                <th>{lang === "es" ? "Asistencia" : "Attendance"}</th>
                <th>{lang === "es" ? "Votos" : "Votes"}</th>
              </tr>
            </thead>
            <tbody>
              {parties.slice(0, 12).map((party) => (
                <tr key={party.partyKey}>
                  <td>{party.party}</td>
                  <td>{statNumber(party.memberCount)}</td>
                  <td>{percentLabel(party.coherenceScore, lang)}</td>
                  <td>{percentLabel(party.attendanceRate, lang)}</td>
                  <td>{statNumber(party.indexedVotes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
