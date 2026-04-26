export default function VotometroLoading() {
  return (
    <div
      style={{
        minHeight: "100svh",
        background: "linear-gradient(180deg, #f7f2ea 0%, #f5efe6 48%, #f1ebe1 100%)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 48,
            height: 48,
            margin: "0 auto 1.2rem",
            borderRadius: "50%",
            border: "3px solid rgba(12,19,34,.08)",
            borderTopColor: "#0d5bd7",
            animation: "spin .8s linear infinite",
          }}
        />
        <p
          style={{
            color: "rgba(12,19,34,.42)",
            fontSize: ".88rem",
            letterSpacing: ".04em",
            fontFamily: "Sora, sans-serif",
          }}
        >
          Cargando Votómetro…
        </p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}
