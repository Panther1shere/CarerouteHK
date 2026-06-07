import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Home, Loader2, ShieldCheck, Target } from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";

import { loadDemoPolicyGraph, type DemoPolicyGraph } from "@/lib/policygraph/analyze.functions";
import { SiteHeader } from "@/components/site-chrome";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "PolicyGraph HK Demo" },
      {
        name: "description",
        content:
          "A fixed demo of vacancy-tax policy mapping with stakeholders, feedback loops, leverage points, and impact comparison.",
      },
    ],
  }),
  component: DemoRoute,
});

const TONE_STYLES = {
  government: {
    fill: "#e8f0ff",
    stroke: "#31578d",
    text: "#17345d",
    glow: "rgba(49,87,141,0.18)",
  },
  market: {
    fill: "#fff2dc",
    stroke: "#b56b16",
    text: "#6f3c08",
    glow: "rgba(181,107,22,0.18)",
  },
  people: {
    fill: "#e7f8ef",
    stroke: "#198454",
    text: "#0f5132",
    glow: "rgba(25,132,84,0.18)",
  },
  housing: {
    fill: "#f0ecff",
    stroke: "#6653b8",
    text: "#35256d",
    glow: "rgba(102,83,184,0.18)",
  },
  finance: {
    fill: "#edf7fb",
    stroke: "#0f7895",
    text: "#07546a",
    glow: "rgba(15,120,149,0.18)",
  },
} as const;

function DemoRoute() {
  const loadDemo = useServerFn(loadDemoPolicyGraph);
  const demo = useQuery({
    queryKey: ["policygraph-demo"],
    queryFn: () => loadDemo(),
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (demo.isPending) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f2ea]">
        <div className="flex items-center gap-3 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm text-stone-600 shadow-xl">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading fixed demo
        </div>
      </main>
    );
  }

  if (demo.error || !demo.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f2ea] px-6">
        <div className="max-w-md rounded-3xl border border-red-200 bg-white p-6 text-center shadow-xl">
          <h1 className="text-lg font-semibold text-stone-900">Demo unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            The fixed backend demo payload could not be loaded. Check that the backend is running.
          </p>
        </div>
      </main>
    );
  }

  return <DemoExperience data={demo.data} />;
}

function DemoExperience({ data }: { data: DemoPolicyGraph }) {
  const [activeLoopId, setActiveLoopId] = useState(data.loops[0]?.id ?? "");
  const [activeNodeId, setActiveNodeId] = useState(data.policy.intervention.leverage_node);
  const activeLoop = data.loops.find((loop) => loop.id === activeLoopId) ?? data.loops[0];

  return (
    <div className="min-h-screen overflow-hidden bg-background text-[#172033]">
      <SiteHeader />
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute -left-28 top-12 h-96 w-96 rounded-full bg-[#d9e8ff] blur-3xl" />
        <div className="absolute right-[-8rem] top-56 h-[30rem] w-[30rem] rounded-full bg-[#ffe3b4] blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-[#d9f4e5] blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-[1500px] px-5 py-6 md:px-8 md:py-8">
        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[38px] border border-white/70 bg-white/76 p-6 shadow-[0_24px_80px_rgba(23,32,51,0.10)] backdrop-blur-xl md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-primary">
                Demo policy
              </div>
              <span className="rounded-full border hairline bg-surface px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                /demo
              </span>
              <span className="rounded-full bg-primary/8 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                fixed backend data
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[0.98] tracking-tight md:text-6xl">
              {data.policy.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#172033]/68">
              {data.policy.summary}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <DemoPill icon={Home} label="Idle units" value="root stock" />
              <DemoPill icon={ShieldCheck} label="Vacancy verification" value="policy lever" />
              <DemoPill
                icon={Target}
                label="Leverage"
                value={data.policy.intervention.leverage_node}
              />
            </div>
          </div>

          <div className="rounded-[38px] border border-[#172033]/10 bg-[#172033] p-6 text-white shadow-[0_24px_80px_rgba(23,32,51,0.16)] md:p-8">
            <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#b8d7ff]">
              Decision question
            </div>
            <p className="mt-4 text-2xl font-semibold leading-tight">{data.policy.question}</p>
            <div className="mt-8 rounded-3xl border border-white/12 bg-white/8 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#b8d7ff]">
                <Target className="h-4 w-4" />
                {data.policy.intervention.title}
              </div>
              <p className="mt-3 text-sm leading-6 text-white/76">{data.policy.intervention.why}</p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
          <StakeholderPanel stakeholders={data.stakeholders} />
          <GraphPanel
            data={data}
            activeLoop={activeLoop}
            activeNodeId={activeNodeId}
            onSelectLoop={setActiveLoopId}
            onSelectNode={setActiveNodeId}
          />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <LoopPanel
            loops={data.loops}
            activeLoopId={activeLoopId}
            onSelectLoop={setActiveLoopId}
          />
          <InterventionPanel data={data} />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <ImpactPanel impact={data.impact} />
          <ComparisonPanel comparison={data.comparison} />
        </section>
      </main>
    </div>
  );
}

function DemoPill({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-full border border-[#172033]/10 bg-white px-4 py-2 shadow-sm">
      <Icon className="h-4 w-4 text-[#31578d]" />
      <span className="text-xs font-semibold">{label}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#172033]/50">
        {value}
      </span>
    </div>
  );
}

function StakeholderPanel({ stakeholders }: { stakeholders: DemoPolicyGraph["stakeholders"] }) {
  return (
    <section className="rounded-[34px] border border-white/70 bg-white/72 p-5 shadow-[0_18px_60px_rgba(23,32,51,0.08)] backdrop-blur-xl">
      <SectionTitle eyebrow="Step 1" title="Stakeholders" />
      <div className="mt-5 rounded-[28px] border border-[#172033]/8 bg-[#fffaf2] p-3">
        <svg viewBox="0 0 1180 650" className="h-auto w-full">
          <defs>
            <radialGradient id="stakeholder-hub" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e7edf6" />
            </radialGradient>
          </defs>
          <circle cx="560" cy="322" r="94" fill="url(#stakeholder-hub)" stroke="#17203320" />
          <text x="560" y="312" textAnchor="middle" fontSize="28" fontWeight="800" fill="#172033">
            Vacancy tax
          </text>
          <text x="560" y="344" textAnchor="middle" fontSize="18" fill="#17203388">
            who must act, comply, or adapt
          </text>
          {stakeholders.map((stakeholder) => {
            const tone = TONE_STYLES[stakeholder.tone];
            return (
              <g key={stakeholder.id}>
                <line
                  x1="560"
                  y1="322"
                  x2={stakeholder.x}
                  y2={stakeholder.y}
                  stroke={tone.stroke}
                  strokeOpacity="0.22"
                  strokeWidth="4"
                />
                <g transform={`translate(${stakeholder.x - 120}, ${stakeholder.y - 52})`}>
                  <rect
                    width="240"
                    height="104"
                    rx="26"
                    fill={tone.fill}
                    stroke={tone.stroke}
                    strokeOpacity="0.35"
                    filter={`drop-shadow(0 16px 24px ${tone.glow})`}
                  />
                  <text
                    x="120"
                    y="36"
                    textAnchor="middle"
                    fontSize="21"
                    fontWeight="800"
                    fill={tone.text}
                  >
                    {stakeholder.name}
                  </text>
                  <foreignObject x="18" y="46" width="204" height="44">
                    <p className="text-center text-[13px] leading-4 text-[#172033]/62">
                      {stakeholder.role}
                    </p>
                  </foreignObject>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function GraphPanel({
  data,
  activeLoop,
  activeNodeId,
  onSelectLoop,
  onSelectNode,
}: {
  data: DemoPolicyGraph;
  activeLoop?: DemoPolicyGraph["loops"][number];
  activeNodeId: string;
  onSelectLoop: (loopId: string) => void;
  onSelectNode: (nodeId: string) => void;
}) {
  const loopNodeIds = useMemo(() => new Set(activeLoop?.nodes ?? []), [activeLoop]);
  const nodeById = useMemo(() => new Map(data.nodes.map((node) => [node.id, node])), [data.nodes]);

  return (
    <section className="rounded-[34px] border border-white/70 bg-white/80 p-5 shadow-[0_18px_60px_rgba(23,32,51,0.08)] backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionTitle eyebrow="Step 2" title="System map" />
        <div className="flex flex-wrap gap-2">
          {data.loops.map((loop) => (
            <button
              key={loop.id}
              type="button"
              onClick={() => onSelectLoop(loop.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                activeLoop?.id === loop.id
                  ? "bg-[#172033] text-white"
                  : "border border-[#172033]/10 bg-white text-[#172033]/70 hover:bg-[#172033]/5"
              }`}
            >
              {loop.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[30px] border border-[#172033]/8 bg-[linear-gradient(180deg,#fbfcff,#f6f1e8)]">
        <svg viewBox="0 0 1180 650" className="h-auto w-full">
          <defs>
            <marker
              id="demo-arrow-positive"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#198454" />
            </marker>
            <marker
              id="demo-arrow-negative"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#c24135" />
            </marker>
          </defs>

          {data.edges.map((edge, index) => {
            const source = nodeById.get(edge.source);
            const target = nodeById.get(edge.target);
            if (!source || !target) return null;
            const active = loopNodeIds.has(edge.source) && loopNodeIds.has(edge.target);
            const color = edge.polarity === "+" ? "#198454" : "#c24135";
            const route = edgePath(source, target, index);
            return (
              <g key={`${edge.source}-${edge.target}`}>
                <path
                  d={route.path}
                  fill="none"
                  stroke={color}
                  strokeWidth={active ? 4 : 2.2}
                  strokeOpacity={active ? 0.86 : 0.2}
                  markerEnd={`url(#demo-arrow-${edge.polarity === "+" ? "positive" : "negative"})`}
                />
                {active && (
                  <g transform={`translate(${route.label.x - 24}, ${route.label.y - 14})`}>
                    <rect
                      width="48"
                      height="28"
                      rx="14"
                      fill="#fff"
                      stroke={color}
                      strokeOpacity="0.25"
                    />
                    <text
                      x="24"
                      y="18"
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="800"
                      fill={color}
                    >
                      {edge.polarity}ve
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {data.nodes.map((node) => {
            const tone = TONE_STYLES[node.tone];
            const active = loopNodeIds.has(node.id) || activeNodeId === node.label;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x - 88}, ${node.y - 48})`}
                onClick={() => onSelectNode(node.label)}
                className="cursor-pointer"
              >
                <rect
                  width="176"
                  height="96"
                  rx="24"
                  fill={tone.fill}
                  stroke={active ? tone.stroke : "#17203322"}
                  strokeWidth={active ? 3 : 1.2}
                  filter={
                    active
                      ? `drop-shadow(0 18px 28px ${tone.glow})`
                      : "drop-shadow(0 8px 16px rgba(23,32,51,0.08))"
                  }
                />
                <foreignObject x="15" y="20" width="146" height="56">
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div
                      className="text-[13px] font-black leading-[1.12]"
                      style={{ color: tone.text }}
                    >
                      {node.label}
                    </div>
                    <div className="mt-1 text-[10px] font-bold leading-none text-[#17203388]">
                      {node.type}
                    </div>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      {activeLoop && (
        <div className="mt-4 rounded-3xl border border-[#172033]/8 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${
                activeLoop.type === "reinforcing"
                  ? "bg-[#e8f0ff] text-[#31578d]"
                  : "bg-[#e7f8ef] text-[#198454]"
              }`}
            >
              {activeLoop.type === "reinforcing" ? "Reinforcing" : "Balancing"}
            </span>
            <span className="text-sm font-semibold">{activeLoop.label}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#172033]/64">{activeLoop.summary}</p>
        </div>
      )}
    </section>
  );
}

function edgePath(
  source: { x: number; y: number },
  target: { x: number; y: number },
  index: number,
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const normal = { x: -dy / length, y: dx / length };
  const offset = ((index % 4) - 1.5) * 12;
  const control = {
    x: source.x + dx / 2 + normal.x * (34 + offset),
    y: source.y + dy / 2 + normal.y * (34 + offset),
  };
  return {
    path: `M ${source.x} ${source.y} Q ${control.x} ${control.y} ${target.x} ${target.y}`,
    label: {
      x: source.x + dx / 2 + normal.x * (48 + offset),
      y: source.y + dy / 2 + normal.y * (48 + offset),
    },
  };
}

function LoopPanel({
  loops,
  activeLoopId,
  onSelectLoop,
}: {
  loops: DemoPolicyGraph["loops"];
  activeLoopId: string;
  onSelectLoop: (loopId: string) => void;
}) {
  return (
    <section className="rounded-[34px] border border-white/70 bg-white/76 p-5 shadow-[0_18px_60px_rgba(23,32,51,0.08)] backdrop-blur-xl">
      <SectionTitle eyebrow="Step 3" title="Feedback loops" />
      <div className="mt-5 grid gap-3">
        {loops.map((loop) => (
          <button
            key={loop.id}
            type="button"
            onClick={() => onSelectLoop(loop.id)}
            className={`rounded-3xl border p-4 text-left transition ${
              activeLoopId === loop.id
                ? "border-[#172033]/18 bg-[#172033] text-white shadow-[0_18px_44px_rgba(23,32,51,0.18)]"
                : "border-[#172033]/8 bg-white hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{loop.label}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">
                {loop.type === "reinforcing" ? "R loop" : "B loop"}
              </span>
            </div>
            <p
              className={`mt-2 text-sm leading-6 ${activeLoopId === loop.id ? "text-white/72" : "text-[#172033]/62"}`}
            >
              {loop.summary}
            </p>
            <div
              className={`mt-3 rounded-2xl px-3 py-2 text-xs leading-5 ${activeLoopId === loop.id ? "bg-white/10 text-white/76" : "bg-[#172033]/5 text-[#172033]/68"}`}
            >
              {loop.intervention}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function InterventionPanel({ data }: { data: DemoPolicyGraph }) {
  return (
    <section className="rounded-[34px] border border-white/70 bg-[#172033] p-5 text-white shadow-[0_18px_60px_rgba(23,32,51,0.14)]">
      <SectionTitle eyebrow="Step 4" title="Intervention point" dark />
      <div className="mt-5 grid gap-4 md:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-[30px] border border-white/12 bg-white/8 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#b8d7ff]">
            Leverage node
          </div>
          <div className="mt-3 text-3xl font-semibold leading-tight">
            {data.policy.intervention.leverage_node}
          </div>
          <p className="mt-4 text-sm leading-6 text-white/68">{data.policy.intervention.why}</p>
        </div>
        <div className="rounded-[30px] border border-white/12 bg-white p-5 text-[#172033]">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#b56b16]">
            Action
          </div>
          <h3 className="mt-3 text-2xl font-semibold">{data.policy.intervention.title}</h3>
          <p className="mt-3 text-sm leading-7 text-[#172033]/66">
            {data.policy.intervention.action}
          </p>
          <div className="mt-5 flex items-center gap-2 rounded-full bg-[#e7f8ef] px-4 py-2 text-sm font-semibold text-[#0f5132]">
            Root cause first
            <ArrowRight className="h-4 w-4" />
            then monitor loop response
          </div>
        </div>
      </div>
    </section>
  );
}

function ImpactPanel({ impact }: { impact: DemoPolicyGraph["impact"] }) {
  const afterByLabel = new Map(impact.after.map((item) => [item.label, item.value]));
  return (
    <section className="rounded-[34px] border border-white/70 bg-white/76 p-5 shadow-[0_18px_60px_rgba(23,32,51,0.08)] backdrop-blur-xl">
      <SectionTitle eyebrow="Step 5" title="Impact comparison" />
      <div className="mt-6 space-y-4">
        {impact.baseline.map((item) => {
          const after = afterByLabel.get(item.label) ?? item.value;
          const improved = improvementDirection(item.label, item.value, after);
          return (
            <div key={item.label}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold">{item.label}</span>
                <span className={improved ? "text-[#198454]" : "text-[#c24135]"}>
                  {item.value} {"->"} {after}
                </span>
              </div>
              <div className="relative h-8 overflow-hidden rounded-full bg-[#172033]/7">
                <div
                  className="absolute inset-y-1 left-1 rounded-full bg-[#c7c1b5]"
                  style={{ width: `${item.value}%` }}
                />
                <div
                  className="absolute inset-y-1 left-1 rounded-full bg-[#198454]"
                  style={{ width: `${after}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function improvementDirection(label: string, baseline: number, after: number) {
  const lowerIsBetter = /pressure|vacancy/i.test(label);
  return lowerIsBetter ? after < baseline : after > baseline;
}

function ComparisonPanel({ comparison }: { comparison: DemoPolicyGraph["comparison"] }) {
  return (
    <section className="rounded-[34px] border border-white/70 bg-white/76 p-5 shadow-[0_18px_60px_rgba(23,32,51,0.08)] backdrop-blur-xl">
      <SectionTitle eyebrow="Weak vs strong" title="Policy choice" />
      <div className="mt-5 grid gap-3">
        {comparison.map((item, index) => (
          <div
            key={item.title}
            className={`rounded-3xl border p-5 ${
              index === 1 ? "border-[#198454]/25 bg-[#e7f8ef]" : "border-[#c24135]/18 bg-[#fff1ed]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#172033]/52">
                  {item.label}
                </div>
                <h3 className="mt-2 text-xl font-semibold">{item.title}</h3>
              </div>
              <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-lg font-bold shadow-sm">
                {item.score}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#172033]/66">{item.effect}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionTitle({
  eyebrow,
  title,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  dark?: boolean;
}) {
  return (
    <div>
      <div
        className={`font-mono text-[10px] uppercase tracking-[0.26em] ${
          dark ? "text-[#b8d7ff]" : "text-[#b56b16]"
        }`}
      >
        {eyebrow}
      </div>
      <h2
        className={`mt-2 text-2xl font-semibold tracking-tight ${dark ? "text-white" : "text-[#172033]"}`}
      >
        {title}
      </h2>
    </div>
  );
}
