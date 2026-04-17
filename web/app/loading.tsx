export default function HomeLoading() {
  return (
    <div className="shell">
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
      <main className="page lp-page">
        <section className="lp-hero" style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div className="skeleton skeleton--title" style={{ width: 260, marginBottom: 12, marginInline: "auto" }} />
            <div className="skeleton skeleton--line" style={{ width: 180, marginInline: "auto" }} />
          </div>
        </section>
      </main>
    </div>
  );
}
