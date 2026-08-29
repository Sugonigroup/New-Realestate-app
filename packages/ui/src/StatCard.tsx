/** KPI tile: value + delta vs target/last period (08 dashboard conventions). */
export function StatCard({
  label,
  value,
  deltaPct,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  deltaPct?: number;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneColor =
    tone === "success" ? "var(--bo-success)" : tone === "warning" ? "var(--bo-warning)" : tone === "danger" ? "var(--bo-danger)" : "var(--bo-text)";
  return (
    <div
      style={{
        background: "var(--bo-surface)",
        border: "1px solid var(--bo-border)",
        borderRadius: "var(--bo-radius)",
        padding: "16px",
        minWidth: 180,
      }}
    >
      <div style={{ color: "var(--bo-text-muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ color: toneColor, fontSize: 22, fontWeight: 600, marginTop: 4 }}>{value}</div>
      {deltaPct !== undefined && (
        <div style={{ color: deltaPct >= 0 ? "var(--bo-success)" : "var(--bo-danger)", fontSize: 12, marginTop: 2 }}>
          {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}%
        </div>
      )}
    </div>
  );
}
