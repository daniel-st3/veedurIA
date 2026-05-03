"use client";

import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export default function EticaPrivacidadError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[etica-y-privacidad] route error", error);

  return (
    <div className="shell">
      <SiteNav lang="es" />
      <main className="legal-page" style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "1rem", padding: "2rem" }}>
        <p className="eyebrow">Legal · privacidad · seguridad</p>
        <h1 style={{ fontSize: "1.5rem" }}>
          No se pudo cargar esta página
        </h1>
        <p style={{ maxWidth: "36rem", opacity: 0.7 }}>
          Intenta de nuevo o vuelve al inicio para seguir explorando
          la plataforma.
        </p>
        <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
          <button onClick={reset} className="btn-secondary" style={{ cursor: "pointer" }}>
            Reintentar
          </button>
          <Link href="/?lang=es" className="btn-secondary">
            Volver al inicio
          </Link>
        </div>
      </main>
      <SiteFooter lang="es" />
    </div>
  );
}
