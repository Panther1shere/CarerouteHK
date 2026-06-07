import { useEffect, useMemo, useRef, useState } from "react";

import type { GraphEdge, GraphFeedbackLoop, GraphNode } from "@/lib/policygraph/analyze.functions";

const LEVEL_STYLES: Record<GraphNode["level"], { fill: string; border: string; text: string }> = {
  Micro: {
    fill: "rgba(15, 23, 42, 0.06)",
    border: "rgba(15, 23, 42, 0.24)",
    text: "#0f172a",
  },
  Meso: {
    fill: "rgba(37, 99, 235, 0.08)",
    border: "rgba(37, 99, 235, 0.22)",
    text: "#1e3a8a",
  },
  Macro: {
    fill: "rgba(22, 163, 74, 0.08)",
    border: "rgba(22, 163, 74, 0.22)",
    text: "#166534",
  },
};

const EDGE_STYLES = {
  "+": { stroke: "#148443", label: "#166534", fill: "rgba(20, 132, 67, 0.14)" },
  "-": { stroke: "#d12f3f", label: "#991b1b", fill: "rgba(209, 47, 63, 0.14)" },
} as const;

const LOOP_STYLES = {
  reinforcing: {
    stroke: "rgba(29, 78, 216, 0.7)",
    fill: "rgba(29, 78, 216, 0.05)",
    label: "#1d4ed8",
  },
  balancing: {
    stroke: "rgba(13, 148, 136, 0.68)",
    fill: "rgba(13, 148, 136, 0.05)",
    label: "#0f766e",
  },
} as const;

const CANVAS_WIDTH = 1680;
const CANVAS_HEIGHT = 640;
const NODE_WIDTH = 116;
const NODE_HEIGHT = 76;
const LAYOUT_BOUNDS = {
  minX: 84,
  maxX: CANVAS_WIDTH - 84,
  minY: 72,
  maxY: CANVAS_HEIGHT - 72,
};
const LEVEL_LANES: Record<GraphNode["level"], number> = {
  Macro: 128,
  Meso: 320,
  Micro: 512,
};

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  feedbackLoops: GraphFeedbackLoop[];
  selectedNodeId: number | null;
  selectedLoopId?: number | null;
  selectedLoopNodeIds?: number[];
  selectedLoopConnectionIds?: number[];
  onSelectNode: (nodeId: number | null) => void;
  onSelectLoop?: (loopId: number) => void;
  onMoveNode: (nodeId: number, x: number, y: number) => void;
}

export function SystemMapCanvas({
  nodes,
  edges,
  feedbackLoops,
  selectedNodeId,
  selectedLoopId = null,
  selectedLoopNodeIds = [],
  selectedLoopConnectionIds = [],
  onSelectNode,
  onSelectLoop,
  onMoveNode,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [positions, setPositions] = useState<Record<number, { x: number; y: number }>>(() =>
    buildInitialPositions(nodes, edges),
  );

  useEffect(() => {
    setPositions(buildInitialPositions(nodes, edges));
  }, [nodes, edges]);

  const nodeMap = useMemo(
    () =>
      Object.fromEntries(
        nodes.map((node) => [
          node.policy_node_id,
          {
            ...node,
            x: positions[node.policy_node_id]?.x ?? node.x ?? 0,
            y: positions[node.policy_node_id]?.y ?? node.y ?? 0,
          },
        ]),
      ),
    [nodes, positions],
  );

  const activeLoopNodeIds = useMemo(() => new Set(selectedLoopNodeIds), [selectedLoopNodeIds]);
  const activeLoopConnectionIds = useMemo(
    () => new Set(selectedLoopConnectionIds),
    [selectedLoopConnectionIds],
  );
  const hasLoopSelection = activeLoopNodeIds.size > 0 || activeLoopConnectionIds.size > 0;

  const loopShapes = useMemo(
    () =>
      feedbackLoops
        .map((loop, index) => {
          const points = loop.involved_node_ids
            .map((id) => nodeMap[id])
            .filter(Boolean)
            .map((node) => ({ x: node.x, y: node.y, id: node.policy_node_id }));

          if (points.length < 2) {
            return null;
          }

          const style = LOOP_STYLES[loop.loop_type];
          const isActive = selectedLoopId === loop.feedback_loop_id;
          const path = buildLoopPath(points);
          const labelPoint = path.labelPoint;

          return {
            id: loop.feedback_loop_id,
            key: loop.loop_key ?? `${loop.loop_type}-${loop.feedback_loop_id}`,
            title: loop.loop_name,
            style,
            isActive,
            label: loop.loop_type === "reinforcing" ? `R${index + 1}` : `B${index + 1}`,
            labelPoint,
            d: path.d,
          };
        })
        .filter(Boolean),
    [feedbackLoops, nodeMap, selectedLoopId],
  );

  function toSvg(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
  }

  return (
    <div className="overflow-x-auto overflow-y-hidden rounded-3xl border hairline bg-white shadow-[0_20px_45px_rgba(15,23,42,0.05)]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        className="block h-auto min-w-[1360px] w-full touch-none select-none bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.05),transparent_32%),linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,1))]"
        onPointerMove={(event) => {
          if (dragId === null) return;
          const { x, y } = toSvg(event.clientX, event.clientY);
          setPositions((current) => ({
            ...current,
            [dragId]: clampPoint({ x, y }),
          }));
        }}
        onPointerUp={() => {
          if (dragId === null) return;
          const point = positions[dragId];
          onMoveNode(dragId, point.x, point.y);
          setDragId(null);
        }}
        onPointerLeave={() => {
          if (dragId === null) return;
          const point = positions[dragId];
          onMoveNode(dragId, point.x, point.y);
          setDragId(null);
        }}
        onClick={() => onSelectNode(null)}
      >
        <defs>
          <marker
            id="arrow-positive"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_STYLES["+"].stroke} />
          </marker>
          <marker
            id="arrow-negative"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_STYLES["-"].stroke} />
          </marker>
        </defs>
        {loopShapes.map((loop) => {
          if (!loop) return null;
          const shouldDim = selectedLoopId !== null && !loop.isActive;
          return (
            <g
              key={loop.key}
              onClick={(event) => {
                event.stopPropagation();
                onSelectLoop?.(loop.id);
              }}
              style={{ cursor: onSelectLoop ? "pointer" : "default" }}
            >
              <path
                d={loop.d}
                fill={loop.style.fill}
                stroke={loop.style.stroke}
                strokeWidth={loop.isActive ? 3 : 2}
                strokeOpacity={shouldDim ? 0.18 : loop.isActive ? 0.92 : 0.52}
                strokeDasharray={loop.isActive ? "0" : "8 8"}
              />
              <g transform={`translate(${loop.labelPoint.x - 20}, ${loop.labelPoint.y - 14})`}>
                <rect
                  width="40"
                  height="28"
                  rx="14"
                  fill="rgba(255,255,255,0.95)"
                  stroke={loop.style.stroke}
                  strokeOpacity={shouldDim ? 0.18 : 0.28}
                />
                <text
                  x="20"
                  y="18"
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill={shouldDim ? "#94a3b8" : loop.style.label}
                >
                  {loop.label}
                </text>
              </g>
            </g>
          );
        })}

        {edges.map((edge, edgeIndex) => {
          const source = nodeMap[edge.source_node_id];
          const target = nodeMap[edge.target_node_id];
          if (!source || !target) {
            return null;
          }
          const style = EDGE_STYLES[edge.polarity];
          const sourceBox = getNodeBox(source);
          const targetBox = getNodeBox(target);
          const start = edgeAnchorPoint(sourceBox, targetBox);
          const end = edgeAnchorPoint(targetBox, sourceBox);
          const route = buildEdgeRoute({
            edge,
            edgeIndex,
            edges,
            nodes,
            nodeMap,
            source,
            target,
            start,
            end,
          });
          const isActive = activeLoopConnectionIds.has(edge.connection_id);
          const isHovered =
            hoverId !== null &&
            (edge.source_node_id === hoverId || edge.target_node_id === hoverId);
          const shouldDim =
            (hasLoopSelection && !isActive) ||
            (selectedNodeId !== null &&
              edge.source_node_id !== selectedNodeId &&
              edge.target_node_id !== selectedNodeId);
          return (
            <g key={edge.connection_id}>
              <title>{`${source.label} ${edge.relationship_type} ${target.label}: ${edge.explanation}`}</title>
              <path
                d={route.path}
                stroke={style.stroke}
                strokeWidth={isActive || isHovered ? "3" : "2"}
                strokeOpacity={shouldDim ? 0.14 : isActive || isHovered ? 0.95 : 0.62}
                fill="none"
                markerEnd={`url(#arrow-${edge.polarity === "+" ? "positive" : "negative"})`}
              />
              <rect
                x={route.label.x - 18}
                y={route.label.y - 12}
                width="36"
                height="24"
                rx="12"
                fill={shouldDim ? "rgba(255,255,255,0.92)" : style.fill}
                stroke={style.stroke}
                strokeOpacity={shouldDim ? 0.12 : 0.24}
              />
              <text
                x={route.label.x}
                y={route.label.y + 4}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={shouldDim ? "#94a3b8" : style.label}
              >
                {edge.polarity}ve
              </text>
            </g>
          );
        })}

        {nodes.map((node) => {
          const active = node.policy_node_id === selectedNodeId;
          const hovered = node.policy_node_id === hoverId;
          const pos = nodeMap[node.policy_node_id];
          const style = LEVEL_STYLES[node.level];
          const { width, height } = getNodeBox(node);
          const isLoopNode = activeLoopNodeIds.has(node.policy_node_id);
          const shouldDim = hasLoopSelection && !isLoopNode;
          return (
            <g
              key={node.policy_node_id}
              transform={`translate(${pos.x - width / 2}, ${pos.y - height / 2})`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectNode(node.policy_node_id);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                setDragId(node.policy_node_id);
              }}
              onPointerEnter={() => setHoverId(node.policy_node_id)}
              onPointerLeave={() =>
                setHoverId((current) => (current === node.policy_node_id ? null : current))
              }
              style={{ cursor: dragId === node.policy_node_id ? "grabbing" : "grab" }}
            >
              <title>{`${node.label}: ${node.description}`}</title>
              <rect
                width={width}
                height={height}
                rx="20"
                fill={
                  active
                    ? "rgba(29, 78, 216, 0.12)"
                    : shouldDim
                      ? "rgba(255,255,255,0.72)"
                      : style.fill
                }
                stroke={active ? "#1d4ed8" : isLoopNode ? "#0f172a" : style.border}
                strokeWidth={active ? 2.6 : hovered || isLoopNode ? 2 : 1.3}
                opacity={shouldDim ? 0.45 : 1}
                filter={
                  active || hovered
                    ? "drop-shadow(0 18px 30px rgba(29, 78, 216, 0.16))"
                    : "drop-shadow(0 12px 24px rgba(15, 23, 42, 0.08))"
                }
              />
              <circle
                cx="23"
                cy="24"
                r="9"
                fill="rgba(255,255,255,0.9)"
                stroke={style.border}
                strokeWidth="1"
              />
              <text
                x="23"
                y="28"
                textAnchor="middle"
                fontSize="10.5"
                fontWeight="800"
                fill={style.text}
              >
                {node.level.slice(0, 1)}
              </text>
              <text
                x={width - 16}
                y="29"
                textAnchor="end"
                fontSize="10"
                fontWeight="700"
                fill={style.text}
              >
                {node.category.slice(0, 12)}
              </text>
              <text
                x={width / 2}
                y="53"
                textAnchor="middle"
                fontSize="17"
                fontWeight="800"
                fill="#0f172a"
              >
                {buildNodeInitials(node.label)}
              </text>
            </g>
          );
        })}

        {nodes.map((node) => {
          const visible = node.policy_node_id === hoverId || node.policy_node_id === selectedNodeId;
          if (!visible) return null;
          const pos = nodeMap[node.policy_node_id];
          const tooltip = getTooltipBox(node, pos);
          const style = LEVEL_STYLES[node.level];
          return (
            <g
              key={`label-${node.policy_node_id}`}
              transform={`translate(${tooltip.x}, ${tooltip.y})`}
              pointerEvents="none"
            >
              <rect
                width={tooltip.width}
                height={tooltip.height}
                rx="16"
                fill="rgba(255,255,255,0.96)"
                stroke={activeLoopNodeIds.has(node.policy_node_id) ? "#0f172a" : style.border}
                strokeWidth="1.2"
                filter="drop-shadow(0 16px 28px rgba(15,23,42,0.14))"
              />
              <text x="14" y="23" fontSize="15" fontWeight="800" fill="#0f172a">
                {node.label}
              </text>
              <text x="14" y="42" fontSize="11" fontWeight="700" fill={style.text}>
                {node.level} · {node.category}
              </text>
              <text x="14" y="61" fontSize="11" fill="#64748b">
                {truncate(node.description, Math.max(42, Math.floor((tooltip.width - 28) / 6.1)))}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center gap-4 border-t hairline bg-surface px-5 py-3 text-xs text-muted-foreground">
        <Legend tone="rgba(15, 23, 42, 0.24)" label="Micro node" />
        <Legend tone="rgba(37, 99, 235, 0.22)" label="Meso node" />
        <Legend tone="rgba(22, 163, 74, 0.22)" label="Macro node" />
        <Legend tone="#15803d" label="Positive (+) arrow" />
        <Legend tone="#dc2626" label="Negative (-) arrow" />
        <span className="ml-auto font-mono uppercase tracking-[0.18em]">
          hover for names · click to inspect · drag to iterate
        </span>
      </div>
    </div>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: tone }} />
      <span>{label}</span>
    </div>
  );
}

function truncate(value: string, max: number) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

type PositionedGraphNode = GraphNode & { x: number; y: number };

function getNodeBox(node: Pick<GraphNode, "label" | "description"> & { x?: number; y?: number }) {
  const width = NODE_WIDTH;
  const height = NODE_HEIGHT;
  return { x: node.x ?? 0, y: node.y ?? 0, width, height };
}

function buildNodeInitials(label: string) {
  const words = label
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "N";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function getTooltipBox(node: GraphNode, pos: { x: number; y: number }) {
  const width = Math.min(Math.max(node.label.length * 7.5 + 72, 230), 360);
  const height = 76;
  return {
    width,
    height,
    x: clamp(pos.x - width / 2, 18, CANVAS_WIDTH - width - 18),
    y: clamp(pos.y - 116, 18, CANVAS_HEIGHT - height - 18),
  };
}

function edgeAnchorPoint(
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const halfWidth = from.width / 2;
  const halfHeight = from.height / 2;

  if (dx === 0 && dy === 0) {
    return { x: from.x, y: from.y };
  }

  const scaleX = Math.abs(dx) > 0 ? halfWidth / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const scaleY = Math.abs(dy) > 0 ? halfHeight / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const scale = Math.min(scaleX, scaleY);

  return {
    x: from.x + dx * scale,
    y: from.y + dy * scale,
  };
}

function buildEdgeRoute({
  edge,
  edgeIndex,
  edges,
  nodes,
  nodeMap,
  source,
  target,
  start,
  end,
}: {
  edge: GraphEdge;
  edgeIndex: number;
  edges: GraphEdge[];
  nodes: GraphNode[];
  nodeMap: Record<number, PositionedGraphNode>;
  source: PositionedGraphNode;
  target: PositionedGraphNode;
  start: { x: number; y: number };
  end: { x: number; y: number };
}) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const normal = { x: -dy / length, y: dx / length };
  const siblingEdges = edges.filter(
    (item) =>
      (item.source_node_id === edge.source_node_id &&
        item.target_node_id === edge.target_node_id) ||
      (item.source_node_id === edge.target_node_id && item.target_node_id === edge.source_node_id),
  );
  const siblingIndex = Math.max(
    siblingEdges.findIndex((item) => item.connection_id === edge.connection_id),
    0,
  );
  const siblingOffset = (siblingIndex - (siblingEdges.length - 1) / 2) * 22;
  const directionOffset = source.x <= target.x ? 1 : -1;
  const idOffset = ((edgeIndex % 5) - 2) * 7;
  const baseOffset = Math.min(52, Math.max(22, length * 0.075));
  let curveOffset = (baseOffset + Math.abs(siblingOffset) + Math.abs(idOffset)) * directionOffset;

  const otherBoxes = nodes
    .filter(
      (node) =>
        node.policy_node_id !== edge.source_node_id && node.policy_node_id !== edge.target_node_id,
    )
    .map((node) => {
      const pos = nodeMap[node.policy_node_id];
      return pos ? getNodeBox(pos) : null;
    })
    .filter((box): box is ReturnType<typeof getNodeBox> => Boolean(box));

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const control = {
      x: start.x + dx / 2 + normal.x * (curveOffset + siblingOffset + idOffset),
      y: start.y + dy / 2 + normal.y * (curveOffset + siblingOffset + idOffset),
    };
    const crossesNode = otherBoxes.some((box) => curvePassesNearBox(start, control, end, box));
    if (!crossesNode) {
      return {
        path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
        label: {
          x: start.x + dx / 2 + normal.x * (curveOffset + siblingOffset + idOffset + 18),
          y: start.y + dy / 2 + normal.y * (curveOffset + siblingOffset + idOffset + 18),
        },
      };
    }
    curveOffset += 28 * directionOffset;
  }

  const control = {
    x: start.x + dx / 2 + normal.x * (curveOffset + siblingOffset + idOffset),
    y: start.y + dy / 2 + normal.y * (curveOffset + siblingOffset + idOffset),
  };
  return {
    path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    label: {
      x: start.x + dx / 2 + normal.x * (curveOffset + siblingOffset + idOffset + 18),
      y: start.y + dy / 2 + normal.y * (curveOffset + siblingOffset + idOffset + 18),
    },
  };
}

function curvePassesNearBox(
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
  box: { x: number; y: number; width: number; height: number },
) {
  const padding = 18;
  for (let step = 1; step < 8; step += 1) {
    const t = step / 8;
    const x = (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x;
    const y = (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y;
    if (
      x >= box.x - box.width / 2 - padding &&
      x <= box.x + box.width / 2 + padding &&
      y >= box.y - box.height / 2 - padding &&
      y <= box.y + box.height / 2 + padding
    ) {
      return true;
    }
  }
  return false;
}

function buildLoopPath(points: { x: number; y: number }[]) {
  const centroid = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };

  if (points.length === 2) {
    const [first, second] = points;
    const minX = Math.min(first.x, second.x) - 90;
    const maxX = Math.max(first.x, second.x) + 90;
    const minY = Math.min(first.y, second.y) - 72;
    const maxY = Math.max(first.y, second.y) + 72;
    const width = maxX - minX;
    const height = maxY - minY;

    return {
      d: `M ${minX + 28} ${minY}
          H ${maxX - 28}
          Q ${maxX} ${minY} ${maxX} ${minY + 28}
          V ${maxY - 28}
          Q ${maxX} ${maxY} ${maxX - 28} ${maxY}
          H ${minX + 28}
          Q ${minX} ${maxY} ${minX} ${maxY - 28}
          V ${minY + 28}
          Q ${minX} ${minY} ${minX + 28} ${minY}
          Z`,
      labelPoint: { x: minX + width / 2, y: minY - 18 },
    };
  }

  const expanded = points
    .map((point) => {
      const dx = point.x - centroid.x;
      const dy = point.y - centroid.y;
      const length = Math.max(Math.hypot(dx, dy), 1);
      const padding = 64;
      return {
        x: point.x + (dx / length) * padding,
        y: point.y + (dy / length) * padding,
        angle: Math.atan2(dy, dx),
      };
    })
    .sort((left, right) => left.angle - right.angle);

  const d = expanded
    .map((point, index) => {
      const next = expanded[(index + 1) % expanded.length];
      const mid = {
        x: (point.x + next.x) / 2,
        y: (point.y + next.y) / 2,
      };
      return index === 0
        ? `M ${mid.x} ${mid.y} Q ${point.x} ${point.y} ${mid.x} ${mid.y}`
        : `Q ${point.x} ${point.y} ${mid.x} ${mid.y}`;
    })
    .join(" ");

  const topPoint = expanded.reduce((current, candidate) =>
    candidate.y < current.y ? candidate : current,
  );

  return {
    d: `${d} Z`,
    labelPoint: { x: topPoint.x, y: topPoint.y - 18 },
  };
}

function buildInitialPositions(nodes: GraphNode[], edges: GraphEdge[]) {
  const persisted = Object.fromEntries(
    nodes.map((node) => [node.policy_node_id, clampPoint({ x: node.x ?? 0, y: node.y ?? 0 })]),
  );
  const hasFullPositions = nodes.every(
    (node) => typeof node.x === "number" && typeof node.y === "number",
  );
  if (hasFullPositions && isUsablePersistedLayout(nodes, persisted)) {
    return persisted;
  }

  const grouped = {
    Micro: nodes.filter((node) => node.level === "Micro"),
    Meso: nodes.filter((node) => node.level === "Meso"),
    Macro: nodes.filter((node) => node.level === "Macro"),
  } satisfies Record<GraphNode["level"], GraphNode[]>;
  const orderScore = buildOrderScore(nodes, edges);

  const next: Record<number, { x: number; y: number }> = {};
  const anchors: Record<number, { x: number; y: number }> = {};
  (Object.keys(grouped) as GraphNode["level"][]).forEach((level) => {
    const items = [...grouped[level]].sort((left, right) => {
      const score =
        (orderScore.get(left.policy_node_id) ?? 0) - (orderScore.get(right.policy_node_id) ?? 0);
      return score || left.policy_node_id - right.policy_node_id;
    });
    const laneY = LEVEL_LANES[level];
    const startX = LAYOUT_BOUNDS.minX + 72;
    const endX = LAYOUT_BOUNDS.maxX - 72;
    items.forEach((node, index) => {
      const count = Math.max(items.length, 1);
      const x = count === 1 ? CANVAS_WIDTH / 2 : startX + (index * (endX - startX)) / (count - 1);
      const y = laneY + ((index % 3) - 1) * 18;
      anchors[node.policy_node_id] = { x, y: laneY };
      next[node.policy_node_id] = { x, y };
    });
  });
  return relaxLayout(nodes, edges, next, anchors);
}

function relaxLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  positions: Record<number, { x: number; y: number }>,
  anchors: Record<number, { x: number; y: number }>,
) {
  const next = Object.fromEntries(
    Object.entries(positions).map(([id, point]) => [Number(id), { ...point }]),
  );
  const nodeMap = new Map(nodes.map((node) => [node.policy_node_id, node]));
  const desiredGap = 164;

  for (let iteration = 0; iteration < 220; iteration += 1) {
    const forces: Record<number, { x: number; y: number }> = Object.fromEntries(
      nodes.map((node) => [node.policy_node_id, { x: 0, y: 0 }]),
    );

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const left = nodes[i];
        const right = nodes[j];
        const a = next[left.policy_node_id];
        const b = next[right.policy_node_id];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let distance = Math.hypot(dx, dy);
        if (distance < 1) {
          dx = (left.policy_node_id % 7) - 3 || 1;
          dy = (right.policy_node_id % 5) - 2 || 1;
          distance = Math.hypot(dx, dy);
        }
        const repulsion = Math.min(26, (desiredGap * desiredGap) / (distance * distance));
        forces[left.policy_node_id].x += (dx / distance) * repulsion;
        forces[left.policy_node_id].y += (dy / distance) * repulsion;
        forces[right.policy_node_id].x -= (dx / distance) * repulsion;
        forces[right.policy_node_id].y -= (dy / distance) * repulsion;
      }
    }

    for (const edge of edges) {
      const source = nodeMap.get(edge.source_node_id);
      const target = nodeMap.get(edge.target_node_id);
      if (!source || !target) continue;
      const a = next[source.policy_node_id];
      const b = next[target.policy_node_id];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.max(Math.hypot(dx, dy), 1);
      const preferred = source.level === target.level ? 190 : 285;
      const pull = (distance - preferred) * 0.009;
      const flowGap = source.level === target.level ? 130 : 170;
      const flowPush = Math.max(0, flowGap - dx) * 0.006;
      forces[source.policy_node_id].x += (dx / distance) * pull;
      forces[source.policy_node_id].y += (dy / distance) * pull;
      forces[target.policy_node_id].x -= (dx / distance) * pull;
      forces[target.policy_node_id].y -= (dy / distance) * pull;
      forces[source.policy_node_id].x -= flowPush;
      forces[target.policy_node_id].x += flowPush;
    }

    for (const node of nodes) {
      const point = next[node.policy_node_id];
      const force = forces[node.policy_node_id];
      const anchor = anchors[node.policy_node_id] ?? {
        x: CANVAS_WIDTH / 2,
        y: LEVEL_LANES[node.level],
      };
      force.x += (anchor.x - point.x) * 0.018;
      force.y += (anchor.y - point.y) * 0.075;
      const moved = clampPoint({
        x: point.x + force.x * 0.34,
        y: point.y + force.y * 0.34,
      });
      point.x = moved.x;
      point.y = moved.y;
    }
  }

  for (let pass = 0; pass < 60; pass += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = next[nodes[i].policy_node_id];
        const b = next[nodes[j].policy_node_id];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.max(Math.hypot(dx, dy), 1);
        if (distance >= desiredGap) continue;
        const push = (desiredGap - distance) / 2;
        const nx = dx / distance;
        const ny = dy / distance;
        const nextA = clampPoint({ x: a.x - nx * push, y: a.y - ny * push });
        const nextB = clampPoint({ x: b.x + nx * push, y: b.y + ny * push });
        a.x = nextA.x;
        a.y = nextA.y;
        b.x = nextB.x;
        b.y = nextB.y;
      }
    }
  }

  return next;
}

function buildOrderScore(nodes: GraphNode[], edges: GraphEdge[]) {
  const score = new Map(nodes.map((node) => [node.policy_node_id, 0]));
  for (const edge of edges) {
    score.set(edge.source_node_id, (score.get(edge.source_node_id) ?? 0) - 1);
    score.set(edge.target_node_id, (score.get(edge.target_node_id) ?? 0) + 1);
  }
  return score;
}

function isUsablePersistedLayout(
  nodes: GraphNode[],
  positions: Record<number, { x: number; y: number }>,
) {
  if (hasNodeOverlap(nodes, positions)) {
    return false;
  }
  const points = nodes
    .map((node) => positions[node.policy_node_id])
    .filter((point): point is { x: number; y: number } => Boolean(point));
  if (points.length < 2) {
    return true;
  }
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const hasWideSpread = maxX - minX > CANVAS_WIDTH * 0.62;
  const allInside = points.every(
    (point) =>
      point.x >= LAYOUT_BOUNDS.minX &&
      point.x <= LAYOUT_BOUNDS.maxX &&
      point.y >= LAYOUT_BOUNDS.minY &&
      point.y <= LAYOUT_BOUNDS.maxY,
  );
  return hasWideSpread && allInside;
}

function hasNodeOverlap(nodes: GraphNode[], positions: Record<number, { x: number; y: number }>) {
  const points = nodes
    .filter((node) => typeof node.x === "number" && typeof node.y === "number")
    .map((node) => ({
      id: node.policy_node_id,
      x: positions[node.policy_node_id]?.x ?? (node.x as number),
      y: positions[node.policy_node_id]?.y ?? (node.y as number),
    }));
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      if (Math.hypot(dx, dy) < 132) {
        return true;
      }
    }
  }
  return false;
}

function clampPoint(point: { x: number; y: number }) {
  return {
    x: clamp(point.x, LAYOUT_BOUNDS.minX, LAYOUT_BOUNDS.maxX),
    y: clamp(point.y, LAYOUT_BOUNDS.minY, LAYOUT_BOUNDS.maxY),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
