import { useState, type ComponentType } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  ChevronDown,
  GitBranch,
  Network,
  Target,
  Users,
} from "lucide-react";
import { useWizard } from "./wizard-context";
import { analyzePolicy, type PolicyAnalysis } from "@/lib/policygraph/analyze.functions";

export function Step4Bundle() {
  const w = useWizard();
  const a = w.analysis;
  const fn = useServerFn(analyzePolicy);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const run = useMutation({
    mutationFn: () => {
      const interventionNames = (a?.bundle ?? []).map((b) => b.label).join(", ");
      return fn({
        data: {
          query: `${w.query} — with interventions: ${interventionNames}`,
          horizon: w.horizon,
          draftText: w.draftText || undefined,
          selectedDatasets: w.selectedDatasets,
        },
      });
    },
    onSuccess: (res) => {
      w.setBundleAnalysis(res);
      w.setStep(5);
    },
  });

  if (!a) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.26em] text-primary">
          Intervention
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {a.bundle.map((b, i) => {
          const isOpen = openIdx === i;
          const mapping = buildBundleMapping(a, b);
          return (
            <div
              key={i}
              className="rounded-3xl border hairline bg-white/78 shadow-[0_18px_42px_rgba(15,23,42,0.06)]"
            >
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : i)}
                className="flex w-full items-start justify-between gap-3 p-5 text-left"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {b.rank ?? i + 1}
                    </span>
                    {typeof b.confidence === "number" && (
                      <span className="rounded-full bg-primary/8 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                        {Math.round(b.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                  <div className="mt-1 font-display text-xl font-semibold">{b.label}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mapping.interventionPoints.slice(0, 2).map((point) => (
                      <Pill key={point} icon={Target} label={point} tone="primary" />
                    ))}
                    {mapping.nodeLabels.slice(0, 2).map((node) => (
                      <Pill key={node} icon={Network} label={node} />
                    ))}
                  </div>
                </div>
                <ChevronDown
                  className={`mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="space-y-5 border-t hairline px-5 py-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <MappingBlock
                      icon={Target}
                      label="Points"
                      values={mapping.interventionPoints}
                      empty="None"
                    />
                    <MappingBlock
                      icon={Network}
                      label="Nodes"
                      values={mapping.nodeLabels}
                      empty="None"
                    />
                    <MappingBlock
                      icon={GitBranch}
                      label="Loops"
                      values={mapping.loopLabels}
                      empty="None"
                    />
                    <MappingBlock
                      icon={Users}
                      label="Stakeholders"
                      values={mapping.stakeholderLabels}
                      empty="None"
                    />
                  </div>

                  {mapping.ripple.length > 0 && (
                    <div className="rounded-2xl border hairline bg-surface/60 p-4">
                      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                        Ripple
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {mapping.ripple.map((step, index) => (
                          <span key={`${step}-${index}`} className="inline-flex items-center gap-2">
                            <span className="rounded-full border hairline bg-white px-2.5 py-1 text-foreground">
                              {step}
                            </span>
                            {index < mapping.ripple.length - 1 && (
                              <ArrowRight className="h-3.5 w-3.5 text-primary" />
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(b.implementationNotes?.length ?? 0) > 0 && (
                    <MappingBlock
                      icon={ArrowRight}
                      label="Notes"
                      values={b.implementationNotes ?? []}
                      empty="None"
                    />
                  )}

                  {(b.tradeoffs?.length ?? 0) > 0 && (
                    <MappingBlock
                      icon={AlertCircle}
                      label="Tradeoffs"
                      values={b.tradeoffs ?? []}
                      empty="None"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {run.error && (
        <div className="flex items-start gap-2 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-coral" /> {run.error.message}
        </div>
      )}

      <div className="flex items-center justify-between border-t hairline pt-6">
        <button
          onClick={() => w.setStep(3)}
          className="inline-flex items-center gap-2 rounded-xl border hairline px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={() => run.mutate()}
          disabled={run.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {run.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Simulating…
            </>
          ) : (
            <>
              Simulate intervention <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

type BundleItem = NonNullable<PolicyAnalysis["bundle"]>[number];
type IconType = ComponentType<{ className?: string }>;

function buildBundleMapping(analysis: PolicyAnalysis, bundle: BundleItem) {
  const graph = analysis.graph;
  const nodeById = new Map(graph?.nodes.map((node) => [node.policy_node_id, node]) ?? []);
  const loopById = new Map(graph?.feedbackLoops.map((loop) => [loop.feedback_loop_id, loop]) ?? []);
  const stakeholderById = new Map(
    (graph?.stakeholders ?? [])
      .filter((stakeholder) => typeof stakeholder.stakeholder_id === "number")
      .map((stakeholder) => [
        stakeholder.stakeholder_id as number,
        String(stakeholder.stakeholder_name ?? `Stakeholder ${stakeholder.stakeholder_id}`),
      ]),
  );

  const interventionPoints = unique([
    ...(bundle.interventionPoints ?? []),
    ...(bundle.targetedFeedbackLoopIds ?? []).flatMap(
      (id) => loopById.get(id)?.possible_intervention_points ?? [],
    ),
  ]);
  const nodeLabels = unique(
    (bundle.targetedNodeIds ?? [])
      .map((id) => nodeById.get(id)?.label)
      .filter((value): value is string => Boolean(value)),
  );
  const loopLabels = unique(
    (bundle.targetedFeedbackLoopIds ?? [])
      .map((id) => loopById.get(id)?.loop_name)
      .filter((value): value is string => Boolean(value)),
  );
  const stakeholderLabels = unique([
    ...(bundle.stakeholderFocus ?? []),
    ...(bundle.affectedStakeholderIds ?? [])
      .map((id) => stakeholderById.get(id))
      .filter((value): value is string => Boolean(value)),
  ]);
  const ripple = buildRipple(analysis, bundle);

  return {
    interventionPoints,
    nodeLabels,
    loopLabels,
    stakeholderLabels,
    ripple,
  };
}

function buildRipple(analysis: PolicyAnalysis, bundle: BundleItem) {
  const graph = analysis.graph;
  const startNodeId = bundle.targetedNodeIds?.[0];
  if (!graph || !startNodeId) return [];
  const nodeById = new Map(graph.nodes.map((node) => [node.policy_node_id, node]));
  const steps = [nodeById.get(startNodeId)?.label].filter((value): value is string =>
    Boolean(value),
  );
  let currentId = startNodeId;
  const used = new Set<number>([currentId]);

  for (let depth = 0; depth < 3; depth += 1) {
    const edge = graph.edges.find(
      (item) => item.source_node_id === currentId && !used.has(item.target_node_id),
    );
    if (!edge) break;
    const target = nodeById.get(edge.target_node_id);
    if (!target) break;
    steps.push(target.label);
    used.add(target.policy_node_id);
    currentId = target.policy_node_id;
  }

  return steps;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function Pill({
  icon: Icon,
  label,
  tone = "neutral",
}: {
  icon: IconType;
  label: string;
  tone?: "neutral" | "primary";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        tone === "primary"
          ? "border border-primary/18 bg-primary/7 text-primary"
          : "border hairline bg-surface text-muted-foreground"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function MappingBlock({
  icon: Icon,
  label,
  values,
  empty,
}: {
  icon: IconType;
  label: string;
  values: string[];
  empty: string;
}) {
  return (
    <div className="rounded-2xl border hairline bg-surface/55 p-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.slice(0, 6).map((value) => (
            <span
              key={value}
              className="rounded-full border hairline bg-white px-2.5 py-1 text-xs text-foreground"
            >
              {value}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">{empty}</span>
        )}
      </div>
    </div>
  );
}
