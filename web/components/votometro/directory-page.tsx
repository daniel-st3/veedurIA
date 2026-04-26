"use client";

import Link from "next/link";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Filter, Landmark, ShieldCheck, Users, Vote, Eye, TrendingUp } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import type { Lang } from "@/lib/types";
import { VOTOMETRO_TOPICS } from "@/lib/votometro-topics";
import type {
  LegislatorListItem,
  PartySummary,
  VoteEventDetail,
  VotometroDataIssue,
  VotometroDirectoryPayload,
  VotometroFilters,
} from "@/lib/votometro-types";

import styles from "./votometro.module.css";

gsap.registerPlugin(ScrollTrigger);

/* ── Helpers ──────────────────────────────────────────────────── */

function buildHref(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function pctLabel(value: number | null, lang: Lang) {
  return value == null ? (lang === "es" ? "—" : "—") : `${Math.round(value)}%`;
}

function stat(value: number) {
  return new Intl.NumberFormat("es-CO").format(value);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
  } catch { return iso; }
}

function alignmentClass(alignment: string) {
  if (alignment === "coherente") return styles.isCoherent;
  if (alignment === "inconsistente") return styles.isInconsistent;
  if (alignment === "ausente") return styles.isAbsent;
  return styles.isNeutral;
}

function alignmentLabel(alignment: string, lang: Lang) {
  const map: Record<string, Record<Lang, string>> = {
    coherente: { es: "Coherente", en: "Coherent" },
    inconsistente: { es: "Inconsistente", en: "Inconsistent" },
    ausente: { es: "Ausente", en: "Absent" },
    "sin-promesa": { es: "Sin promesa", en: "No promise" },
  };
  return map[alignment]?.[lang] ?? alignment;
}

/* ── Sub-components ───────────────────────────────────────────── */

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

function IssuePanel({ lang, issue }: { lang: Lang; issue: VotometroDataIssue }) {
  const steps =
    issue.code === "missing_schema"
      ? lang === "es"
        ? [
            "Ejecuta scripts/setup_supabase.sql en el proyecto Supabase.",
            "Corre python scripts/sync_votometro.py --mode=daily.",
            "Verifica SUPABASE_URL y SUPABASE_SERVICE_KEY.",
          ]
        : [
            "Run scripts/setup_supabase.sql in Supabase.",
            "Run python scripts/sync_votometro.py --mode=daily.",
            "Check SUPABASE_URL and SUPABASE_SERVICE_KEY.",
          ]
      : issue.code === "missing_env"
        ? lang === "es"
          ? ["Define SUPABASE_URL.", "Define SUPABASE_SERVICE_KEY."]
          : ["Set SUPABASE_URL.", "Set SUPABASE_SERVICE_KEY."]
        : lang === "es"
          ? ["Revisa la conectividad de Supabase.", "Valida las vistas públicas."]
          : ["Check Supabase connectivity.", "Validate public views."];

  return (
    <section className={styles.alertCard}>
      <span className={styles.eyebrow}>{lang === "es" ? "Estado" : "Status"}</span>
      <h2 className={styles.alertTitle}>{issue.title}</h2>
      <p className={styles.alertBody}>{issue.message}</p>
      {issue.detail ? <p className={styles.smallMuted}>{issue.detail}</p> : null}
      <ol className={styles.alertList}>
        {steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
    </section>
  );
}

function LegislatorCard({ profile, lang }: { profile: LegislatorListItem; lang: Lang }) {
  return (
    <article className={styles.card} data-vm-animate="card">
      <div className={styles.cardTop}>
        {avatarFor(profile)}
        <div>
          <h3 className={styles.cardTitle}>{profile.canonicalName}</h3>
          <p className={styles.cardMeta}>
            {profile.roleLabel} · {profile.party}
            {profile.circunscription ? ` · ${profile.circunscription}` : ""}
          </p>
          <div className={styles.chips}>
            <span className={styles.chip}>
              {profile.chamber === "camara"
                ? lang === "es" ? "Cámara" : "House"
                : lang === "es" ? "Senado" : "Senate"}
            </span>
            {profile.commission ? <span className={styles.chip}>{profile.commission}</span> : null}
          </div>
        </div>
      </div>

      <div className={styles.metricRow}>
        <div className={styles.metricTile}>
          <strong>{pctLabel(profile.coherenceScore, lang)}</strong>
          <span>{lang === "es" ? "Coherencia" : "Coherence"}</span>
        </div>
        <div className={styles.metricTile}>
          <strong>{pctLabel(profile.attendanceRate, lang)}</strong>
          <span>{lang === "es" ? "Asistencia" : "Attendance"}</span>
        </div>
        <div className={styles.metricTile}>
          <strong>{stat(profile.votesIndexed)}</strong>
          <span>{lang === "es" ? "Votos" : "Votes"}</span>
        </div>
      </div>

      {profile.coherenceScore != null ? (
        <div className={styles.coherenceBar}>
          <span style={{ width: `${profile.coherenceScore}%` }} />
        </div>
      ) : null}

      <div className={styles.chips}>
        {profile.topTopics.length ? (
          profile.topTopics.slice(0, 3).map((topic) => (
            <span key={topic} className={`${styles.chip} ${styles.chipGood}`}>{topic}</span>
          ))
        ) : (
          <span className={`${styles.chip} ${styles.chipWarn}`}>
            {lang === "es" ? "Sin temas aún" : "No topics yet"}
          </span>
        )}
      </div>

      <Link href={`/votometro/legislador/${profile.slug}?lang=${lang}`} className={styles.inlineLink}>
        {lang === "es" ? "Ver perfil completo" : "Open full profile"}
        <ArrowRight size={15} />
      </Link>
    </article>
  );
}

function VoteFeedItem({ vote, lang }: { vote: VoteEventDetail; lang: Lang }) {
  return (
    <div className={styles.voteItem}>
      <div className={styles.voteTitle}>
        <strong>{vote.topicLabel || "—"}</strong>
        {vote.title}
      </div>
      <span className={`${styles.voteBadge} ${alignmentClass(vote.promiseAlignment)}`}>
        {vote.isAbsent ? (lang === "es" ? "Ausente" : "Absent") : alignmentLabel(vote.promiseAlignment, lang)}
      </span>
      <span className={styles.voteDate}>{formatDate(vote.voteDate)}</span>
    </div>
  );
}

function Pagination({ lang, filters, page, pageCount }: {
  lang: Lang; filters: VotometroFilters; page: number; pageCount: number;
}) {
  const base = {
    lang, chamber: filters.chamber, party: filters.party,
    circunscription: filters.circunscription, commission: filters.commission,
    topic: filters.topic, attendance_min: filters.attendanceMin, coherence_min: filters.coherenceMin,
  };
  return (
    <div className={styles.pagination}>
      <span className={styles.smallMuted}>
        {lang === "es" ? "Página" : "Page"} {page} / {pageCount}
      </span>
      <div className={styles.filterActions}>
        <Link href={buildHref("/votometro", { ...base, page: Math.max(1, page - 1) })}
          className={styles.ghostLink} aria-disabled={page <= 1}>
          {lang === "es" ? "Anterior" : "Previous"}
        </Link>
        <Link href={buildHref("/votometro", { ...base, page: Math.min(pageCount, page + 1) })}
          className={styles.ghostLink} aria-disabled={page >= pageCount}>
          {lang === "es" ? "Siguiente" : "Next"}
        </Link>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

export function VotometroDirectoryPage({
  lang, payload, parties, recentVotes, totalPublicVotes,
}: {
  lang: Lang;
  payload: VotometroDirectoryPayload;
  parties: PartySummary[];
  recentVotes: VoteEventDetail[];
  totalPublicVotes: number;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const hasVotes = payload.meta.indexedVotes > 0 || totalPublicVotes > 0;

  const coherenceValues = payload.items
    .map((i) => i.coherenceScore)
    .filter((v): v is number => v != null);
  const avgCoherence = coherenceValues.length
    ? Math.round(coherenceValues.reduce((a, b) => a + b, 0) / coherenceValues.length)
    : payload.meta.averageCoherence;

  const highCoherence = payload.items.filter((i) => (i.coherenceScore ?? 0) >= 75).length;
  const midCoherence = payload.items.filter((i) => (i.coherenceScore ?? 0) >= 50 && (i.coherenceScore ?? 0) < 75).length;
  const lowCoherence = payload.items.filter((i) => i.coherenceScore != null && (i.coherenceScore ?? 0) < 50).length;

  const copy = lang === "es" ? {
    eyebrow: hasVotes ? "Directorio vivo · 2022-2026" : "Directorio público sincronizado",
    title: hasVotes ? "El Congreso bajo la lupa, con datos reales." : "Votómetro — directorio público sincronizado",
    body: hasVotes
      ? "Cada legislador muestra votos indexados, asistencia real y coherencia programática. Los datos se actualizan diariamente desde fuentes oficiales."
      : "El directorio público ya está sincronizado. Votos, asistencia y coherencia aparecerán conforme avance la indexación.",
    statsLabels: [
      { label: "Legisladores activos", icon: Users },
      { label: "Votos indexados", icon: Landmark },
      { label: "Coherencia promedio", icon: ShieldCheck },
      { label: "Partidos visibles", icon: Filter },
    ],
    filtersTitle: "Filtros",
    resultsTitle: "Directorio",
    partyTitle: "Lectura por partido",
    votesFeedTitle: "Últimas votaciones públicas",
    votesFeedIntro: "Registro nominal reciente desde la capa pública de datos.",
    coverageTitle: "Cobertura del módulo",
    empty: "No hay datos para este corte o el filtro dejó el conjunto vacío.",
    clear: "Limpiar",
    apply: "Aplicar",
    all: "Todos",
    both: "Ambas",
    senate: "Senado",
    house: "Cámara",
    searchParty: "Partido",
    searchCirc: "Circunscripción",
    searchComm: "Comisión",
    searchTopic: "Tema",
    searchAttMin: "Asistencia mín.",
    searchCoMin: "Coherencia mín.",
    searchChamber: "Cámara",
  } : {
    eyebrow: hasVotes ? "Live directory · 2022-2026" : "Public roster synced",
    title: hasVotes ? "Congress under the lens, with real data." : "Votometer — synced public directory",
    body: hasVotes
      ? "Each legislator shows indexed votes, real attendance, and programmatic coherence. Data updates daily from official sources."
      : "The public directory is synced. Votes, attendance, and coherence will appear as indexing progresses.",
    statsLabels: [
      { label: "Active legislators", icon: Users },
      { label: "Indexed votes", icon: Landmark },
      { label: "Average coherence", icon: ShieldCheck },
      { label: "Visible parties", icon: Filter },
    ],
    filtersTitle: "Filters",
    resultsTitle: "Directory",
    partyTitle: "Party breakdown",
    votesFeedTitle: "Latest public votes",
    votesFeedIntro: "Recent nominal vote records from the public data layer.",
    coverageTitle: "Module coverage",
    empty: "No data for this slice, or the filter left the set empty.",
    clear: "Clear",
    apply: "Apply",
    all: "All",
    both: "Both",
    senate: "Senate",
    house: "House",
    searchParty: "Party",
    searchCirc: "Constituency",
    searchComm: "Commission",
    searchTopic: "Topic",
    searchAttMin: "Min attendance",
    searchCoMin: "Min coherence",
    searchChamber: "Chamber",
  };

  const statsValues = [
    stat(payload.meta.activeLegislators),
    stat(totalPublicVotes > 0 ? totalPublicVotes : payload.meta.indexedVotes),
    pctLabel(avgCoherence, lang),
    stat(parties.length),
  ];

  useGSAP(() => {
    const rm = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (rm) return;

    gsap.fromTo("[data-vm-animate='hero']", { autoAlpha: 0, y: 30 },
      { autoAlpha: 1, y: 0, duration: .75, ease: "power3.out" });

    gsap.fromTo("[data-vm-animate='stat']", { autoAlpha: 0, y: 20 },
      { autoAlpha: 1, y: 0, duration: .55, stagger: .06, ease: "power3.out", delay: .1 });

    gsap.utils.toArray<HTMLElement>("[data-vm-animate='section']").forEach((s) => {
      gsap.fromTo(s, { autoAlpha: 0, y: 32 }, {
        autoAlpha: 1, y: 0, duration: .7, ease: "power3.out",
        scrollTrigger: { trigger: s, start: "top 85%" },
      });
    });

    gsap.fromTo("[data-vm-animate='card']", { autoAlpha: 0, y: 22 }, {
      autoAlpha: 1, y: 0, duration: .5, stagger: .03, ease: "power3.out",
      scrollTrigger: { trigger: "[data-vm-animate='card']", start: "top 88%" },
    });
  }, { scope, dependencies: [payload.items.length, parties.length] });

  return (
    <div className={styles.shell} ref={scope}>
      <SiteNav lang={lang} />
      <main className={styles.main}>
        {/* ── Hero ──────────────────────────────────────── */}
        <section className={styles.hero} data-vm-animate="hero">
          <span className={styles.eyebrow}>{copy.eyebrow}</span>
          <div className={styles.heroGrid}>
            <div>
              <h1 className={styles.title}>{copy.title}</h1>
              <p className={styles.body}>{copy.body}</p>
            </div>
            <div className={styles.statsGrid}>
              {copy.statsLabels.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className={styles.statCard} data-vm-animate="stat">
                    <Icon size={18} />
                    <strong>{statsValues[i]}</strong>
                    <span>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Issue ─────────────────────────────────────── */}
        {payload.issue ? <IssuePanel lang={lang} issue={payload.issue} /> : null}

        {/* ── Coverage Cards ───────────────────────────── */}
        <section className={styles.surface} data-vm-animate="section">
          <span className={styles.eyebrow}>{copy.coverageTitle}</span>
          <div className={styles.coverageGrid} style={{ marginTop: "1rem" }}>
            <div className={styles.coverageCard}>
              <Eye size={18} style={{ color: "rgba(255,255,255,.35)" }} />
              <strong>{stat(payload.meta.activeLegislators)}</strong>
              <span>{lang === "es" ? "Legisladores visibles" : "Visible legislators"}</span>
              <p>{lang === "es" ? "Perfiles sincronizados en la capa pública" : "Profiles synced in the public layer"}</p>
            </div>
            <div className={styles.coverageCard}>
              <Vote size={18} style={{ color: "rgba(255,255,255,.35)" }} />
              <strong>{stat(totalPublicVotes > 0 ? totalPublicVotes : payload.meta.indexedVotes)}</strong>
              <span>{lang === "es" ? "Votos nominales" : "Nominal votes"}</span>
              <p>{lang === "es" ? "Registros listos para consulta" : "Records ready for query"}</p>
            </div>
            <div className={styles.coverageCard}>
              <TrendingUp size={18} style={{ color: "rgba(255,255,255,.35)" }} />
              <strong>{highCoherence}<small style={{ color: "rgba(255,255,255,.3)", fontSize: ".7em" }}> / {midCoherence} / {lowCoherence}</small></strong>
              <span>{lang === "es" ? "Alta / Media / Baja" : "High / Mid / Low"}</span>
              <p>{lang === "es" ? "Distribución de coherencia visible" : "Visible coherence distribution"}</p>
            </div>
            <div className={styles.coverageCard}>
              <Filter size={18} style={{ color: "rgba(255,255,255,.35)" }} />
              <strong>{stat(parties.length)}</strong>
              <span>{lang === "es" ? "Partidos" : "Parties"}</span>
              <p>{lang === "es" ? "Agregados partidistas calculados" : "Party aggregates computed"}</p>
            </div>
          </div>
        </section>

        {/* ── Recent Votes Feed ────────────────────────── */}
        {recentVotes.length > 0 ? (
          <section className={styles.surface} data-vm-animate="section">
            <span className={styles.eyebrow}>{lang === "es" ? "Feed en vivo" : "Live feed"}</span>
            <h2 className={styles.surfaceTitle} style={{ marginTop: ".5rem" }}>{copy.votesFeedTitle}</h2>
            <p className={styles.surfaceIntro}>{copy.votesFeedIntro}</p>
            <div className={styles.voteFeed}>
              {recentVotes.slice(0, 8).map((v) => (
                <VoteFeedItem key={v.id} vote={v} lang={lang} />
              ))}
            </div>
            {totalPublicVotes > 8 ? (
              <p className={styles.smallMuted} style={{ marginTop: ".8rem" }}>
                {stat(totalPublicVotes)} {lang === "es" ? "registros totales en capa pública" : "total records in public layer"}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* ── Filters ──────────────────────────────────── */}
        <section className={styles.surface} data-vm-animate="section">
          <h2 className={styles.surfaceTitle}>{copy.filtersTitle}</h2>
          <form method="get" className={styles.filterGrid}>
            <input type="hidden" name="lang" value={lang} />
            <div className={styles.filterField}>
              <label htmlFor="party">{copy.searchParty}</label>
              <select id="party" name="party" defaultValue={payload.filters.party ?? ""}>
                <option value="">{copy.all}</option>
                {payload.options.parties.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className={styles.filterField}>
              <label htmlFor="circunscription">{copy.searchCirc}</label>
              <select id="circunscription" name="circunscription" defaultValue={payload.filters.circunscription ?? ""}>
                <option value="">{copy.all}</option>
                {payload.options.circunscriptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className={styles.filterField}>
              <label htmlFor="commission">{copy.searchComm}</label>
              <select id="commission" name="commission" defaultValue={payload.filters.commission ?? ""}>
                <option value="">{copy.all}</option>
                {payload.options.commissions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className={styles.filterField}>
              <label htmlFor="topic">{copy.searchTopic}</label>
              <select id="topic" name="topic" defaultValue={payload.filters.topic ?? ""}>
                <option value="">{copy.all}</option>
                {VOTOMETRO_TOPICS.filter((t) => t.key !== "sin-clasificar").map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterField}>
              <label htmlFor="chamber">{copy.searchChamber}</label>
              <select id="chamber" name="chamber" defaultValue={payload.filters.chamber ?? ""}>
                <option value="">{copy.both}</option>
                <option value="senado">{copy.senate}</option>
                <option value="camara">{copy.house}</option>
              </select>
            </div>
            <div className={styles.filterField}>
              <label htmlFor="attendance_min">{copy.searchAttMin}</label>
              <input id="attendance_min" name="attendance_min" type="number" min={0} max={100} defaultValue={payload.filters.attendanceMin ?? ""} />
            </div>
            <div className={styles.filterField}>
              <label htmlFor="coherence_min">{copy.searchCoMin}</label>
              <input id="coherence_min" name="coherence_min" type="number" min={0} max={100} defaultValue={payload.filters.coherenceMin ?? ""} />
            </div>
            <div className={styles.filterActions}>
              <button type="submit" className={styles.button}>{copy.apply}</button>
              <Link href={`/votometro?lang=${lang}`} className={styles.ghostLink}>{copy.clear}</Link>
            </div>
          </form>
        </section>

        {/* ── Directory Grid ───────────────────────────── */}
        <section className={styles.surface} data-vm-animate="section">
          <h2 className={styles.surfaceTitle}>{copy.resultsTitle}</h2>
          <p className={styles.surfaceIntro}>
            {payload.meta.total} {lang === "es" ? "resultados" : "results"}
          </p>
          {payload.items.length ? (
            <>
              <div className={styles.cardsGrid}>
                {payload.items.map((p) => <LegislatorCard key={p.id} profile={p} lang={lang} />)}
              </div>
              <Pagination lang={lang} filters={payload.filters} page={payload.meta.page} pageCount={payload.meta.pageCount} />
            </>
          ) : (
            <div className={styles.emptyState}>
              {payload.issue
                ? lang === "es" ? "La capa de datos no está lista." : "Data layer is not ready."
                : copy.empty}
            </div>
          )}
        </section>

        {/* ── Party Table ──────────────────────────────── */}
        <section className={styles.surface} data-vm-animate="section">
          <h2 className={styles.surfaceTitle}>{copy.partyTitle}</h2>
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
              {parties.slice(0, 15).map((p) => (
                <tr key={p.partyKey}>
                  <td>{p.party}</td>
                  <td>{stat(p.memberCount)}</td>
                  <td>{pctLabel(p.coherenceScore, lang)}</td>
                  <td>{pctLabel(p.attendanceRate, lang)}</td>
                  <td>{stat(p.indexedVotes)}</td>
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
