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

function describeChange(current: number, baseline: number, positiveIsGood: boolean) {
  const change = current - baseline;
  const magnitude = Math.abs(change);
  if (magnitude < 0.1) {
    return { label: "No material change", improved: null as boolean | null };
  }

  const improved = positiveIsGood ? change > 0 : change < 0;
  return {
    label: `${improved ? "Improved" : "Worsened"} ${change > 0 ? "+" : ""}${change.toFixed(1)}`,
    improved,
  };
}

export function ImpactChart({ impact, compareImpact }: Props) {
  const rows = DIMENSIONS.map((d) => {
    const v = impact[d.id] ?? 0;
    const cmp = compareImpact?.[d.id];
    return { d, v, cmp };
  }).sort((a, b) => {
    if (compareImpact) {
      return Math.abs((b.v ?? 0) - (b.cmp ?? 0)) - Math.abs((a.v ?? 0) - (a.cmp ?? 0));
    }
    return Math.abs(b.v) - Math.abs(a.v);
  });

  return (
    <div className="space-y-3">
      {rows.map(({ d, v, cmp }) => {
        const beneficial = d.positiveIsGood ? v >= 0 : v <= 0;
        const magnitude = Math.abs(v);
        const width = (magnitude / 10) * 50; // half-width %
        const cmpWidth = cmp !== undefined ? (Math.abs(cmp) / 10) * 50 : 0;
        const isZero = magnitude < 0.05;
        const change = cmp !== undefined ? describeChange(v, cmp, d.positiveIsGood) : null;
        const barIsBeneficial = change?.improved ?? beneficial;
        const directionHint = d.positiveIsGood ? "Higher is better" : "Lower is better";

        return (
          <div key={d.id} className="grid gap-2 md:grid-cols-[170px_1fr_190px] md:items-center">
            <div>
              <div className="text-sm">{d.label}</div>
              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                {directionHint}
              </div>
            </div>
            <div className="relative h-8 rounded-md border hairline bg-background/60">
              <div className="absolute inset-y-0 left-1/2 w-px bg-hairline" />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute top-1/2 h-4 -translate-y-1/2 rounded-sm"
                style={{
                  left: v >= 0 ? "50%" : `${50 - width}%`,
                  background: barIsBeneficial ? "var(--color-jade)" : "var(--color-coral)",
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
              <div>{isZero ? "Unaffected" : describeImpact(v, d.positiveIsGood)}</div>
              {change && (
                <div
                  className={`mt-1 font-semibold ${
                    change.improved === null
                      ? "text-muted-foreground"
                      : change.improved
                        ? "text-jade"
                        : "text-coral"
                  }`}
                >
                  {change.label}
                </div>
              )}
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
