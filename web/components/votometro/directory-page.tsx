"use client";

import Link from "next/link";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  Eye,
  Filter,
  Landmark,
  ShieldCheck,
  TrendingUp,
  Users,
  Vote,
} from "lucide-react";

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

/* ── Helpers ──────────────────────────────────────────── */

function buildHref(
  path: string,
  params: Record<string, string | number | undefined>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const q = search.toString();
  return q ? `${path}?${q}` : path;
}

function pct(value: number | null, lang: Lang) {
  return value == null ? "—" : `${Math.round(value)}%`;
}

function num(value: number) {
  return new Intl.NumberFormat("es-CO").format(value);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function alignClass(a: string) {
  if (a === "coherente") return styles.isCoherent;
  if (a === "inconsistente") return styles.isInconsistent;
  if (a === "ausente") return styles.isAbsent;
  return styles.isNeutral;
}

function alignLabel(a: string, lang: Lang) {
  const m: Record<string, Record<Lang, string>> = {
    coherente: { es: "Coherente", en: "Coherent" },
    inconsistente: { es: "Inconsistente", en: "Inconsistent" },
    ausente: { es: "Ausente", en: "Absent" },
    "sin-promesa": { es: "Sin promesa", en: "No promise" },
  };
  return m[a]?.[lang] ?? a;
}

/* ── Sub-components ───────────────────────────────────── */

function Avatar({ p }: { p: LegislatorListItem }) {
  if (p.imageUrl) {
    return (
      <div className={styles.avatar}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.imageUrl} alt={p.canonicalName} />
      </div>
    );
  }
  return <div className={styles.avatarPlaceholder}>{p.initials}</div>;
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
          ? [
              "Revisa la conectividad de Supabase.",
              "Valida las vistas públicas.",
            ]
          : ["Check Supabase connectivity.", "Validate public views."];

  return (
    <section className={styles.alertCard}>
      <span className={styles.eyebrow}>
        {lang === "es" ? "Estado" : "Status"}
      </span>
      <h2 className={styles.alertTitle}>{issue.title}</h2>
      <p className={styles.alertBody}>{issue.message}</p>
      {issue.detail ? (
        <p className={styles.smallMuted}>{issue.detail}</p>
      ) : null}
      <ol className={styles.alertList}>
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </section>
  );
}

function Card({ p, lang }: { p: LegislatorListItem; lang: Lang }) {
  const hasData =
    p.votesIndexed > 0 ||
    p.coherenceScore != null ||
    p.attendanceRate != null;
  return (
    <article className={styles.card} data-vm="card">
      <div className={styles.cardTop}>
        <Avatar p={p} />
        <div>
          <h3 className={styles.cardTitle}>{p.canonicalName}</h3>
          <p className={styles.cardMeta}>
            {p.roleLabel} · {p.party}
            {p.circunscription ? ` · ${p.circunscription}` : ""}
          </p>
          <div className={styles.chips}>
            <span className={styles.chip}>
              {p.chamber === "camara"
                ? lang === "es"
                  ? "Cámara"
                  : "House"
                : lang === "es"
                  ? "Senado"
                  : "Senate"}
            </span>
            {p.commission ? (
              <span className={styles.chip}>{p.commission}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.metricRow}>
        <div className={styles.metricTile}>
          <strong>{pct(p.coherenceScore, lang)}</strong>
          <span>{lang === "es" ? "Coherencia" : "Coherence"}</span>
        </div>
        <div className={styles.metricTile}>
          <strong>{pct(p.attendanceRate, lang)}</strong>
          <span>{lang === "es" ? "Asistencia" : "Attendance"}</span>
        </div>
        <div className={styles.metricTile}>
          <strong>{num(p.votesIndexed)}</strong>
          <span>{lang === "es" ? "Votos" : "Votes"}</span>
        </div>
      </div>

      {p.coherenceScore != null ? (
        <div className={styles.coherenceBar}>
          <span style={{ width: `${p.coherenceScore}%` }} />
        </div>
      ) : null}

      <div className={styles.chips}>
        {p.topTopics.length
          ? p.topTopics
              .slice(0, 3)
              .map((t) => (
                <span
                  key={t}
                  className={`${styles.chip} ${styles.chipGood}`}
                >
                  {t}
                </span>
              ))
          : hasData
            ? null
            : (
              <span className={`${styles.chip} ${styles.chipWarn}`}>
                {lang === "es"
                  ? "Pendiente de indexación"
                  : "Pending indexation"}
              </span>
            )}
      </div>

      <Link
        href={`/votometro/legislador/${p.slug}?lang=${lang}`}
        className={styles.inlineLink}
      >
        {lang === "es" ? "Ver perfil completo" : "Open full profile"}
        <ArrowRight size={15} />
      </Link>
    </article>
  );
}

function FeedItem({ v, lang }: { v: VoteEventDetail; lang: Lang }) {
  return (
    <div className={styles.voteItem} data-vm="vote">
      <div className={styles.voteTitle}>
        <strong>{v.topicLabel || "—"}</strong>
        {v.title}
      </div>
      <span
        className={`${styles.voteBadge} ${alignClass(v.promiseAlignment)}`}
      >
        {v.isAbsent
          ? lang === "es"
            ? "Ausente"
            : "Absent"
          : alignLabel(v.promiseAlignment, lang)}
      </span>
      <span className={styles.voteDate}>{fmtDate(v.voteDate)}</span>
    </div>
  );
}

function Nav({
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
  const b = {
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
          href={buildHref("/votometro", {
            ...b,
            page: Math.max(1, page - 1),
          })}
          className={styles.ghostLink}
          aria-disabled={page <= 1}
        >
          {lang === "es" ? "← Anterior" : "← Previous"}
        </Link>
        <Link
          href={buildHref("/votometro", {
            ...b,
            page: Math.min(pageCount, page + 1),
          })}
          className={styles.ghostLink}
          aria-disabled={page >= pageCount}
        >
          {lang === "es" ? "Siguiente →" : "Next →"}
        </Link>
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────── */

export function VotometroDirectoryPage({
  lang,
  payload,
  parties,
  recentVotes,
  totalPublicVotes,
}: {
  lang: Lang;
  payload: VotometroDirectoryPayload;
  parties: PartySummary[];
  recentVotes: VoteEventDetail[];
  totalPublicVotes: number;
}) {
  const scope = useRef<HTMLDivElement>(null);

  const totalVotes =
    totalPublicVotes > 0
      ? totalPublicVotes
      : payload.meta.indexedVotes;

  const coherenceVals = payload.items
    .map((i) => i.coherenceScore)
    .filter((v): v is number => v != null);
  const avgC = coherenceVals.length
    ? Math.round(
        coherenceVals.reduce((a, b) => a + b, 0) / coherenceVals.length,
      )
    : payload.meta.averageCoherence;

  const highC = payload.items.filter(
    (i) => (i.coherenceScore ?? 0) >= 75,
  ).length;
  const midC = payload.items.filter(
    (i) =>
      (i.coherenceScore ?? 0) >= 50 && (i.coherenceScore ?? 0) < 75,
  ).length;
  const lowC = payload.items.filter(
    (i) => i.coherenceScore != null && (i.coherenceScore ?? 0) < 50,
  ).length;

  /* ── Derived analysis: chamber + commission breakdowns ─────────────── */
  const senateCount = payload.items.filter((i) => i.chamber === "senado").length;
  const houseCount = payload.items.filter((i) => i.chamber === "camara").length;
  const totalChamber = senateCount + houseCount;

  const commissionCountsMap = new Map<string, number>();
  for (const i of payload.items) {
    const key = i.commission?.trim() || "Sin comisión";
    commissionCountsMap.set(key, (commissionCountsMap.get(key) ?? 0) + 1);
  }
  const commissionCounts = [...commissionCountsMap.entries()]
    .map(([commission, count]) => ({ commission, count }))
    .sort((a, b) => b.count - a.count);

  const partiesSorted = [...parties].sort((a, b) => b.memberCount - a.memberCount);
  const maxPartyMembers = Math.max(1, ...partiesSorted.map((p) => p.memberCount));
  const maxCommissionCount = Math.max(1, ...commissionCounts.map((c) => c.count));

  /* ── Copy ────────────────────────────────────────────── */
  const es = lang === "es";
  const c = {
    eyebrow: es
      ? `Directorio legislativo · ${num(payload.meta.activeLegislators)} perfiles sincronizados`
      : `Legislative directory · ${num(payload.meta.activeLegislators)} synced profiles`,
    title: es
      ? "¿Votaron como prometieron?"
      : "Did they vote as promised?",
    body: es
      ? "Directorio vivo de legisladores colombianos con votos, asistencia y coherencia programática. Los datos se actualizan diariamente desde fuentes oficiales del Congreso."
      : "Live directory of Colombian legislators with votes, attendance, and programmatic coherence. Data updates daily from official Congressional sources.",
    stats: [
      { label: es ? "Legisladores activos" : "Active legislators", icon: Users },
      { label: es ? "Votos nominales" : "Nominal votes", icon: Landmark },
      { label: es ? "Coherencia promedio" : "Average coherence", icon: ShieldCheck },
      { label: es ? "Partidos visibles" : "Visible parties", icon: Filter },
    ] as const,
    coverage: es ? "Cobertura del módulo" : "Module coverage",
    feedTitle: es ? "Últimas votaciones públicas" : "Latest public votes",
    feedIntro: es
      ? "Registro nominal reciente desde la capa pública de datos."
      : "Recent nominal vote records from the public data layer.",
    filtersTitle: es ? "Filtros" : "Filters",
    resultsTitle: es ? "Directorio" : "Directory",
    partyTitle: es ? "Lectura por partido" : "Party breakdown",
    empty: es
      ? "No hay datos para este corte. Ajusta los filtros o espera la próxima sincronización."
      : "No data for this slice. Adjust filters or wait for the next sync.",
    apply: es ? "Aplicar" : "Apply",
    clear: es ? "Limpiar" : "Clear",
    all: es ? "Todos" : "All",
    both: es ? "Ambas" : "Both",
    senate: es ? "Senado" : "Senate",
    house: es ? "Cámara" : "House",
  };

  const sv = [
    num(payload.meta.activeLegislators),
    totalVotes > 0 ? num(totalVotes) : es ? "Pendiente" : "Pending",
    pct(avgC, lang),
    num(parties.length),
  ];

  /* ── GSAP ────────────────────────────────────────────── */
  useGSAP(
    () => {
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;

      /* Hero entrance — cinematic stagger */
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(
        "[data-vm='eyebrow']",
        { autoAlpha: 0, y: 18, filter: "blur(6px)" },
        { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.55 },
      )
        .fromTo(
          "[data-vm='title']",
          { autoAlpha: 0, y: 36, filter: "blur(8px)" },
          { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.75 },
          "-=0.3",
        )
        .fromTo(
          "[data-vm='body']",
          { autoAlpha: 0, y: 22 },
          { autoAlpha: 1, y: 0, duration: 0.6 },
          "-=0.4",
        )
        .fromTo(
          "[data-vm='stat']",
          { autoAlpha: 0, y: 26, scale: 0.94 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.55,
            stagger: 0.08,
            ease: "back.out(1.3)",
          },
          "-=0.3",
        );

      /* Hero parallax on scroll */
      const heroEl = scope.current?.querySelector("[data-vm='hero']");
      if (heroEl) {
        gsap.to(heroEl, {
          yPercent: -8,
          ease: "none",
          scrollTrigger: {
            trigger: heroEl,
            start: "top top",
            end: "bottom top",
            scrub: 0.6,
          },
        });
      }

      /* Scroll-triggered sections — stagger with blur */
      gsap.utils
        .toArray<HTMLElement>("[data-vm='section']")
        .forEach((el) => {
          gsap.fromTo(
            el,
            { autoAlpha: 0, y: 50, filter: "blur(4px)" },
            {
              autoAlpha: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: {
                trigger: el,
                start: "top 88%",
                toggleActions: "play none none none",
              },
            },
          );
        });

      /* Coverage cards cascade */
      ScrollTrigger.batch("[data-vm='coverage']", {
        onEnter: (batch) =>
          gsap.fromTo(
            batch,
            { autoAlpha: 0, y: 30, scale: 0.95 },
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              stagger: 0.06,
              duration: 0.6,
              ease: "back.out(1.2)",
            },
          ),
        start: "top 90%",
      });

      /* Staggered card entrance */
      ScrollTrigger.batch("[data-vm='card']", {
        onEnter: (batch) =>
          gsap.fromTo(
            batch,
            { autoAlpha: 0, y: 32, scale: 0.96 },
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              stagger: 0.05,
              duration: 0.6,
              ease: "power3.out",
            },
          ),
        start: "top 90%",
      });

      /* Table rows slide in */
      ScrollTrigger.batch("[data-vm='row']", {
        onEnter: (batch) =>
          gsap.fromTo(
            batch,
            { autoAlpha: 0, x: -16 },
            {
              autoAlpha: 1,
              x: 0,
              stagger: 0.04,
              duration: 0.45,
              ease: "power2.out",
            },
          ),
        start: "top 92%",
      });

      /* Vote feed items */
      ScrollTrigger.batch("[data-vm='vote']", {
        onEnter: (batch) =>
          gsap.fromTo(
            batch,
            { autoAlpha: 0, x: 20 },
            {
              autoAlpha: 1,
              x: 0,
              stagger: 0.04,
              duration: 0.45,
              ease: "power2.out",
            },
          ),
        start: "top 92%",
      });
    },
    {
      scope,
      dependencies: [payload.items.length, parties.length],
    },
  );

  return (
    <div className={styles.shell} ref={scope}>
      <SiteNav lang={lang} />
      <main className={styles.main}>
        {/* ── Hero ───────────────────────────────── */}
        <section className={styles.hero} data-vm="hero">
          <span className={styles.eyebrow} data-vm="eyebrow">
            {c.eyebrow}
          </span>
          <div className={styles.heroGrid}>
            <div>
              <h1 className={styles.title} data-vm="title">
                {c.title}
              </h1>
              <p className={styles.body} data-vm="body">
                {c.body}
              </p>
            </div>
            <div className={styles.statsGrid}>
              {c.stats.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.label}
                    className={styles.statCard}
                    data-vm="stat"
                  >
                    <Icon size={18} />
                    <strong>{sv[i]}</strong>
                    <span>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Issue ──────────────────────────────── */}
        {payload.issue ? (
          <IssuePanel lang={lang} issue={payload.issue} />
        ) : null}

        {/* ── Coverage ──────────────────────────── */}
        <section className={styles.surface} data-vm="section">
          <span className={styles.eyebrow}>{c.coverage}</span>
          <div
            className={styles.coverageGrid}
            style={{ marginTop: "1rem" }}
          >
            <div className={styles.coverageCard} data-vm="coverage">
              <Eye size={18} />
              <strong>{num(payload.meta.activeLegislators)}</strong>
              <span>
                {es ? "Legisladores visibles" : "Visible legislators"}
              </span>
              <p>
                {es
                  ? "Perfiles sincronizados en la capa pública"
                  : "Profiles synced in the public layer"}
              </p>
            </div>
            <div className={styles.coverageCard} data-vm="coverage">
              <Vote size={18} />
              <strong>
                {totalVotes > 0
                  ? num(totalVotes)
                  : es
                    ? "Pendiente"
                    : "Pending"}
              </strong>
              <span>{es ? "Votos nominales" : "Nominal votes"}</span>
              <p>
                {totalVotes > 0
                  ? es
                    ? "Registros listos para consulta"
                    : "Records ready for query"
                  : es
                    ? "Se poblarán con la siguiente sincronización"
                    : "Will populate on next sync"}
              </p>
            </div>
            <div className={styles.coverageCard} data-vm="coverage">
              <TrendingUp size={18} />
              <strong>
                {highC}
                <small
                  style={{
                    color: "var(--text-m, rgba(12,19,34,.44))",
                    fontSize: ".7em",
                  }}
                >
                  {" "}
                  / {midC} / {lowC}
                </small>
              </strong>
              <span>{es ? "Alta / Media / Baja" : "High / Mid / Low"}</span>
              <p>
                {es
                  ? "Distribución de coherencia visible"
                  : "Visible coherence distribution"}
              </p>
            </div>
            <div className={styles.coverageCard} data-vm="coverage">
              <Filter size={18} />
              <strong>{num(parties.length)}</strong>
              <span>{es ? "Partidos" : "Parties"}</span>
              <p>
                {es
                  ? "Agregados partidistas calculados"
                  : "Party aggregates computed"}
              </p>
            </div>
          </div>
        </section>

        {/* ── Vote feed ─────────────────────────── */}
        {recentVotes.length > 0 ? (
          <section className={styles.surface} data-vm="section">
            <span className={styles.eyebrow}>
              {es ? "Feed en vivo" : "Live feed"}
            </span>
            <h2
              className={styles.surfaceTitle}
              style={{ marginTop: ".5rem" }}
            >
              {c.feedTitle}
            </h2>
            <p className={styles.surfaceIntro}>{c.feedIntro}</p>
            <div className={styles.voteFeed}>
              {recentVotes.slice(0, 8).map((v) => (
                <FeedItem key={v.id} v={v} lang={lang} />
              ))}
            </div>
            {totalPublicVotes > 8 ? (
              <p
                className={styles.smallMuted}
                style={{ marginTop: ".8rem" }}
              >
                {num(totalPublicVotes)}{" "}
                {es
                  ? "registros totales en capa pública"
                  : "total records in public layer"}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* ── Filters ───────────────────────────── */}
        <section className={styles.surface} data-vm="section">
          <h2 className={styles.surfaceTitle}>{c.filtersTitle}</h2>
          <form method="get" className={styles.filterGrid}>
            <input type="hidden" name="lang" value={lang} />
            <div className={styles.filterField}>
              <label htmlFor="vt-party">
                {es ? "Partido" : "Party"}
              </label>
              <select
                id="vt-party"
                name="party"
                defaultValue={payload.filters.party ?? ""}
              >
                <option value="">{c.all}</option>
                {payload.options.parties.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.filterField}>
              <label htmlFor="vt-circ">
                {es ? "Circunscripción" : "Constituency"}
              </label>
              <select
                id="vt-circ"
                name="circunscription"
                defaultValue={payload.filters.circunscription ?? ""}
              >
                <option value="">{c.all}</option>
                {payload.options.circunscriptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.filterField}>
              <label htmlFor="vt-comm">
                {es ? "Comisión" : "Commission"}
              </label>
              <select
                id="vt-comm"
                name="commission"
                defaultValue={payload.filters.commission ?? ""}
              >
                <option value="">{c.all}</option>
                {payload.options.commissions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.filterField}>
              <label htmlFor="vt-chamber">
                {es ? "Cámara" : "Chamber"}
              </label>
              <select
                id="vt-chamber"
                name="chamber"
                defaultValue={payload.filters.chamber ?? ""}
              >
                <option value="">{c.both}</option>
                <option value="senado">{c.senate}</option>
                <option value="camara">{c.house}</option>
              </select>
            </div>
            <div className={styles.filterActions}>
              <button type="submit" className={styles.button}>
                {c.apply}
              </button>
              <Link
                href={`/votometro?lang=${lang}`}
                className={styles.ghostLink}
              >
                {c.clear}
              </Link>
            </div>
          </form>
        </section>

        {/* ── Directory ─────────────────────────── */}
        <section className={styles.surface} data-vm="section">
          <h2 className={styles.surfaceTitle}>{c.resultsTitle}</h2>
          <p className={styles.surfaceIntro}>
            {payload.meta.total}{" "}
            {es ? "resultados" : "results"}
          </p>
          {payload.items.length ? (
            <>
              <div className={styles.cardsGrid}>
                {payload.items.map((p) => (
                  <Card key={p.id} p={p} lang={lang} />
                ))}
              </div>
              <Nav
                lang={lang}
                filters={payload.filters}
                page={payload.meta.page}
                pageCount={payload.meta.pageCount}
              />
            </>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateTitle}>
                {payload.issue
                  ? es
                    ? "Capa de datos en preparación"
                    : "Data layer loading"
                  : es
                    ? "Sin resultados para este filtro"
                    : "No results for this filter"}
              </div>
              <p className={styles.emptyStateBody}>
                {payload.issue
                  ? es
                    ? "Los datos se actualizarán con la próxima sincronización automática."
                    : "Data will update on the next automatic sync."
                  : c.empty}
              </p>
            </div>
          )}
        </section>

        {/* ── Party table ───────────────────────── */}
        {parties.length > 0 ? (
          <section className={styles.surface} data-vm="section">
            <h2 className={styles.surfaceTitle}>{c.partyTitle}</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{es ? "Partido" : "Party"}</th>
                  <th>{es ? "Miembros" : "Members"}</th>
                  <th>{es ? "Coherencia" : "Coherence"}</th>
                  <th>{es ? "Asistencia" : "Attendance"}</th>
                  <th>{es ? "Votos" : "Votes"}</th>
                </tr>
              </thead>
              <tbody>
                {parties.slice(0, 20).map((p) => (
                  <tr key={p.partyKey} data-vm="row">
                    <td style={{ fontWeight: 600 }}>{p.party}</td>
                    <td>{num(p.memberCount)}</td>
                    <td>{pct(p.coherenceScore, lang)}</td>
                    <td>{pct(p.attendanceRate, lang)}</td>
                    <td>{num(p.indexedVotes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {/* ── Composición política — derived analysis section ───────── */}
        {totalChamber > 0 ? (
          <section className={styles.surface} data-vm="section">
            <span className={styles.eyebrow}>
              {es ? "Lectura agregada" : "Aggregate reading"}
            </span>
            <h2 className={styles.surfaceTitle} style={{ marginTop: ".5rem" }}>
              {es ? "Composición política del directorio" : "Political composition of the directory"}
            </h2>
            <p className={styles.surfaceIntro}>
              {es
                ? "Cómo se distribuyen los legisladores indexados por cámara, partido y comisión. Calculado en tiempo real desde la capa pública."
                : "How indexed legislators distribute across chamber, party, and commission. Computed live from the public layer."}
            </p>

            <div className={styles.analysisGrid}>
              {/* Chamber donut */}
              <div className={styles.analysisCard}>
                <span className={styles.eyebrow}>
                  {es ? "Cámara" : "Chamber"}
                </span>
                <div className={styles.donutWrap}>
                  <svg
                    viewBox="0 0 120 120"
                    className={styles.donutSvg}
                    role="img"
                    aria-label={
                      es
                        ? `${senateCount} senadores y ${houseCount} representantes`
                        : `${senateCount} senators and ${houseCount} representatives`
                    }
                  >
                    {(() => {
                      const r = 50;
                      const c2 = 2 * Math.PI * r;
                      const senatePct = senateCount / totalChamber;
                      const senateLen = c2 * senatePct;
                      const housePct = houseCount / totalChamber;
                      const houseLen = c2 * housePct;
                      return (
                        <g transform="translate(60 60) rotate(-90)">
                          <circle r={r} fill="none" stroke="rgba(13,91,215,0.85)" strokeWidth="14" strokeDasharray={`${senateLen} ${c2 - senateLen}`} />
                          <circle r={r} fill="none" stroke="rgba(245,197,24,0.9)" strokeWidth="14" strokeDasharray={`${houseLen} ${c2 - houseLen}`} strokeDashoffset={-senateLen} />
                          <circle r={r - 22} fill="rgba(255,255,255,0.7)" />
                        </g>
                      );
                    })()}
                    <text x="60" y="58" textAnchor="middle" fontFamily="Sora, sans-serif" fontSize="22" fontWeight="800" fill="#0c1322">{totalChamber}</text>
                    <text x="60" y="74" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="9" fontWeight="600" fill="rgba(12,19,34,0.55)" letterSpacing="0.08em">{es ? "PERFILES" : "PROFILES"}</text>
                  </svg>
                </div>
                <ul className={styles.legendList}>
                  <li>
                    <i style={{ background: "rgba(13,91,215,0.85)" }} />
                    <span>{es ? "Senado" : "Senate"}</span>
                    <strong>{senateCount} ({Math.round((senateCount / totalChamber) * 100)}%)</strong>
                  </li>
                  <li>
                    <i style={{ background: "rgba(245,197,24,0.9)" }} />
                    <span>{es ? "Cámara" : "House"}</span>
                    <strong>{houseCount} ({Math.round((houseCount / totalChamber) * 100)}%)</strong>
                  </li>
                </ul>
              </div>

              {/* Party bar visualization */}
              <div className={styles.analysisCard}>
                <span className={styles.eyebrow}>
                  {es ? "Distribución por partido" : "Party distribution"}
                </span>
                <ul className={styles.partyBarList}>
                  {partiesSorted.slice(0, 9).map((p) => {
                    const pctW = (p.memberCount / maxPartyMembers) * 100;
                    return (
                      <li key={p.partyKey} className={styles.partyBarRow}>
                        <span className={styles.partyBarLabel}>{p.party}</span>
                        <span className={styles.partyBarTrack}>
                          <span
                            className={styles.partyBarFill}
                            style={{
                              width: `${pctW}%`,
                              background: `linear-gradient(90deg, var(--pulse-line, rgba(13,91,215,.8)) 0%, rgba(13,91,215,.55) 100%)`,
                            }}
                          />
                        </span>
                        <strong className={styles.partyBarCount}>{p.memberCount}</strong>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Commission distribution */}
              <div className={styles.analysisCard}>
                <span className={styles.eyebrow}>
                  {es ? "Comisiones" : "Commissions"}
                </span>
                <ul className={styles.partyBarList}>
                  {commissionCounts.slice(0, 8).map((row) => {
                    const pctW = (row.count / maxCommissionCount) * 100;
                    return (
                      <li key={row.commission} className={styles.partyBarRow}>
                        <span className={styles.partyBarLabel}>{row.commission}</span>
                        <span className={styles.partyBarTrack}>
                          <span
                            className={styles.partyBarFill}
                            style={{
                              width: `${pctW}%`,
                              background: `linear-gradient(90deg, rgba(198,40,57,.78) 0%, rgba(198,40,57,.45) 100%)`,
                            }}
                          />
                        </span>
                        <strong className={styles.partyBarCount}>{row.count}</strong>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <p className={styles.smallMuted} style={{ marginTop: "1rem" }}>
              {es
                ? "Los porcentajes y conteos se recalculan automáticamente cada vez que la sincronización agrega o retira un perfil del directorio público."
                : "Percentages and counts recompute on every sync that adds or removes a profile from the public directory."}
            </p>
          </section>
        ) : null}
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
