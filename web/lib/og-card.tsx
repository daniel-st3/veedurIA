export function OgCard({
  title,
  subtitle,
  accent,
}: {
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "linear-gradient(135deg, #f8f1df 0%, #fffaf1 38%, #eef5ff 100%)",
        color: "#09131f",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Arial",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -110,
          left: -90,
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: "#0d5bd7",
          opacity: 0.08,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -70,
          bottom: -130,
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: accent,
          opacity: 0.18,
        }}
      />
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "62px 72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 78,
              height: 78,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 24,
              background: "linear-gradient(180deg, #f3c322 0%, #0d5bd7 56%, #c62839 100%)",
              color: "#fff",
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            VI
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, letterSpacing: 4, fontWeight: 700 }}>VEEDURIA</span>
            <span style={{ fontSize: 18, color: "#475467" }}>Radar ciudadano de contratos públicos</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 840 }}>
          <div
            style={{
              display: "flex",
              padding: "10px 18px",
              borderRadius: 999,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 3,
              background: "rgba(9, 19, 31, 0.06)",
              color: "#475467",
              alignSelf: "flex-start",
            }}
          >
            COLOMBIA · DATOS PÚBLICOS · IA CÍVICA
          </div>
          <div style={{ fontSize: 74, lineHeight: 1.02, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 30, lineHeight: 1.32, color: "#344054" }}>{subtitle}</div>
        </div>
      </div>
    </div>
  );
}
