"use client";

import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export default function VotometroError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[votometro] route error", error);

  return (
    <div className="shell">
      <SiteNav lang="es" />
      <main className="legal-page" style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "1rem", padding: "2rem" }}>
        <p className="eyebrow">Votómetro</p>
        <h1 style={{ fontSize: "1.5rem" }}>
          No se pudo cargar el directorio legislativo
        </h1>
        <p style={{ maxWidth: "36rem", opacity: 0.7 }}>
          Puede tratarse de una caída temporal en la base de datos pública.
          Intenta de nuevo o vuelve al inicio.
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
