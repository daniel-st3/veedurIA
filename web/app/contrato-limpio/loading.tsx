export default function ContratoLimpioLoading() {
  return (
    <main className="page cv-page">
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
      <section className="surface stripe-flag" style={{ marginTop: "1.2rem", padding: "2rem" }}>
        <div className="skeleton skeleton--pill" style={{ width: 180, marginBottom: 16 }} />
        <div className="skeleton skeleton--title" style={{ width: "62%", marginBottom: 10 }} />
        <div className="skeleton skeleton--line" style={{ width: "78%" }} />
      </section>
    </main>
  );
}
