export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 20,
      }}
    >
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{title}</h1>
        {subtitle && (
          <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: 14 }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}
