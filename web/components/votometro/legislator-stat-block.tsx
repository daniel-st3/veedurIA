"use client";

import type { Lang } from "@/lib/types";
import type { LegislatorProfile } from "@/lib/votometro-types";

import styles from "./votometro.module.css";

const RING_RADIUS = 56;
const RING_STROKE = 10;
const RING_SIZE = (RING_RADIUS + RING_STROKE) * 2;
const RING_CENTER = RING_SIZE / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function localizedStatusBadge(status: LegislatorProfile["status"], lang: Lang) {
  if (lang === "es") {
    return status === "En revisión" ? "Datos en validación" : status;
  }
  const labels: Record<LegislatorProfile["status"], string> = {
    Activo: "Active",
    Retirado: "Retired",
    Fallecido: "Deceased",
    Histórico: "Historical",
    Suspendido: "Suspended",
    Exsenador: "Former senator",
    Exrepresentante: "Former representative",
    "En revisión": "Data under validation",
  };
  return labels[status] ?? status;
}

function isMutedStatus(status: LegislatorProfile["status"]): boolean {
  return (
    status === "Fallecido" ||
    status === "Histórico" ||
    status === "En revisión" ||
    status === "Retirado" ||
    status === "Suspendido" ||
    status === "Exsenador" ||
    status === "Exrepresentante"
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CO").format(value);
}

export function LegislatorStatBlock({ profile, lang }: { profile: LegislatorProfile; lang: Lang }) {
  const es = lang === "es";
  const score = typeof profile.coherenceScore === "number" ? Math.max(0, Math.min(100, profile.coherenceScore)) : null;
  const dashOffset = score == null ? RING_CIRCUMFERENCE : RING_CIRCUMFERENCE * (1 - score / 100);
  const ringTone = score == null ? "neutral" : score >= 75 ? "good" : score >= 50 ? "mid" : "low";

  const attendance = profile.attendance;
  const attendancePct =
    typeof attendance.rate === "number" ? `${Math.round(attendance.rate)}%` : es ? "Sin revisar" : "Not reviewed";
  const attendanceDetail =
    typeof attendance.attended === "number" && typeof attendance.sessions === "number" && attendance.sessions > 0
      ? `${formatNumber(attendance.attended)} / ${formatNumber(attendance.sessions)}`
      : null;

  const isSeed = /seed|semilla/i.test(profile.sourcePrimary ?? "");

  return (
    <section className={styles.statBlock} aria-label={es ? "Resumen del perfil" : "Profile summary"}>
      <header className={styles.statBlockHeader}>
        <h2 className={styles.surfaceTitle}>{es ? "Resumen del perfil" : "Profile summary"}</h2>
        {isSeed ? (
          <span className={styles.seedBadge}>
            {es ? "Dataset semilla · Métrica en validación" : "Seed dataset · Metric under validation"}
          </span>
        ) : null}
      </header>

      <div className={styles.statBlockBody}>
        <div className={styles.coherenceRing}>
          <svg viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} role="img" aria-label={es ? "Coherencia pública" : "Public coherence"}>
            <circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              fill="none"
              stroke="rgba(12,19,34,0.08)"
              strokeWidth={RING_STROKE}
            />
            <circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              fill="none"
              stroke={ringTone === "good" ? "#0a7a4e" : ringTone === "mid" ? "#c47d18" : ringTone === "low" ? "#c62839" : "rgba(12,19,34,0.32)"}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
            />
            <text
              x={RING_CENTER}
              y={RING_CENTER}
              textAnchor="middle"
              dominantBaseline="middle"
              className={styles.coherenceRingValue}
            >
              {score == null ? (es ? "—" : "—") : `${Math.round(score)} / 100`}
            </text>
          </svg>
          <p className={styles.coherenceRingCaption}>{es ? "Coherencia pública" : "Public coherence"}</p>
        </div>

        <dl className={styles.statBlockGrid}>
          <div>
            <dt>{es ? "Asistencia" : "Attendance"}</dt>
            <dd>
              <strong>{attendancePct}</strong>
              {attendanceDetail ? <span className={styles.smallMuted}>{attendanceDetail}</span> : null}
            </dd>
          </div>
          <div>
            <dt>{es ? "Votos indexados" : "Indexed votes"}</dt>
            <dd>
              <strong>{formatNumber(profile.votesIndexed)}</strong>
            </dd>
          </div>
          <div>
            <dt>{es ? "Partido" : "Party"}</dt>
            <dd>
              <strong>{profile.party || (es ? "Sin partido" : "No party")}</strong>
            </dd>
          </div>
          {profile.circunscription ? (
            <div>
              <dt>{es ? "Circunscripción" : "Constituency"}</dt>
              <dd>
                <strong>{profile.circunscription}</strong>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>{es ? "Cámara" : "Chamber"}</dt>
            <dd>
              <strong>{profile.chamber === "camara" ? (es ? "Cámara de Representantes" : "House of Representatives") : (es ? "Senado" : "Senate")}</strong>
            </dd>
          </div>
          {profile.commission ? (
            <div>
              <dt>{es ? "Comisión" : "Commission"}</dt>
              <dd>
                <strong>{profile.commission}</strong>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>{es ? "Estado" : "Status"}</dt>
            <dd>
              <span
                className={`${styles.statusBadge} ${isMutedStatus(profile.status) ? styles.statusBadgeMuted : ""}`}
              >
                {localizedStatusBadge(profile.status, lang)}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
