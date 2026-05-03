"use client";

/**
 * global-error.tsx — Next.js App Router global error boundary.
 *
 * This catches errors that escape the root layout (e.g. layout.tsx itself
 * throws). It must include its own <html> and <body> tags because the
 * root layout is not rendered when this boundary activates.
 *
 * Bilingual fallback: defaults to Spanish, detects English from the URL
 * when possible.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[VeedurIA] global layout error", error);

  // Best-effort language detection from URL
  const isEnglish =
    typeof window !== "undefined" &&
    /[?&]lang=en/i.test(window.location.search);

  const title = isEnglish ? "Something went wrong" : "Algo salió mal";
  const body = isEnglish
    ? "We could not load this view. You can try again or go back home."
    : "No pudimos cargar esta vista. Puedes intentarlo de nuevo o volver al inicio.";
  const retryLabel = isEnglish ? "Try again" : "Reintentar";
  const homeLabel = isEnglish ? "Back home" : "Volver al inicio";

  return (
    <html lang={isEnglish ? "en" : "es"}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "'Satoshi', 'Cabinet Grotesk', system-ui, -apple-system, sans-serif",
          background: "#f6f1e6",
          color: "#172033",
        }}
      >
        <main
          style={{
            textAlign: "center",
            padding: "2rem",
            maxWidth: "28rem",
          }}
        >
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: "#0d5bd7",
              marginBottom: "0.5rem",
            }}
          >
            VeedurIA
          </p>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              margin: "0 0 0.75rem",
            }}
          >
            {title}
          </h1>
          <p style={{ opacity: 0.7, lineHeight: 1.6, margin: "0 0 1.5rem" }}>
            {body}
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                padding: "0.65rem 1.2rem",
                background: "#172033",
                color: "#f6f1e6",
                border: "none",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: "pointer",
              }}
            >
              {retryLabel}
            </button>
            <a
              href="/?lang=es"
              style={{
                padding: "0.65rem 1.2rem",
                background: "transparent",
                color: "#172033",
                border: "1px solid rgba(23,32,51,.16)",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.88rem",
                textDecoration: "none",
              }}
            >
              {homeLabel}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
