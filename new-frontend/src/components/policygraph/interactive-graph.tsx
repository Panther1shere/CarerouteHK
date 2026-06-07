import { useEffect, useMemo, useRef, useState } from "react";
import type { PolicyAnalysis } from "@/lib/policygraph/analyze.functions";

type Stakeholder = PolicyAnalysis["stakeholders"][number];

const GROUP_COLOR: Record<Stakeholder["group"], string> = {
  people: "var(--color-amber)",
  market: "var(--color-coral)",
  government: "var(--color-jade)",
};

interface Node extends Stakeholder {
  x: number;
  y: number;
}

const VIEW_W = 1000;
const VIEW_H = 600;

function layout(stakeholders: Stakeholder[]): Node[] {
  const total = stakeholders.length;
  return stakeholders.map((s, i) => {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const rx = 380;
    const ry = 220;
    return { ...s, x: 500 + Math.cos(angle) * rx, y: 300 + Math.sin(angle) * ry };
  });
}

export function InteractiveGraph({ stakeholders }: { stakeholders: Stakeholder[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<Node[]>(() => layout(stakeholders));
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // re-layout when stakeholder set changes
  useEffect(() => {
    setNodes(layout(stakeholders));
    setSelectedId(null);
    setHoverId(null);
  }, [stakeholders]);

  const focusId = hoverId ?? selectedId;

  const edges = useMemo(() => {
    const active = nodes.filter((n) => Math.abs(n.impact) > 0.05);
    const out: { a: Node; b: Node; w: number }[] = [];
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        out.push({ a, b, w: Math.min(1, Math.abs(a.impact) * Math.abs(b.impact) + 0.05) });
      }
    }
    return out;
  }, [nodes]);

  function toSvg(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  function onPointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragId(id);
    setSelectedId(id);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragId) return;
    const { x, y } = toSvg(e.clientX, e.clientY);
    setNodes((prev) => prev.map((n) => (n.id === dragId ? { ...n, x, y } : n)));
  }
  function onPointerUp(e: React.PointerEvent) {
    if (dragId) {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      setDragId(null);
    }
  }

  const focusNode = focusId ? nodes.find((n) => n.id === focusId) : null;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border hairline bg-surface/40">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block h-auto w-full touch-none select-none"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={() => setSelectedId(null)}
      >
        <defs>
          <radialGradient id="hub" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-amber)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-amber)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={500} cy={300} r={260} fill="url(#hub)" />

        {edges.map(({ a, b, w }) => {
          const dim = focusId !== null && a.id !== focusId && b.id !== focusId ? 0.05 : w * 0.35;
          const stroke =
            focusId !== null && (a.id === focusId || b.id === focusId)
              ? "var(--color-amber)"
              : "var(--color-amber)";
          return (
            <line
              key={`${a.id}-${b.id}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={stroke}
              strokeOpacity={dim}
              strokeWidth={focusId && (a.id === focusId || b.id === focusId) ? 1.5 : 0.8}
            />
          );
        })}

        {nodes.map((n) => {
          const isActive = Math.abs(n.impact) > 0.05;
          const r = isActive ? 22 + Math.abs(n.impact) * 18 : 14;
          const fill =
            n.impact > 0
              ? "var(--color-amber)"
              : n.impact < 0
                ? "var(--color-coral)"
                : "var(--color-surface-2)";
          const isFocus = n.id === focusId;
          const dim = focusId !== null && !isFocus ? 0.35 : 1;
          return (
            <g
              key={n.id}
              style={{ cursor: dragId === n.id ? "grabbing" : "grab", opacity: dim }}
              onPointerDown={(e) => onPointerDown(e, n.id)}
              onPointerEnter={() => setHoverId(n.id)}
              onPointerLeave={() => setHoverId(null)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(n.id === selectedId ? null : n.id);
              }}
            >
              <circle cx={n.x} cy={n.y} r={r + 10} fill={fill} opacity={isActive ? 0.18 : 0} />
              <circle
                cx={n.x}
                cy={n.y}
                r={r}
                fill={isActive ? fill : "var(--color-surface-2)"}
                stroke={isFocus ? "var(--color-foreground)" : GROUP_COLOR[n.group]}
                strokeWidth={isFocus ? 2.5 : 1.5}
              />
              <text
                x={n.x}
                y={n.y + 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill={isActive ? "var(--color-ink)" : "var(--color-foreground)"}
                style={{ pointerEvents: "none" }}
              >
                {n.short}
              </text>
              <text
                x={n.x}
                y={n.y + r + 16}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-foreground)"
                opacity={0.85}
                style={{ pointerEvents: "none" }}
              >
                {n.label.length > 22 ? n.label.slice(0, 20) + "…" : n.label}
              </text>
              {isActive && (
                <text
                  x={n.x}
                  y={n.y + r + 30}
                  textAnchor="middle"
                  fontSize={10}
                  fill={n.impact > 0 ? "var(--color-jade)" : "var(--color-coral)"}
                  style={{ pointerEvents: "none" }}
                >
                  {n.impact > 0 ? "+" : ""}
                  {(n.impact * 100).toFixed(0)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {focusNode && (
        <div className="pointer-events-none absolute left-4 top-4 max-w-xs rounded-xl border hairline bg-background/95 p-3 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: GROUP_COLOR[focusNode.group] }}
            />
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {focusNode.group}
            </span>
          </div>
          <div className="mt-1 text-sm font-semibold">{focusNode.label}</div>
          <div className="mt-1 text-xs text-muted-foreground">{focusNode.note}</div>
          <div className="mt-2 font-mono text-[11px]">
            Impact{" "}
            <span
              style={{ color: focusNode.impact > 0 ? "var(--color-jade)" : "var(--color-coral)" }}
            >
              {focusNode.impact > 0 ? "+" : ""}
              {(focusNode.impact * 100).toFixed(0)}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t hairline px-5 py-3 text-xs text-muted-foreground">
        <Legend color="var(--color-amber)" label="People" />
        <Legend color="var(--color-coral)" label="Market" />
        <Legend color="var(--color-jade)" label="Government" />
        <span className="ml-auto font-mono uppercase tracking-[0.18em]">
          drag · hover · click to focus
        </span>
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
