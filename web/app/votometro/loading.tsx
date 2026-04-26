import { LoadingStage } from "@/components/loading-stage";

export default function VotometroLoading() {
  return (
    <main className="page vm-page">
      <nav className="site-nav">
        <span className="brand" aria-label="VeedurIA">
          <span className="brand-mark">
            <span className="brand-word">Veedur</span>
            <span className="brand-ia" aria-hidden>
              <span className="brand-flag brand-flag--yellow">I</span>
              <span className="brand-flag brand-flag--blue">A</span>
              <span className="brand-flag brand-flag--red">.</span>
            </span>
          </span>
        </span>
      </nav>
      <section className="surface stripe-flag" style={{ marginTop: "1.2rem", padding: "1.2rem" }}>
        <LoadingStage lang="es" context="votometro" />
      </section>
    </main>
  );
}
