"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, Mail, Phone } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { LegislatorStatBlock } from "@/components/votometro/legislator-stat-block";
import type { Lang } from "@/lib/types";
import type { LegislatorProfile, VotometroDataIssue } from "@/lib/votometro-types";

import styles from "./votometro.module.css";

gsap.registerPlugin(ScrollTrigger);

function percentLabel(value: number | null, lang: Lang) {
  return value == null ? (lang === "es" ? "Sin revisar" : "Not reviewed") : `${Math.round(value)}%`;
}

function statNumber(value: number) {
  return new Intl.NumberFormat("es-CO").format(value);
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
              {profile.topicScores.length ? (
                profile.topicScores.map((score) => (
                  <div key={score.key} className={styles.partyBarRow}>
                    <div className={styles.partyBarLabel}>{score.label}</div>
                    <div className={styles.partyBarTrack}>
                      <div 
                        className={styles.partyBarFill} 
                        style={{ 
                          width: `${score.score ?? 0}%`,
                          background: `linear-gradient(90deg, var(--blue, #0d5bd7), var(--green, #18794e))`
                        }} 
                      />
                    </div>
                    <div className={styles.partyBarCount}>{percentLabel(score.score, lang)}</div>
                  </div>
                ))
              ) : (
                <p className={styles.surfaceIntro}>
                  {lang === "es"
                    ? "Todavía no hay votaciones clasificadas por tema para este perfil."
                    : "There are no topic-classified votes for this profile yet."}
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
          {profile.recentVotes.length ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{lang === "es" ? "Fecha" : "Date"}</th>
                  <th>{lang === "es" ? "Proyecto" : "Project"}</th>
                  <th>{lang === "es" ? "Voto" : "Vote"}</th>
                  <th>{lang === "es" ? "Coherencia" : "Coherence"}</th>
                </tr>
              </thead>
              <tbody>
                {profile.recentVotes.map((vote) => (
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
                    <td>{vote.voteValue}</td>
                    <td>
                      <span className={`${styles.voteBadge} ${
                        vote.promiseAlignment === "coherente" ? styles.isCoherent :
                        vote.promiseAlignment === "inconsistente" ? styles.isInconsistent :
                        styles.isNeutral
                      }`}>
                        {vote.promiseAlignment}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : profile.votesIndexed > 0 ? (
            (() => {
              const coh = Math.max(0, profile.coherentVotes ?? 0);
              const inc = Math.max(0, profile.inconsistentVotes ?? 0);
              const abs = Math.max(0, profile.absentVotes ?? 0);
              const total = coh + inc + abs;
              const hasBreakdown = total > 0;
              const cohPct = hasBreakdown ? (coh / total) * 100 : 0;
              const incPct = hasBreakdown ? (inc / total) * 100 : 0;
              const absPct = hasBreakdown ? (abs / total) * 100 : 0;
              const cohScore = profile.coherenceScore;
              return (
                <div
                  style={{
                    padding: "1.25rem 1.5rem 1.4rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.85rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: "0.6rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong style={{ fontFamily: "Sora, sans-serif", fontSize: "0.95rem" }}>
                      {lang === "es"
                        ? `Total indexado: ${statNumber(profile.votesIndexed)} votos`
                        : `Total indexed: ${statNumber(profile.votesIndexed)} votes`}
                    </strong>
                    <span className={styles.smallMuted}>
                      {hasBreakdown
                        ? lang === "es"
                          ? "Distribución por alineación con promesas"
                          : "Breakdown by alignment with promises"
                        : lang === "es"
                          ? "Desglose por votación disponible próximamente"
                          : "Per-vote breakdown coming soon"}
                    </span>
                  </div>

                  <div
                    role="img"
                    aria-label={
                      hasBreakdown
                        ? lang === "es"
                          ? `Coherentes ${Math.round(cohPct)}%, inconsistentes ${Math.round(incPct)}%, ausencias ${Math.round(absPct)}%`
                          : `Coherent ${Math.round(cohPct)}%, inconsistent ${Math.round(incPct)}%, absences ${Math.round(absPct)}%`
                        : lang === "es"
                          ? `${statNumber(profile.votesIndexed)} votos indexados`
                          : `${statNumber(profile.votesIndexed)} indexed votes`
                    }
                    style={{
                      display: "flex",
                      width: "100%",
                      height: 11,
                      borderRadius: 999,
                      overflow: "hidden",
                      background: "rgba(12,19,34,0.06)",
                    }}
                  >
                    {hasBreakdown ? (
                      <>
                        {cohPct > 0 ? (
                          <span
                            style={{
                              width: `${cohPct}%`,
                              background: "#0a7a4e",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: ".02em",
                            }}
                          >
                            {cohPct >= 12 ? `${Math.round(cohPct)}%` : ""}
                          </span>
                        ) : null}
                        {incPct > 0 ? (
                          <span
                            style={{
                              width: `${incPct}%`,
                              background: "#a12c7b",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: ".02em",
                            }}
                          >
                            {incPct >= 12 ? `${Math.round(incPct)}%` : ""}
                          </span>
                        ) : null}
                        {absPct > 0 ? (
                          <span
                            style={{
                              width: `${absPct}%`,
                              background: "rgba(12,19,34,0.32)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: ".02em",
                            }}
                          >
                            {absPct >= 12 ? `${Math.round(absPct)}%` : ""}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span
                        style={{
                          width: "100%",
                          background: "rgba(12,19,34,0.18)",
                        }}
                      />
                    )}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                    <span className={styles.chip}>
                      {`${statNumber(profile.attendedSessions ?? 0)} / ${statNumber(profile.attendanceSessions ?? 0)} ${lang === "es" ? "sesiones" : "sessions"}`}
                    </span>
                    <span className={`${styles.chip} ${styles.chipGood}`}>
                      {cohScore != null
                        ? `${Math.round(cohScore)}% ${lang === "es" ? "coherencia" : "coherence"}`
                        : lang === "es"
                          ? "Coherencia sin revisar"
                          : "Coherence not reviewed"}
                    </span>
                    {hasBreakdown ? null : (
                      <span className={styles.chip}>
                        {lang === "es"
                          ? `${statNumber(profile.votesIndexed)} votos indexados`
                          : `${statNumber(profile.votesIndexed)} indexed votes`}
                      </span>
                    )}
                  </div>

                  <p className={styles.smallMuted} style={{ margin: 0, fontSize: "0.78rem" }}>
                    {lang === "es"
                      ? "Desglose por votación disponible cuando el pipeline de datos esté completo."
                      : "Per-vote breakdown available when the data pipeline is complete."}
                  </p>
                </div>
              );
            })()
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
