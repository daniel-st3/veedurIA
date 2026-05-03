"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log but never expose to the route boundary
  console.error("[VeedurIA] unhandled route error", error);

  return (
    <div className="shell">
      <main className="legal-page" style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "1rem", padding: "2rem" }}>
        <p className="eyebrow">Error inesperado</p>
        <h1 style={{ fontSize: "1.5rem" }}>
          Algo falló al cargar esta página
        </h1>
        <p style={{ maxWidth: "36rem", opacity: 0.7 }}>
          VeedurIA no pudo completar esta solicitud. Puedes intentar de nuevo o
          volver al inicio.
        </p>
        <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
          <button
            onClick={reset}
            className="btn-secondary"
            style={{ cursor: "pointer" }}
          >
            Reintentar
          </button>
          <Link href="/?lang=es" className="btn-secondary">
            Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  );
}
