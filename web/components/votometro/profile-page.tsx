"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CircleDot,
  GraduationCap,
  HeartPulse,
  Leaf,
  Mail,
  Phone,
  PiggyBank,
  Scale,
  Shield,
  ShieldAlert,
  TrendingUp,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, useState } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { LegislatorStatBlock } from "@/components/votometro/legislator-stat-block";
import type { Lang } from "@/lib/types";
import type { LegislatorProfile, TopicScore, VotometroDataIssue } from "@/lib/votometro-types";

// Topic icon registry. Keys match VotometroTopicKey + a few common backend
// alternates ("infraestructura", "medio-ambiente"). Falls back to CircleDot.
const TOPIC_ICONS: Record<string, LucideIcon> = {
  salud: HeartPulse,
  paz: Shield,
  justicia: Scale,
  pensiones: PiggyBank,
  economia: TrendingUp,
  "economía": TrendingUp,
  ambiente: Leaf,
  "medio-ambiente": Leaf,
  "medio ambiente": Leaf,
  presupuesto: Wallet,
  derechos: Scale,
  energia: Zap,
  "energía": Zap,
  anticorrupcion: ShieldAlert,
  educacion: GraduationCap,
  "educación": GraduationCap,
  seguridad: Shield,
  infraestructura: Building2,
  otros: CircleDot,
  "sin-clasificar": CircleDot,
};

import styles from "./votometro.module.css";

gsap.registerPlugin(ScrollTrigger);

function percentLabel(value: number | null, lang: Lang) {
  return value == null ? (lang === "es" ? "Sin revisar" : "Not reviewed") : `${Math.round(value)}%`;
}

function statNumber(value: number) {
  return new Intl.NumberFormat("es-CO").format(value);
}

type TopicInsight = TopicScore & {
  coherent?: number;
  coherentVotes?: number;
  coherentes?: number;
  inconsistent?: number;
  inconsistentVotes?: number;
  inconsistentes?: number;
  absent?: number;
  absentVotes?: number;
  ausencias?: number;
  ausente?: number;
  total?: number;
};

function topicIconFor(topic: TopicInsight) {
  const key = `${topic.key || topic.label || ""}`
    .trim()
    .toLocaleLowerCase("es-CO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, "-");
  return TOPIC_ICONS[key] ?? TOPIC_ICONS[topic.key] ?? TOPIC_ICONS[topic.label] ?? CircleDot;
}

function topicCounts(topic: TopicInsight) {
  const total = Math.max(0, Math.round(topic.total ?? topic.votes ?? 0));
  const coherent = Math.max(0, Math.round(topic.coherent ?? topic.coherentVotes ?? topic.coherentes ?? 0));
  const inconsistent = Math.max(0, Math.round(topic.inconsistent ?? topic.inconsistentVotes ?? topic.inconsistentes ?? 0));
  const absent = Math.max(0, Math.round(topic.absent ?? topic.absentVotes ?? topic.ausencias ?? topic.ausente ?? 0));

  if (coherent + inconsistent + absent > 0) {
    const countedTotal = coherent + inconsistent + absent;
    return {
      coherent,
      inconsistent,
      absent: total > countedTotal ? absent + (total - countedTotal) : absent,
      total: Math.max(total, countedTotal),
    };
  }

  const score = typeof topic.score === "number" ? Math.max(0, Math.min(100, topic.score)) : null;
  if (score == null || total === 0) return { coherent: 0, inconsistent: 0, absent: total, total };
  const inferredCoherent = Math.round((score / 100) * total);
  return {
    coherent: inferredCoherent,
    inconsistent: Math.max(0, total - inferredCoherent),
    absent: 0,
    total,
  };
}

function voteChipLabel(value: string, lang: Lang) {
  const normalized = value.trim().toUpperCase();
  if (normalized === "SI" || normalized === "SÍ" || normalized === "YES") return lang === "es" ? "Sí" : "Yes";
  if (normalized === "NO") return "No";
  if (normalized === "AUSENTE" || normalized === "ABSENT") return lang === "es" ? "Ausente" : "Absent";
  if (normalized === "IMPEDIDO" || normalized === "CONFLICT") return lang === "es" ? "Impedido" : "Conflict";
  return value || (lang === "es" ? "Sin dato" : "No data");
}

function voteChipTone(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized === "SI" || normalized === "SÍ" || normalized === "YES") return "rgba(10,122,78,0.12)";
  if (normalized === "NO") return "rgba(161,44,123,0.12)";
  return "rgba(12,19,34,0.08)";
}

function localizedChamberLabel(chamber: LegislatorProfile["chamber"], lang: Lang) {
  if (lang === "es") {
    return chamber === "camara" ? "Cámara de Representantes" : "Senado";
  }
  return chamber === "camara" ? "House of Representatives" : "Senate";
}

function localizedRoleLabel(profile: LegislatorProfile, lang: Lang) {
  if (lang === "es") return profile.roleLabel;
  return profile.chamber === "camara" ? "Representative" : "Senator";
}

function localizedStatus(status: LegislatorProfile["status"], lang: Lang) {
  if (lang === "es") return status;
  const labels: Record<LegislatorProfile["status"], string> = {
    Activo: "Active",
    Retirado: "Retired",
    Fallecido: "Deceased",
    Histórico: "Historical",
    Suspendido: "Suspended",
    Exsenador: "Former senator",
    Exrepresentante: "Former representative",
    "En revisión": "Under review",
  };
  return labels[status] ?? status;
}

const PROFILE_PARTY_GRADIENTS: Record<string, [string, string]> = {
  "alianza-verde":       ["#0a7a4e", "#0d9968"],
  "cambio-radical":      ["#c62839", "#e64457"],
  "centro-democratico":  ["#0d3a8a", "#1f5fc4"],
  "colombia-humana":     ["#c47d18", "#e6a035"],
  "partido-conservador": ["#1f4185", "#2f5fb8"],
  "partido-de-la-u":     ["#0f4eaa", "#2f7cff"],
  "partido-u":           ["#0f4eaa", "#2f7cff"],
  "partido-liberal":     ["#b81f1f", "#dd3737"],
  "polo-democratico":    ["#d3a21a", "#e8bb35"],
  "union-patriotica":    ["#9a1622", "#c12a3a"],
  "pacto-historico":     ["#c47d18", "#e89c2f"],
  "sin-partido":         ["#172033", "#3b4a68"],
};

function avatar(profile: LegislatorProfile) {
  if (profile.imageUrl) {
    return (
      <div className={styles.profileAvatar}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={profile.imageUrl} alt={profile.canonicalName} />
      </div>
    );
  }
  const [c1, c2] = PROFILE_PARTY_GRADIENTS[profile.partyKey] ?? PROFILE_PARTY_GRADIENTS["sin-partido"];
  return (
    <div
      className={styles.profileAvatarPlaceholder}
      style={{ background: `linear-gradient(140deg, ${c1}, ${c2})` }}
      aria-label={profile.canonicalName}
    >
      {profile.initials}
    </div>
  );
}

export function VotometroProfilePage({
  lang,
  profile,
  issue,
}: {
  lang: Lang;
  profile: LegislatorProfile | null;
  issue: VotometroDataIssue | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [votePage, setVotePage] = useState(0);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(
        `.${styles.hero}`,
        { autoAlpha: 0, y: 30 },
        { autoAlpha: 1, y: 0, duration: 0.8 },
      );

      gsap.utils.toArray<HTMLElement>(`.${styles.surface}, .${styles.tableSurface}`).forEach((el, i) => {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 25 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
            },
          }
        );
      });

      gsap.to("[data-vote-pipeline-dot]", {
        scale: 1.35,
        opacity: 0.35,
        repeat: -1,
        yoyo: true,
        duration: 0.9,
        stagger: 0.16,
        ease: "power1.inOut",
      });
    },
    { scope: containerRef, dependencies: [profile] }
  );

  if (!profile) {
    return (
      <div className={styles.shell} ref={containerRef}>
        <SiteNav lang={lang} />
        <main className={styles.main}>
          <section className={styles.alertCard}>
            <span className={styles.eyebrow}>
              {lang === "es" ? "Perfil individual" : "Individual profile"}
            </span>
            <h1 className={styles.alertTitle}>
              {issue?.title ?? (lang === "es" ? "Perfil no disponible" : "Profile unavailable")}
            </h1>
            <p className={styles.alertBody}>
              {issue?.message ??
                (lang === "es"
                  ? "El legislador solicitado no existe en este corte público."
                  : "The requested legislator is not available in this public slice.")}
            </p>
            {issue?.detail ? (
              <p className={styles.smallMuted}>
                {lang === "es" ? "Detalle técnico" : "Technical detail"}: {issue.detail}
              </p>
            ) : null}
            <Link href={`/votometro?lang=${lang}`} className={styles.inlineLink}>
              {lang === "es" ? "Volver al directorio" : "Back to directory"}
            </Link>
          </section>
        </main>
        <SiteFooter lang={lang} />
      </div>
    );
  }

  const sortedTopicScores = [...profile.topicScores]
    .filter((topic) => (topic.votes ?? 0) > 0)
    .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)) as TopicInsight[];
  const visibleTopicScores = showAllTopics ? sortedTopicScores : sortedTopicScores.slice(0, 5);
  const votePageSize = 15;
  const votePageCount = Math.max(1, Math.ceil(profile.recentVotes.length / votePageSize));
  const safeVotePage = Math.min(votePage, votePageCount - 1);
  const pagedRecentVotes = profile.recentVotes.slice(
    safeVotePage * votePageSize,
    safeVotePage * votePageSize + votePageSize,
  );
  const hasTopicInsights = sortedTopicScores.length > 0;
  const hasRecentVotes = profile.recentVotes.length > 0;

  return (
    <div className={styles.shell} ref={containerRef}>
      <SiteNav lang={lang} />
      <section className={styles.hero}>
        <span className={styles.eyebrow}>
          {lang === "es" ? "Perfil individual" : "Individual profile"}
        </span>
        <div className={styles.profileHero}>
          {avatar(profile)}
          <div>
            <div className={styles.profileTop}>
              <h1 className={styles.profileName}>{profile.canonicalName}</h1>
              {(() => {
                const raw = String(profile.status ?? "").trim();
                const isUninformative = raw === "" || /revisi[óo]n/i.test(raw);
                if (isUninformative) return null;
                return (
                  <span className={`${styles.statusBadge} ${profile.status === "Fallecido" ? styles.statusBadgeMuted : ""}`}>
                    {localizedStatus(profile.status, lang)}
                  </span>
                );
              })()}
              <span className={styles.chip}>{localizedChamberLabel(profile.chamber, lang)}</span>
              <span className={`${styles.chip} ${styles.chipGood}`}>{profile.party}</span>
            </div>
            <p className={styles.profileMeta}>
              {localizedRoleLabel(profile, lang)}
              {profile.circunscription ? ` · ${profile.circunscription}` : ""}
              {profile.commission ? ` · ${profile.commission}` : ""}
            </p>
            {(() => {
              const cleaned = (profile.bio ?? "")
                .replace(/,?\s*hijo del ex presidente Ernesto Samper\.?/gi, "")
                .replace(/[\s,;:·]+$/g, "")
                .trim();
              const isUsable = cleaned.length >= 20 && /[a-záéíóúñ]\b\.?$/i.test(cleaned);
              return isUsable ? (
                <p className={styles.body}>{cleaned.endsWith(".") ? cleaned : `${cleaned}.`}</p>
              ) : (
                <p className={`${styles.body} ${styles.smallMuted}`}>
                  {lang === "es"
                    ? "Sin biografía pública verificada para este perfil."
                    : "No verified public bio available for this profile."}
                </p>
              );
            })()}

            <div className={styles.metricRow}>
              <div className={styles.metricTile}>
                <strong>{percentLabel(profile.coherenceScore, lang)}</strong>
                <span>{lang === "es" ? "Coherencia" : "Coherence"}</span>
              </div>
              <div className={styles.metricTile}>
                <strong>{percentLabel(profile.attendance.rate, lang)}</strong>
                <span>{lang === "es" ? "Asistencia" : "Attendance"}</span>
              </div>
              <div className={styles.metricTile}>
                <strong>{statNumber(profile.votesIndexed)}</strong>
                <span>{lang === "es" ? "Votos indexados" : "Indexed votes"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className={styles.main}>
        <Link href={`/etica-y-privacidad?lang=${lang}`} className="module-disclaimer">
          {lang === "es"
            ? "Señal analítica, no acusación. Verifica la fuente oficial antes de concluir o publicar."
            : "Analytical signal, not an accusation. Verify the official source before concluding or publishing."}
        </Link>
        <div className={styles.splitGrid}>
          <section className={styles.surface}>
            <h2 className={styles.surfaceTitle}>
              {lang === "es" ? "Ficha pública" : "Public sheet"}
            </h2>
            <div className={styles.detailList}>
              <div className={styles.detailItem}>
                <strong>{lang === "es" ? "Partido" : "Party"}</strong>
                <span>{profile.party}</span>
              </div>
              <div className={styles.detailItem}>
                <strong>{lang === "es" ? "Comisión" : "Commission"}</strong>
                <span>{profile.commission || (lang === "es" ? "No visible" : "Not visible")}</span>
              </div>
              <div className={styles.detailItem}>
                <strong>{lang === "es" ? "Circunscripción" : "Constituency"}</strong>
                <span>{profile.circunscription || (lang === "es" ? "No visible" : "Not visible")}</span>
              </div>
              {profile.email ? (
                <div className={styles.detailItem}>
                  <strong>{lang === "es" ? "Correo" : "Email"}</strong>
                  <a href={`mailto:${profile.email}`}>
                    <Mail size={14} /> {profile.email}
                  </a>
                </div>
              ) : null}
              {profile.phone ? (
                <div className={styles.detailItem}>
                  <strong>{lang === "es" ? "Teléfono" : "Phone"}</strong>
                  <span>
                    <Phone size={14} /> {profile.phone}
                  </span>
                </div>
              ) : null}
              {profile.office ? (
                <div className={styles.detailItem}>
                  <strong>{lang === "es" ? "Oficina" : "Office"}</strong>
                  <span>{profile.office}</span>
                </div>
              ) : null}
              <div className={styles.detailItem}>
                <strong>{lang === "es" ? "Fuente primaria" : "Primary source"}</strong>
                <span>
                  {profile.sourcePrimary}
                  {profile.sourcePrimary && /seed|semilla/i.test(profile.sourcePrimary) ? (
                    <span className={styles.seedBadge}>
                      {lang === "es" ? "Dataset semilla" : "Seed dataset"}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className={styles.detailItem}>
                <strong>{lang === "es" ? "Métricas" : "Metrics"}</strong>
                <span className={styles.smallMuted}>
                  {lang === "es" ? "Métrica en validación" : "Metric under validation"}
                </span>
              </div>
            </div>

            {profile.socials.length ? (
              <>
                <h3 className={styles.surfaceTitle} style={{ marginTop: "1.2rem" }}>
                  {lang === "es" ? "Redes visibles" : "Visible socials"}
                </h3>
                <div className={styles.chips}>
                  {profile.socials.map((social) => (
                    <a
                      key={`${social.network}-${social.url}`}
                      href={social.url}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.inlineLink}
                    >
                      {social.network}
                      <ArrowUpRight size={14} />
                    </a>
                  ))}
                </div>
              </>
            ) : null}
          </section>

          <section className={styles.surface}>
            <h2 className={styles.surfaceTitle}>
              {lang === "es" ? "Coherencia por tema" : "Topic coherence"}
            </h2>
            <div className={styles.detailList}>
              {hasTopicInsights ? (
                sortedTopicScores.slice(0, 4).map((topic) => {
                  const Icon = topicIconFor(topic);
                  const counts = topicCounts(topic);
                  const coherentPct = counts.total ? (counts.coherent / counts.total) * 100 : 0;
                  return (
                    <div key={topic.key} className={styles.partyBarRow}>
                      <div className={styles.partyBarLabel} style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
                        <Icon size={15} aria-hidden={true} />
                        {topic.label}
                      </div>
                      <div className={styles.partyBarTrack}>
                        <div
                          className={styles.partyBarFill}
                          style={{
                            width: `${coherentPct}%`,
                            background: "#0a7a4e",
                          }}
                        />
                      </div>
                      <div className={styles.partyBarCount}>{statNumber(counts.total)}</div>
                    </div>
                  );
                })
              ) : (
                <p className={styles.surfaceIntro}>
                  {profile.votesIndexed === 0
                    ? lang === "es"
                      ? "Todavía no hay votaciones clasificadas por tema para este perfil."
                      : "There are no topic-classified votes for this profile yet."
                    : lang === "es"
                      ? `El desglose temático se está clasificando sobre ${statNumber(profile.votesIndexed)} votos indexados.`
                      : `The topic breakdown is being classified across ${statNumber(profile.votesIndexed)} indexed votes.`}
                </p>
              )}
            </div>
          </section>
        </div>

        <LegislatorStatBlock profile={profile} lang={lang} />

        {profile.promises.length ? (
          <section className={styles.tableSurface}>
            <h2 className={styles.surfaceTitle}>
              {lang === "es" ? "Promesas revisadas" : "Reviewed promises"}
            </h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{lang === "es" ? "Tema" : "Topic"}</th>
                  <th>{lang === "es" ? "Promesa" : "Claim"}</th>
                  <th>{lang === "es" ? "Fuente" : "Source"}</th>
                </tr>
              </thead>
              <tbody>
                {profile.promises.map((promise) => (
                  <tr key={promise.id}>
                    <td>{promise.topicLabel}</td>
                    <td>{promise.claimText}</td>
                    <td>
                      {promise.sourceUrl ? (
                        <a href={promise.sourceUrl} target="_blank" rel="noreferrer" className={styles.inlineLink}>
                          {promise.sourceLabel || promise.sourceDate || (lang === "es" ? "Fuente" : "Source")}
                        </a>
                      ) : (
                        <span className={styles.sourcePending}>
                          {lang === "es" ? "Sin fuente verificada" : "No verified source"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className={styles.tableSurface}>
          <h2 className={styles.surfaceTitle}>
            {lang === "es" ? "Votaciones recientes" : "Recent votes"}
          </h2>
          {hasTopicInsights ? (
            <div
              style={{
                padding: "1.25rem 1.5rem 0.9rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.65rem",
              }}
            >
              <p
                className={styles.smallMuted}
                style={{ margin: 0, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}
              >
                {lang === "es" ? "Coherencia por tema" : "Topic coherence"}
              </p>
              {visibleTopicScores.map((topic) => {
                const Icon = topicIconFor(topic);
                const counts = topicCounts(topic);
                const coherentPct = counts.total ? (counts.coherent / counts.total) * 100 : 0;
                const inconsistentPct = counts.total ? (counts.inconsistent / counts.total) * 100 : 0;
                const absentPct = counts.total ? (counts.absent / counts.total) * 100 : 0;
                const tooltip =
                  lang === "es"
                    ? `${statNumber(counts.coherent)} coherentes · ${statNumber(counts.inconsistent)} inconsistentes · ${statNumber(counts.absent)} ausencias`
                    : `${statNumber(counts.coherent)} coherent · ${statNumber(counts.inconsistent)} inconsistent · ${statNumber(counts.absent)} absences`;
                return (
                  <div
                    key={topic.key}
                    title={tooltip}
                    data-topic-row="true"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(170px, 1fr) minmax(160px, 240px) auto",
                      gap: "0.75rem",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", fontWeight: 700 }}>
                      <Icon size={16} aria-hidden={true} />
                      {topic.label}
                    </span>
                    <span
                      role="img"
                      aria-label={tooltip}
                      style={{
                        display: "flex",
                        width: "100%",
                        height: 8,
                        borderRadius: 999,
                        overflow: "hidden",
                        background: "rgba(12,19,34,0.08)",
                      }}
                    >
                      {coherentPct > 0 ? <span style={{ width: `${coherentPct}%`, background: "#0a7a4e" }} /> : null}
                      {inconsistentPct > 0 ? <span style={{ width: `${inconsistentPct}%`, background: "#b81f1f" }} /> : null}
                      {absentPct > 0 ? <span style={{ width: `${absentPct}%`, background: "rgba(12,19,34,0.28)" }} /> : null}
                    </span>
                    <span className={styles.smallMuted} style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                      {statNumber(counts.total)}
                    </span>
                  </div>
                );
              })}
              {sortedTopicScores.length > 5 ? (
                <button
                  type="button"
                  className={styles.inlineLink}
                  onClick={() => setShowAllTopics((value) => !value)}
                  style={{ alignSelf: "flex-start", border: 0, background: "transparent", padding: 0, cursor: "pointer" }}
                >
                  {showAllTopics
                    ? lang === "es"
                      ? "Ver menos"
                      : "Show less"
                    : lang === "es"
                      ? "Ver todos →"
                      : "Show all →"}
                </button>
              ) : null}
              <p className={styles.smallMuted} style={{ margin: "0.25rem 0 0", fontSize: "0.78rem" }}>
                {lang === "es"
                  ? "Coherencia calculada contra promesas de campaña verificadas."
                  : "Coherence calculated against verified campaign promises."}
              </p>
            </div>
          ) : null}
          {hasRecentVotes ? (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{lang === "es" ? "Fecha" : "Date"}</th>
                    <th>{lang === "es" ? "Proyecto / Tema" : "Bill / Topic"}</th>
                    <th>{lang === "es" ? "Voto" : "Vote"}</th>
                    <th>{lang === "es" ? "Fuente" : "Source"}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRecentVotes.map((vote) => (
                    <tr key={vote.id}>
                      <td>
                        <span className={styles.smallMuted}>
                          <CalendarDays size={14} /> {vote.voteDate}
                        </span>
                      </td>
                      <td>
                        {vote.title}
                        <div className={styles.smallMuted}>{vote.topicLabel}</div>
                      </td>
                      <td>
                        <span
                          className={styles.chip}
                          style={{
                            background: voteChipTone(vote.voteValue),
                            color: "rgba(12,19,34,0.86)",
                            borderColor: "rgba(12,19,34,0.08)",
                          }}
                        >
                          {voteChipLabel(vote.voteValue, lang)}
                        </span>
                      </td>
                      <td>
                        {vote.sourceUrl || vote.projectSourceUrl ? (
                          <a href={vote.sourceUrl || vote.projectSourceUrl} target="_blank" rel="noreferrer" className={styles.inlineLink}>
                            {lang === "es" ? "Fuente" : "Source"} <ArrowUpRight size={14} />
                          </a>
                        ) : (
                          <span className={styles.smallMuted}>{lang === "es" ? "No visible" : "Not visible"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {profile.recentVotes.length > votePageSize ? (
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", padding: "0.85rem 1.5rem 1.25rem" }}>
                <button
                  type="button"
                  className={styles.chip}
                  disabled={safeVotePage === 0}
                  onClick={() => setVotePage((page) => Math.max(0, page - 1))}
                  style={{ cursor: safeVotePage === 0 ? "default" : "pointer", opacity: safeVotePage === 0 ? 0.5 : 1 }}
                >
                  {lang === "es" ? "Anterior" : "Previous"}
                </button>
                <span className={styles.smallMuted}>
                  {safeVotePage + 1} / {votePageCount}
                </span>
                <button
                  type="button"
                  className={styles.chip}
                  disabled={safeVotePage >= votePageCount - 1}
                  onClick={() => setVotePage((page) => Math.min(votePageCount - 1, page + 1))}
                  style={{ cursor: safeVotePage >= votePageCount - 1 ? "default" : "pointer", opacity: safeVotePage >= votePageCount - 1 ? 0.5 : 1 }}
                >
                  {lang === "es" ? "Siguiente" : "Next"}
                </button>
              </div>
              ) : null}
            </>
          ) : profile.votesIndexed > 0 ? (
            <div
              style={{
                margin: "1.1rem 1.5rem 1.4rem",
                padding: "1.15rem",
                border: "1px solid rgba(12,19,34,0.09)",
                borderRadius: 8,
                background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(246,248,252,0.9))",
                display: "grid",
                gap: "0.95rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <strong style={{ fontFamily: "Sora, sans-serif", fontSize: "1rem" }}>
                  {lang === "es" ? "Pipeline activo" : "Active pipeline"}
                </strong>
                <span className={`${styles.chip} ${styles.chipGood}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.32rem" }}>
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      data-vote-pipeline-dot="true"
                      aria-hidden={true}
                      style={{ width: 6, height: 6, borderRadius: 999, background: "#0a7a4e", display: "inline-block" }}
                    />
                  ))}
                  {lang === "es" ? "procesando" : "processing"}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "0.65rem" }}>
                <span className={styles.chip}>
                  {lang === "es"
                    ? `${statNumber(profile.votesIndexed)} votos indexados`
                    : `${statNumber(profile.votesIndexed)} indexed votes`}
                </span>
                <span className={styles.chip}>
                  {`${statNumber(profile.attendedSessions ?? 0)} / ${statNumber(profile.attendanceSessions ?? 0)} ${lang === "es" ? "sesiones" : "sessions"}`}
                </span>
                <span className={styles.chip}>
                  {profile.coherenceScore != null
                    ? `${Math.round(profile.coherenceScore)}% ${lang === "es" ? "coherencia" : "coherence"}`
                    : lang === "es"
                      ? "Coherencia en revisión"
                      : "Coherence under review"}
                </span>
              </div>
              <p className={styles.smallMuted} style={{ margin: 0, fontSize: "0.86rem", lineHeight: 1.55 }}>
                {lang === "es"
                  ? `El desglose temático estará disponible una vez el pipeline complete la clasificación de ${statNumber(profile.votesIndexed)} votos indexados.`
                  : `The topic breakdown will be available once the pipeline completes classification of ${statNumber(profile.votesIndexed)} indexed votes.`}
              </p>
            </div>
          ) : (
            <div className={styles.emptyState}>
              {lang === "es"
                ? "Aún no hay votaciones indexadas para este perfil."
                : "No indexed votes for this profile yet."}
            </div>
          )}
        </section>

        <Link href={`/votometro?lang=${lang}`} className={styles.inlineLink}>
          {lang === "es" ? "Volver al directorio" : "Back to directory"}
        </Link>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
