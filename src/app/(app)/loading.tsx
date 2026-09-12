export default function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted)" }}>
        <span
          style={{
            width: 18,
            height: 18,
            border: "2px solid var(--line)",
            borderTopColor: "var(--brand)",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 0.7s linear infinite",
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Loading…</span>
      </div>
      {/* Skeleton rows */}
      <div className="card" style={{ padding: 16 }}>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            style={{
              height: 16,
              borderRadius: 6,
              background: "linear-gradient(90deg,#eef1f4 25%,#f6f8fa 37%,#eef1f4 63%)",
              backgroundSize: "400% 100%",
              animation: "shimmer 1.2s ease infinite",
              margin: "10px 0",
              width: `${90 - i * 8}%`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
      `}</style>
    </div>
  );
}
