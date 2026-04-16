import Link from "next/link";
import { ArrowRight, Filter, Landmark, ShieldCheck, Users } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import type { Lang } from "@/lib/types";
import { VOTOMETRO_TOPICS } from "@/lib/votometro-topics";
import type {
  LegislatorListItem,
  PartySummary,
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

function percentLabel(value: number | null) {
  return value == null ? "Sin revisar" : `${Math.round(value)}%`;
}

function statNumber(value: number) {
  return new Intl.NumberFormat("es-CO").format(value);
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

function Card({ profile, lang }: { profile: LegislatorListItem; lang: Lang }) {
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        {avatarFor(profile)}
        <div>
          <h3 className={styles.cardTitle}>{profile.canonicalName}</h3>
          <p className={styles.cardMeta}>
            {profile.roleLabel} · {profile.party}
            {profile.circunscription ? ` · ${profile.circunscription}` : ""}
          </p>
          <div className={styles.chips}>
            <span className={styles.chip}>{profile.chamberLabel}</span>
            {profile.commission ? <span className={styles.chip}>{profile.commission}</span> : null}
          </div>
        </div>
      </div>

      <div className={styles.metricRow}>
        <div className={styles.metricTile}>
          <strong>{percentLabel(profile.coherenceScore)}</strong>
          <span>{lang === "es" ? "Coherencia" : "Coherence"}</span>
        </div>
        <div className={styles.metricTile}>
          <strong>{percentLabel(profile.attendanceRate)}</strong>
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
  const copy =
    lang === "es"
      ? {
          eyebrow: "Cobertura oficial viva 2022-2026",
          title: "VotóMeter dejó el mock y ahora lee el Congreso desde fuentes sincronizadas.",
          body:
            "El directorio usa Supabase como capa pública, sincroniza roster y actividad desde fuentes oficiales, y solo expone coherencia donde exista una promesa revisada por backoffice.",
          stats: [
            { label: "Legisladores activos", value: statNumber(payload.meta.activeLegislators), icon: Users },
            { label: "Votos indexados", value: statNumber(payload.meta.indexedVotes), icon: Landmark },
            { label: "Coherencia promedio", value: percentLabel(payload.meta.averageCoherence), icon: ShieldCheck },
            { label: "Partidos visibles", value: statNumber(parties.length), icon: Filter },
          ],
          filtersTitle: "Filtros compartibles por URL",
          filtersIntro:
            "Los filtros son acumulativos y se resuelven del lado del servidor. La paginación pública entrega 24 perfiles por página.",
          resultsTitle: "Directorio actual",
          partyTitle: "Lectura por partido",
          partyIntro:
            "Las métricas de partido salen de agregados precalculados. Si un partido todavía no tiene promesas revisadas, la coherencia se deja vacía en lugar de inventarla.",
          empty: "Todavía no hay datos sincronizados para este corte o el filtro dejó el conjunto vacío.",
          clear: "Limpiar filtros",
          apply: "Aplicar filtros",
          searchParty: "Partido",
          searchCirc: "Circunscripción",
          searchCommission: "Comisión",
          searchTopic: "Tema",
          searchAttendance: "Asistencia mínima",
          searchCoherence: "Coherencia mínima",
        }
      : {
          eyebrow: "Live official coverage 2022-2026",
          title: "VotóMeter now reads Congress from synced sources instead of a static mock.",
          body:
            "The directory uses Supabase as the public layer, syncs roster and activity from official sources, and only exposes coherence when a reviewed promise exists.",
          stats: [
            { label: "Active legislators", value: statNumber(payload.meta.activeLegislators), icon: Users },
            { label: "Indexed votes", value: statNumber(payload.meta.indexedVotes), icon: Landmark },
            { label: "Average coherence", value: percentLabel(payload.meta.averageCoherence), icon: ShieldCheck },
            { label: "Visible parties", value: statNumber(parties.length), icon: Filter },
          ],
          filtersTitle: "Shareable URL filters",
          filtersIntro:
            "Filters stack on the server. Public pagination returns 24 profiles per page.",
          resultsTitle: "Current directory",
          partyTitle: "Party view",
          partyIntro:
            "Party metrics come from precomputed aggregates. If a party still has no reviewed promises, coherence stays empty instead of being guessed.",
          empty: "There is no synced data for this slice yet, or the filter left the set empty.",
          clear: "Clear filters",
          apply: "Apply filters",
          searchParty: "Party",
          searchCirc: "Constituency",
          searchCommission: "Commission",
          searchTopic: "Topic",
          searchAttendance: "Min attendance",
          searchCoherence: "Min coherence",
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
              <label htmlFor="chamber">Cámara</label>
              <select id="chamber" name="chamber" defaultValue={payload.filters.chamber ?? ""}>
                <option value="">{lang === "es" ? "Ambas" : "Both"}</option>
                <option value="senado">Senado</option>
                <option value="camara">Cámara</option>
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
            <div className={styles.emptyState}>{copy.empty}</div>
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
                  <td>{percentLabel(party.coherenceScore)}</td>
                  <td>{percentLabel(party.attendanceRate)}</td>
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
