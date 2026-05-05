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

function clampPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function indexedCoverage(votesIndexed: number) {
  return Math.max(0, Math.min(100, Math.round((votesIndexed / 2000) * 100)));
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
    "En revisión": "Public sheet",
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

const PROFILE_TOPIC_RULES = [
  {
    es: "Institucional / ley",
    en: "Institutional / law",
    terms: ["comision", "comisión", "primera", "ley", "senado", "camara", "cámara", "constitucional", "congreso"],
  },
  {
    es: "Economía pública",
    en: "Public economy",
    terms: ["economia", "economía", "presupuesto", "hacienda", "empresa", "industria", "desarrollo", "empleo", "minas"],
  },
  {
    es: "Territorio",
    en: "Territory",
    terms: ["nacional", "territorio", "regional", "departamento", "circunscripcion", "circunscripción", "bogota", "bogotá"],
  },
  {
    es: "Seguridad / paz",
    en: "Security / peace",
    terms: ["seguridad", "paz", "defensa", "conflicto", "victimas", "víctimas", "justicia"],
  },
  {
    es: "Educación / cultura",
    en: "Education / culture",
    terms: ["educacion", "educación", "universidad", "docente", "cultura", "novela", "autor", "academico", "académico"],
  },
  {
    es: "Salud / social",
    en: "Health / social",
    terms: ["salud", "social", "familia", "mujer", "derechos", "bienestar", "inclusion", "inclusión"],
  },
] as const;

function normalizeAnalysisText(value: string) {
  return value
    .toLocaleLowerCase("es-CO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildProfileTopicAnalysis(profile: LegislatorProfile, lang: Lang) {
  const source = normalizeAnalysisText(
    [
      profile.canonicalName,
      profile.party,
      profile.chamberLabel,
      profile.roleLabel,
      profile.commission,
      profile.circunscription,
      profile.bio,
    ].join(" "),
  );

  return PROFILE_TOPIC_RULES.map((rule) => {
    const hits = rule.terms.reduce((sum, term) => {
      const needle = normalizeAnalysisText(term);
      return sum + (source.includes(needle) ? 1 : 0);
    }, 0);
    const institutionalBoost = rule.es === "Institucional / ley" && profile.commission ? 18 : 0;
    const territoryBoost = rule.es === "Territorio" && profile.circunscription ? 14 : 0;
    const partyBoost = rule.es === "Economía pública" && profile.party ? 6 : 0;
    const score = Math.max(12, Math.min(100, 18 + hits * 16 + institutionalBoost + territoryBoost + partyBoost));
    return {
      label: lang === "es" ? rule.es : rule.en,
      score,
    };
  }).sort((left, right) => right.score - left.score || left.label.localeCompare(right.label, "es-CO"));
}

function analysisSentence(profile: LegislatorProfile, lang: Lang) {
  const attendance = clampPercent(profile.attendance.rate);
  const coherence = clampPercent(profile.coherenceScore);
  if (lang === "en") {
    return `${profile.canonicalName} has ${statNumber(profile.votesIndexed)} indexed votes, ${attendance ?? "no"}% recorded attendance and ${coherence ?? "no"} / 100 public coherence in the current profile slice.`;
  }
  return `${profile.canonicalName} tiene ${statNumber(profile.votesIndexed)} votos indexados, ${attendance ?? "sin"}% de asistencia registrada y ${coherence ?? "sin"} / 100 de coherencia pública en este corte.`;
}

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
        { y: 30 },
        { y: 0, duration: 0.8 },
      );

      gsap.utils.toArray<HTMLElement>(`.${styles.surface}, .${styles.tableSurface}`).forEach((el, i) => {
        gsap.fromTo(
          el,
          { y: 25 },
          {
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
  const topicAnalysis = buildProfileTopicAnalysis(profile, lang);
  const primaryTopic = topicAnalysis[0];
  const aggregateRows = [
    {
      label: lang === "es" ? "Asistencia registrada" : "Recorded attendance",
      value: clampPercent(profile.attendance.rate),
      detail:
        profile.attendance.sessions > 0
          ? `${statNumber(profile.attendance.attended)} / ${statNumber(profile.attendance.sessions)} ${lang === "es" ? "sesiones" : "sessions"}`
          : lang === "es"
            ? "Sin sesiones visibles"
            : "No visible sessions",
      tone: "good",
    },
    {
      label: lang === "es" ? "Coherencia agregada" : "Aggregate coherence",
      value: clampPercent(profile.coherenceScore),
      detail:
        profile.coherenceScore == null
          ? lang === "es"
            ? "Sin dato público"
            : "No public value"
          : `${Math.round(profile.coherenceScore)} / 100`,
      tone: "mid",
    },
    {
      label: lang === "es" ? "Volumen indexado" : "Indexed volume",
      value: indexedCoverage(profile.votesIndexed),
      detail:
        lang === "es"
          ? `${statNumber(profile.votesIndexed)} votos en el corte público`
          : `${statNumber(profile.votesIndexed)} votes in the public slice`,
      tone: "blue",
    },
  ];

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
              <div className={styles.detailItem}>
                <strong>{lang === "es" ? "Período" : "Term"}</strong>
                <span>2022–2026</span>
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
                  {lang === "es" ? "Análisis calculado del perfil" : "Calculated profile analysis"}
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
              {lang === "es" ? "Temas inferidos del perfil" : "Topics inferred from profile"}
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
                <div className={styles.topicAnalysisList}>
                  <p className={styles.surfaceIntro}>
                    {lang === "es"
                      ? "Lectura NLP ligera sobre bio, partido, cámara, comisión y circunscripción del perfil."
                      : "Light NLP reading over bio, party, chamber, commission and constituency fields."}
                  </p>
                  {topicAnalysis.slice(0, 5).map((topic) => (
                    <div className={styles.topicAnalysisRow} key={topic.label}>
                      <span>{topic.label}</span>
                      <i>
                        <b style={{ width: `${topic.score}%` }} />
                      </i>
                      <em>{topic.score}</em>
                    </div>
                  ))}
                  <p className={styles.topicAnalysisNote}>
                    {lang === "es"
                      ? `Tema dominante del texto público: ${primaryTopic.label}.`
                      : `Dominant public-text topic: ${primaryTopic.label}.`}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className={styles.analysisPanel}>
          <div className={styles.analysisHeader}>
            <div>
              <span>{lang === "es" ? "análisis computado" : "computed analysis"}</span>
              <h2>{lang === "es" ? "Lectura del perfil" : "Profile analysis"}</h2>
              <p>{analysisSentence(profile, lang)}</p>
            </div>
            <strong>{clampPercent(profile.coherenceScore) ?? "—"}</strong>
          </div>

          <div className={styles.analysisGrid}>
            <div className={styles.analysisChart}>
              {aggregateRows.map((row) => (
                <div className={styles.analysisMetric} data-tone={row.tone} key={row.label}>
                  <div>
                    <strong>{row.label}</strong>
                    <span>{row.detail}</span>
                  </div>
                  <i>
                    <b style={{ width: `${row.value ?? 0}%` }} />
                  </i>
                  <em>{row.value == null ? "—" : `${row.value}%`}</em>
                </div>
              ))}
            </div>

            <div className={styles.topicDonutCard}>
              <h3>{lang === "es" ? "Distribución temática inferida" : "Inferred topic distribution"}</h3>
              <div className={styles.topicStack}>
                {topicAnalysis.slice(0, 5).map((topic) => (
                  <span key={topic.label} style={{ width: `${topic.score}%` }} title={topic.label} />
                ))}
              </div>
              <div className={styles.topicLegend}>
                {topicAnalysis.slice(0, 5).map((topic) => (
                  <span key={topic.label}>
                    <i />
                    {topic.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.analysisNarrative}>
            <div>
              <h3>{lang === "es" ? "Lectura rápida" : "Quick reading"}</h3>
              <p>
                {lang === "es"
                  ? `${profile.party}, ${localizedChamberLabel(profile.chamber, lang)} y ${profile.commission || "sin comisión visible"} concentran la lectura institucional.`
                  : `${profile.party}, ${localizedChamberLabel(profile.chamber, lang)} and ${profile.commission || "no visible commission"} drive the institutional reading.`}
              </p>
            </div>
            <div>
              <h3>{lang === "es" ? "Base usada" : "Source used"}</h3>
              <p>
                {lang === "es"
                  ? "Bio pública, partido, cámara, comisión, circunscripción, asistencia, coherencia y votos indexados."
                  : "Public bio, party, chamber, commission, constituency, attendance, coherence and indexed votes."}
              </p>
            </div>
          </div>
        </section>

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

        {hasTopicInsights || hasRecentVotes ? (
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
          ) : null}
        </section>
        ) : null}

        <Link href={`/votometro?lang=${lang}`} className={styles.inlineLink}>
          {lang === "es" ? "Volver al directorio" : "Back to directory"}
        </Link>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
