"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, Mail, Phone } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
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
              <span className={`${styles.statusBadge} ${profile.status === "Fallecido" ? styles.statusBadgeMuted : ""}`}>
                {localizedStatus(profile.status, lang)}
              </span>
              <span className={styles.chip}>{localizedChamberLabel(profile.chamber, lang)}</span>
              <span className={`${styles.chip} ${styles.chipGood}`}>{profile.party}</span>
            </div>
            <p className={styles.profileMeta}>
              {localizedRoleLabel(profile, lang)}
              {profile.circunscription ? ` · ${profile.circunscription}` : ""}
              {profile.commission ? ` · ${profile.commission}` : ""}
            </p>
            {profile.bio ? <p className={styles.body}>{profile.bio.replace(/hijo del ex presidente Ernesto Samper\.?/gi, "").trim()}</p> : null}

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

        <section className={styles.tableSurface}>
          <h2 className={styles.surfaceTitle}>
            {lang === "es" ? "Promesas revisadas" : "Reviewed promises"}
          </h2>
          {profile.promises.length ? (
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
          ) : (
            <div className={styles.emptyState}>
              {lang === "es"
                ? "Sin promesas revisadas todavía. La coherencia pública solo aparece cuando el backoffice aprueba la relación promesa → voto."
                : "No reviewed promises yet. Public coherence only appears once the backoffice approves the promise-to-vote link."}
            </div>
          )}
        </section>

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
          ) : (
            <div className={styles.emptyState}>
              {lang === "es"
                ? "Sin votaciones indexadas todavía para este perfil."
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
