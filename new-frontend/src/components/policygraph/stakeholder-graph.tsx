import { motion } from "framer-motion";
import { STAKEHOLDERS, nodePosition, type StakeholderId } from "@/lib/policygraph/stakeholders";

interface Props {
  affected: Record<string, number>;
}

const groupColor: Record<string, string> = {
  people: "var(--color-amber)",
  market: "var(--color-coral)",
  government: "var(--color-jade)",
};

export function StakeholderGraph({ affected }: Props) {
  const total = STAKEHOLDERS.length;
  const positions = STAKEHOLDERS.map((s, i) => ({ ...s, ...nodePosition(i, total) }));

  // edges between active nodes
  const active = positions.filter((p) => Math.abs(affected[p.id] ?? 0) > 0.05);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border hairline bg-surface/40 grain">
      <svg viewBox="0 0 1000 600" className="block h-auto w-full">
        <defs>
          <radialGradient id="hub" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-amber)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-amber)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={500} cy={300} r={260} fill="url(#hub)" />

        {/* connection lines from hub-like centroid */}
        {active.map((a, i) =>
          active.slice(i + 1).map((b) => {
            const intensity = Math.min(
              1,
              Math.abs(affected[a.id]) * Math.abs(affected[b.id]) + 0.05,
            );
            return (
              <motion.line
                key={`${a.id}-${b.id}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--color-amber)"
                strokeOpacity={intensity * 0.25}
                strokeWidth={0.8}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              />
            );
          }),
        )}

        {positions.map((p, i) => {
          const w = affected[p.id] ?? 0;
          const isActive = Math.abs(w) > 0.05;
          const radius = isActive ? 22 + Math.abs(w) * 18 : 14;
          const fill =
            w > 0 ? "var(--color-amber)" : w < 0 ? "var(--color-coral)" : "var(--color-surface-2)";
          return (
            <motion.g
              key={p.id}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.03 * i, type: "spring", stiffness: 180, damping: 18 }}
            >
              <circle cx={p.x} cy={p.y} r={radius + 8} fill={fill} opacity={isActive ? 0.18 : 0} />
              <circle
                cx={p.x}
                cy={p.y}
                r={radius}
                fill={isActive ? fill : "var(--color-surface-2)"}
                stroke={groupColor[p.group]}
                strokeWidth={1.5}
                opacity={isActive ? 1 : 0.7}
              />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                className="font-mono"
                fontSize={11}
                fontWeight={600}
                fill={isActive ? "var(--color-ink)" : "var(--color-foreground)"}
              >
                {p.short}
              </text>
              <text
                x={p.x}
                y={p.y + radius + 18}
                textAnchor="middle"
                fontSize={11}
                fill="var(--color-foreground)"
                opacity={0.85}
              >
                {p.label}
              </text>
              {isActive && (
                <text
                  x={p.x}
                  y={p.y + radius + 32}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={10}
                  fill={w > 0 ? "var(--color-jade)" : "var(--color-coral)"}
                >
                  {w > 0 ? "+" : ""}
                  {(w * 100).toFixed(0)}
                </text>
              )}
            </motion.g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center gap-4 border-t hairline px-5 py-3 text-xs text-muted-foreground">
        <Legend color="var(--color-amber)" label="People" />
        <Legend color="var(--color-coral)" label="Market actors" />
        <Legend color="var(--color-jade)" label="Government" />
        <div className="ml-auto font-mono uppercase tracking-[0.18em]">
          {active.length} of {total} stakeholders engaged
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

export type { StakeholderId };
