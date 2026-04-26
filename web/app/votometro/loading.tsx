export default function VotometroLoading() {
  return (
    <div
      style={{
        minHeight: "100svh",
        background: "#07090e",
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
            border: "3px solid rgba(255,255,255,.08)",
            borderTopColor: "#0d5bd7",
            animation: "spin .8s linear infinite",
          }}
        />
        <p
          style={{
            color: "rgba(255,255,255,.4)",
            fontSize: ".88rem",
            letterSpacing: ".04em",
          }}
        >
          Cargando Votómetro…
        </p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}
