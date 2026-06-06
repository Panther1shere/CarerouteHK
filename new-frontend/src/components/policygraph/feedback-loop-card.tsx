import { motion } from "framer-motion";
import type { FeedbackLoop } from "@/lib/policygraph/loops";

export function FeedbackLoopCard({ loop, index }: { loop: FeedbackLoop; index: number }) {
  const isReinforcing = loop.type === "R";
  const accent = isReinforcing ? "var(--color-coral)" : "var(--color-jade)";

  const steps = loop.chain;
  const n = steps.length;

  // Circle geometry
  const size = 520;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 150;

  const positions = steps.map((_, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      angle,
    };
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 * index }}
      className="rounded-2xl border hairline bg-surface/50 p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-display text-xl font-semibold leading-tight">{loop.title}</h4>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
          style={{ background: accent, color: "var(--color-ink)" }}
        >
          {isReinforcing ? "Reinforcing" : "Balancing"}
        </span>
      </div>

      <div className="mt-6 flex justify-center overflow-hidden">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full max-w-[520px] h-auto"
          role="img"
          aria-label={`${loop.title} feedback loop`}
        >
          <defs>
            <marker
              id={`arrow-${loop.id}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={accent} />
            </marker>
          </defs>

          {/* Faint guide circle */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={accent}
            strokeOpacity="0.08"
            strokeWidth="1"
          />

          {/* Arcs between nodes */}
          {positions.map((p, i) => {
            const next = positions[(i + 1) % n];
            const gap = ((Math.PI * 2) / n) * 0.18;
            const a1 = p.angle + gap;
            const a2 = next.angle - gap;
            const x1 = cx + Math.cos(a1) * radius;
            const y1 = cy + Math.sin(a1) * radius;
            const x2 = cx + Math.cos(a2) * radius;
            const y2 = cy + Math.sin(a2) * radius;
            return (
              <motion.path
                key={i}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: 0.1 * i + 0.15 * index, duration: 0.5 }}
                d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
                fill="none"
                stroke={accent}
                strokeWidth="1.5"
                strokeOpacity="0.55"
                markerEnd={`url(#arrow-${loop.id})`}
              />
            );
          })}

          {/* Center R/B sigil */}
          <circle cx={cx} cy={cy} r="34" fill="var(--color-ink, #0b0b0c)" stroke={accent} strokeOpacity="0.4" />
          <text
            x={cx}
            y={cy + 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="26"
            fontWeight="700"
            fill={accent}
            className="font-display"
          >
            {isReinforcing ? "R" : "B"}
          </text>
          <text
            x={cx}
            y={cy + 22}
            textAnchor="middle"
            fontSize="8"
            fill="#ffffff"
            opacity="0.55"
            className="font-mono uppercase"
            style={{ letterSpacing: "0.15em" }}
          >
            {isReinforcing ? "reinforce" : "balance"}
          </text>


          {/* Node chips */}
          {positions.map((p, i) => {
            const step = steps[i];
            const label = capitalize(step.node);
            const effect = step.effect;
            // Dynamic chip dimensions based on text length
            const padX = 16;
            const labelW = label.length * 6.6 + padX;
            const effectW = effect.length * 5.4 + padX;
            const chipW = Math.max(labelW, effectW, 100);
            const chipH = 44;
            return (
              <motion.g
                key={i}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * i + 0.2 * index }}
              >
                <rect
                  x={p.x - chipW / 2}
                  y={p.y - chipH / 2}
                  width={chipW}
                  height={chipH}
                  rx="8"
                  fill="var(--color-ink, #0b0b0c)"
                  stroke={accent}
                  strokeWidth="1.5"
                  strokeOpacity="0.7"
                />
                <text
                  x={p.x}
                  y={p.y - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#ffffff"
                  className="font-mono"
                >
                  {label}
                </text>
                <text
                  x={p.x}
                  y={p.y + 10}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#ffffff"
                  opacity="0.75"
                  className="font-mono"
                >
                  {effect}
                </text>

              </motion.g>
            );
          })}
        </svg>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{loop.summary}</p>
    </motion.div>
  );
}

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

