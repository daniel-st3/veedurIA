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
        <div className="skeleton skeleton--pill" style={{ width: 160, marginBottom: 16 }} />
        <div className="skeleton skeleton--title" style={{ width: "50%", marginBottom: 10 }} />
        <div className="skeleton skeleton--line" style={{ width: "70%" }} />
      </section>
    </div>
  );
}
