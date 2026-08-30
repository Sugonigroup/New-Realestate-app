/** SVG Gantt (U3, 04 §2): bars per activity from the CPM result, critical path red. */
interface CpmNode { es: number; ef: number; ls: number; lf: number; float: number; critical: boolean }
interface CpmResult { nodes: Record<string, CpmNode>; projectDuration: number; criticalPath: string[] }

const BAR_H = 22;
const ROW_H = 34;
const LABEL_W = 180;
const DAY_W = 8;

export default function Gantt({ schedule }: { schedule: CpmResult }) {
  const ids = Object.keys(schedule.nodes);
  if (ids.length === 0) {
    return <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>No activities scheduled.</p>;
  }
  const width = LABEL_W + schedule.projectDuration * DAY_W + 40;
  const height = ids.length * ROW_H + 40;

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <svg width={width} height={height} role="img" aria-label="Project Gantt chart">
        {/* day gridlines every 30d */}
        {Array.from({ length: Math.ceil(schedule.projectDuration / 30) + 1 }, (_, i) => i * 30).map((d) => (
          <line key={d} x1={LABEL_W + d * DAY_W} y1={0} x2={LABEL_W + d * DAY_W} y2={height}
            stroke="var(--bo-border)" strokeWidth={1} />
        ))}
        {ids.map((id, i) => {
          const n = schedule.nodes[id]!;
          const y = i * ROW_H + 10;
          const color = n.critical ? "var(--bo-danger)" : "var(--bo-primary)";
          return (
            <g key={id}>
              <text x={8} y={y + BAR_H / 2 + 4} fontSize={11} fill="var(--bo-text)">{id}</text>
              {/* float ghost */}
              <rect x={LABEL_W + n.es * DAY_W} y={y + BAR_H / 2 - 2} width={n.float * DAY_W} height={4}
                fill="var(--bo-border)" rx={2} />
              {/* bar */}
              <rect x={LABEL_W + n.es * DAY_W} y={y} width={n.ef * DAY_W - n.es * DAY_W} height={BAR_H}
                fill={color} rx={4} opacity={n.critical ? 1 : 0.75} />
              <text x={LABEL_W + n.es * DAY_W + 6} y={y + BAR_H / 2 + 4} fontSize={10} fill="white">
                {n.es}–{n.ef}{n.float > 0 ? ` (float ${n.float}d)` : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
