import { LoadingStage } from "@/components/loading-stage";

export default function SigueElDineroLoading() {
  return (
    <div className="sed-page">
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
      <section className="sed-hero" style={{ padding: "2rem" }}>
        <LoadingStage lang="es" context="network" />
      </section>
    </div>
  );
}
