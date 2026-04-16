import Link from "next/link";
import { ArrowUpRight, CalendarDays, Mail, Phone } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import type { Lang } from "@/lib/types";
import type { LegislatorProfile, VotometroDataIssue } from "@/lib/votometro-types";

import styles from "./votometro.module.css";

function percentLabel(value: number | null) {
  return value == null ? "Sin revisar" : `${Math.round(value)}%`;
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
  return <div className={styles.profileAvatarPlaceholder}>{profile.initials}</div>;
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
  if (!profile) {
    return (
      <div className={styles.shell}>
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
            {issue?.detail ? <p className={styles.smallMuted}>Detalle técnico: {issue.detail}</p> : null}
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
    <div className={styles.shell}>
      <SiteNav lang={lang} />
      <main className={styles.main}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>
            {lang === "es" ? "Perfil individual" : "Individual profile"}
          </span>
          <div className={styles.profileHero}>
            {avatar(profile)}
            <div>
              <div className={styles.profileTop}>
                <h1 className={styles.profileName}>{profile.canonicalName}</h1>
                <span className={styles.chip}>{profile.chamberLabel}</span>
                <span className={`${styles.chip} ${styles.chipGood}`}>{profile.party}</span>
              </div>
              <p className={styles.profileMeta}>
                {profile.roleLabel}
                {profile.circunscription ? ` · ${profile.circunscription}` : ""}
                {profile.commission ? ` · ${profile.commission}` : ""}
              </p>
              {profile.bio ? <p className={styles.body}>{profile.bio}</p> : null}

              <div className={styles.metricRow}>
                <div className={styles.metricTile}>
                  <strong>{percentLabel(profile.coherenceScore)}</strong>
                  <span>{lang === "es" ? "Coherencia" : "Coherence"}</span>
                </div>
                <div className={styles.metricTile}>
                  <strong>{percentLabel(profile.attendance.rate)}</strong>
                  <span>{lang === "es" ? "Asistencia" : "Attendance"}</span>
                </div>
                <div className={styles.metricTile}>
                  <strong>{profile.votesIndexed}</strong>
                  <span>{lang === "es" ? "Votos indexados" : "Indexed votes"}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

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
                <span>{profile.sourcePrimary}</span>
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
                  <div key={score.key} className={styles.detailItem}>
                    <strong>{score.label}</strong>
                    <span>
                      {percentLabel(score.score)} · {score.votes}{" "}
                      {lang === "es" ? "votaciones" : "votes"}
                    </span>
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
                          {promise.sourceLabel || promise.sourceDate || "Fuente"}
                        </a>
                      ) : (
                        promise.sourceLabel || promise.sourceDate || "Fuente"
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
                    <td>{vote.promiseAlignment}</td>
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
