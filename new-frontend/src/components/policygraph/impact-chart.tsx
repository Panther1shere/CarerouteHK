import { motion } from "framer-motion";
import { DIMENSIONS, type Dimension } from "@/lib/policygraph/policies";

interface Props {
  impact: Record<Dimension, number>;
  compareImpact?: Record<Dimension, number>;
}

function describeImpact(v: number, positiveIsGood: boolean) {
  const mag = Math.abs(v);
  if (mag < 1) return "Unaffected";

  const beneficial = positiveIsGood ? v >= 0 : v <= 0;
  const dir = beneficial ? "Positive" : "Negative";

  if (mag <= 20) return `Slightly ${dir.toLowerCase()}`;
  if (mag <= 50) return `Moderately ${dir.toLowerCase()}`;
  if (mag <= 80) return `Very ${dir.toLowerCase()}`;
  return `Extremely ${dir.toLowerCase()}`;
}

export function ImpactChart({ impact, compareImpact }: Props) {
  const rows = DIMENSIONS.map((d) => {
    const v = impact[d.id] ?? 0;
    const cmp = compareImpact?.[d.id];
    return { d, v, cmp };
  }).sort((a, b) => b.v - a.v);

  return (
    <div className="space-y-3">
      {rows.map(({ d, v, cmp }) => {
        const beneficial = d.positiveIsGood ? v >= 0 : v <= 0;
        const magnitude = Math.abs(v);
        const width = (magnitude / 10) * 50; // half-width %
        const cmpWidth = cmp !== undefined ? (Math.abs(cmp) / 10) * 50 : 0;
        const isZero = magnitude < 0.05;

        return (
          <div key={d.id} className="grid grid-cols-[160px_1fr_140px] items-center gap-3">
            <div className="text-sm">{d.label}</div>
            <div className="relative h-8 rounded-md border hairline bg-background/60">
              <div className="absolute inset-y-0 left-1/2 w-px bg-hairline" />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute top-1/2 h-4 -translate-y-1/2 rounded-sm"
                style={{
                  left: v >= 0 ? "50%" : `${50 - width}%`,
                  background: beneficial ? "var(--color-jade)" : "var(--color-coral)",
                }}
              />
              {compareImpact !== undefined && cmp !== undefined && (
                <div
                  className="pointer-events-none absolute top-1/2 h-7 -translate-y-1/2 rounded-sm border-2 border-dashed"
                  style={{
                    left: cmp >= 0 ? "50%" : `${50 - cmpWidth}%`,
                    width: `${cmpWidth}%`,
                    borderColor: "var(--color-foreground)",
                    background: "transparent",
                  }}
                />
              )}
            </div>
            <div className="text-right text-xs uppercase tracking-wider text-muted-foreground">
              {isZero ? "Unaffected" : describeImpact(v, d.positiveIsGood)}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--color-jade)" }} />
          Beneficial
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--color-coral)" }} />
          Counterproductive
        </span>
        {compareImpact && (
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-3 border border-dashed"
              style={{ borderColor: "var(--color-muted-foreground)" }}
            />
            Baseline
          </span>
        )}
      </div>
    </div>
  );
}
