import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import type { Lang } from "@/lib/types";
import type {
  IdentityConflictRecord,
  PromiseReviewRecord,
} from "@/lib/votometro-types";

import styles from "./votometro.module.css";

export function VotometroReviewPage({
  lang,
  isConfigured,
  isAuthenticated,
  promiseQueue,
  identityQueue,
  runs,
}: {
  lang: Lang;
  isConfigured: boolean;
  isAuthenticated: boolean;
  promiseQueue: PromiseReviewRecord[];
  identityQueue: IdentityConflictRecord[];
  runs: Record<string, unknown>[];
}) {
  const copy =
    lang === "es"
      ? {
          title: "Backoffice mínimo de revisión",
          intro:
            "Aquí se aprueban promesas antes de exponer coherencia pública y se resuelven colisiones de identidad antes de canonizar registros.",
          passwordMissing:
            "Falta configurar VOTOMETRO_REVIEW_PASSWORD en el entorno del frontend para habilitar este panel.",
          enter: "Entrar",
          logout: "Cerrar sesión",
          pendingPromises: "Promesas pendientes o revisadas",
          pendingConflicts: "Colisiones de identidad",
          runsTitle: "Últimas sincronizaciones",
          approve: "Aprobar",
          reject: "Rechazar",
          ambiguous: "Ambigua",
          resolve: "Resolver",
          discard: "Descartar",
          note: "Nota opcional",
        }
      : {
          title: "Minimal review backoffice",
          intro:
            "Approve promises before exposing public coherence and resolve identity collisions before canonizing records.",
          passwordMissing:
            "Set VOTOMETRO_REVIEW_PASSWORD in the frontend environment to enable this panel.",
          enter: "Enter",
          logout: "Log out",
          pendingPromises: "Pending or reviewed promises",
          pendingConflicts: "Identity collisions",
          runsTitle: "Recent sync runs",
          approve: "Approve",
          reject: "Reject",
          ambiguous: "Ambiguous",
          resolve: "Resolve",
          discard: "Discard",
          note: "Optional note",
        };

  return (
    <div className={styles.shell}>
      <SiteNav lang={lang} />
      <main className={styles.main}>
        <section className={`${styles.hero} ${styles.loginCard}`}>
          <span className={styles.eyebrow}>VotóMeter / Review</span>
          <h1 className={styles.title}>{copy.title}</h1>
          <p className={styles.body}>{copy.intro}</p>

          {!isConfigured ? (
            <div className={styles.emptyState}>{copy.passwordMissing}</div>
          ) : !isAuthenticated ? (
            <form action="/api/votometro/review/login" method="post" className={styles.reviewGrid}>
              <input type="hidden" name="lang" value={lang} />
              <div className={styles.filterField}>
                <label htmlFor="password">Password</label>
                <input id="password" name="password" type="password" required />
              </div>
              <button type="submit" className={styles.button}>
                {copy.enter}
              </button>
            </form>
          ) : (
            <form action="/api/votometro/review/logout" method="post">
              <input type="hidden" name="lang" value={lang} />
              <button type="submit" className={styles.ghostLink}>
                {copy.logout}
              </button>
            </form>
          )}
        </section>

        {isConfigured && isAuthenticated ? (
          <>
            <section className={styles.surface}>
              <h2 className={styles.surfaceTitle}>{copy.pendingPromises}</h2>
              <div className={styles.reviewGrid}>
                {promiseQueue.length ? (
                  promiseQueue.map((claim) => (
                    <article key={claim.id} className={styles.reviewCard}>
                      <div className={styles.smallMuted}>
                        {claim.legislatorName} · {claim.topicLabel} · {claim.sourceLabel}
                      </div>
                      <div>{claim.claimText}</div>
                      <div className={styles.chips}>
                        <span className={styles.chip}>{claim.status}</span>
                        {claim.sourceDate ? <span className={styles.chip}>{claim.sourceDate}</span> : null}
                      </div>

                      <form action={`/api/votometro/review/promises/${claim.id}`} method="post" className={styles.reviewActions}>
                        <input type="hidden" name="lang" value={lang} />
                        <input
                          className={styles.noteInput}
                          type="text"
                          name="review_note"
                          placeholder={copy.note}
                          defaultValue={claim.reviewNote}
                        />
                        <button type="submit" name="status" value="approved" className={styles.button}>
                          {copy.approve}
                        </button>
                        <button type="submit" name="status" value="rejected" className={styles.dangerButton}>
                          {copy.reject}
                        </button>
                        <button type="submit" name="status" value="ambiguous" className={styles.secondaryButton}>
                          {copy.ambiguous}
                        </button>
                      </form>
                    </article>
                  ))
                ) : (
                  <div className={styles.emptyState}>Queue vacía.</div>
                )}
              </div>
            </section>

            <section className={styles.surface}>
              <h2 className={styles.surfaceTitle}>{copy.pendingConflicts}</h2>
              <div className={styles.reviewGrid}>
                {identityQueue.length ? (
                  identityQueue.map((conflict) => (
                    <article key={conflict.id} className={styles.reviewCard}>
                      <div className={styles.smallMuted}>
                        {conflict.sourceSystem} · {conflict.chamber || "sin cámara"} · {conflict.status}
                      </div>
                      <div>
                        <strong>{conflict.candidateName}</strong>
                        <div className={styles.smallMuted}>{conflict.normalizedName}</div>
                      </div>
                      {conflict.confidence != null ? (
                        <div className={styles.chip}>confidence {Math.round(conflict.confidence * 100)}%</div>
                      ) : null}
                      <form action={`/api/votometro/review/conflicts/${conflict.id}`} method="post" className={styles.reviewActions}>
                        <input type="hidden" name="lang" value={lang} />
                        <input
                          className={styles.noteInput}
                          type="text"
                          name="resolved_note"
                          placeholder={copy.note}
                          defaultValue={conflict.resolvedNote}
                        />
                        <button type="submit" name="status" value="resolved" className={styles.button}>
                          {copy.resolve}
                        </button>
                        <button type="submit" name="status" value="discarded" className={styles.dangerButton}>
                          {copy.discard}
                        </button>
                      </form>
                    </article>
                  ))
                ) : (
                  <div className={styles.emptyState}>Queue vacía.</div>
                )}
              </div>
            </section>

            <section className={styles.tableSurface}>
              <h2 className={styles.surfaceTitle}>{copy.runsTitle}</h2>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th>Rows</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={String(run.id ?? "")}>
                      <td>{String(run.job_name ?? "")}</td>
                      <td>{String(run.status ?? "")}</td>
                      <td>{String(run.source_system ?? "")}</td>
                      <td>
                        {String(run.rows_in ?? 0)} → {String(run.rows_out ?? 0)}
                      </td>
                      <td>{String(run.started_at ?? "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        ) : null}

        <Link href={`/votometro?lang=${lang}`} className={styles.inlineLink}>
          {lang === "es" ? "Volver al directorio" : "Back to directory"}
        </Link>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
