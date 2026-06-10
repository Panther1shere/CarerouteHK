import { useState, type ComponentType } from "react";
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  ChevronDown,
  GitBranch,
  Info,
  Network,
  Target,
  Users,
} from "lucide-react";
import { useWizard } from "./wizard-context";
import type { PolicyAnalysis } from "@/lib/policygraph/analyze.functions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function Step4Bundle() {
  const w = useWizard();
  const a = w.analysis;
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (!a) return null;

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.26em] text-primary">
            Leverage points
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
                    <div className="mt-1 flex items-center gap-2">
                      <div className="font-display text-xl font-semibold">
                        {formatDisplayText(b.label)}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border hairline bg-white text-muted-foreground transition hover:text-primary">
                            <Info className="h-3.5 w-3.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs leading-5">
                          {b.rationale ||
                            "Recommended because this targets a root-cause node or relationship in the saved feedback loops, not only the visible symptom."}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                      {formatDisplayText(
                        b.description ||
                          b.rationale ||
                          "Change the mapped system at the named pressure points, then monitor the downstream ripple.",
                      )}
                    </p>
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
                    <div className="rounded-2xl border hairline bg-primary/5 p-4">
                      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                        Leverage point
                      </div>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {buildActionText(b, mapping)}
                      </p>
                      {b.expectedSystemShift && (
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {b.expectedSystemShift}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <MappingBlock
                        icon={Target}
                        label="Leverage"
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
                          System ripple
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {mapping.ripple.map((step, index) => (
                            <span
                              key={`${step}-${index}`}
                              className="inline-flex items-center gap-2"
                            >
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
                        label="Delivery"
                        values={b.implementationNotes ?? []}
                        empty="None"
                      />
                    )}

                    {(b.tradeoffs?.length ?? 0) > 0 && (
                      <MappingBlock
                        icon={AlertCircle}
                        label="Watch"
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

        <div className="flex items-center justify-between border-t hairline pt-6">
          <button
            onClick={() => w.setStep(3)}
            className="inline-flex items-center gap-2 rounded-xl border hairline px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={() => {
              w.setBundleAnalysis(buildInterventionSimulation(a));
              w.setStep(5);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            Simulate leverage point <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
}

type BundleItem = NonNullable<PolicyAnalysis["bundle"]>[number];
type IconType = ComponentType<{ className?: string }>;
type Impact = PolicyAnalysis["impactShort"];
type ImpactKey = keyof Impact;

const IMPACT_KEYS: ImpactKey[] = [
  "affordability",
  "supply",
  "publicBudget",
  "developerIncentives",
  "tenantProtection",
  "constructionSpeed",
  "transportPressure",
  "inequality",
  "publicSatisfaction",
];

function buildInterventionSimulation(analysis: PolicyAnalysis): PolicyAnalysis {
  const shortDelta = buildInterventionDelta(analysis, "short");
  const longDelta = buildInterventionDelta(analysis, "long");
  const interventionNames = analysis.bundle.map((item) => item.label).filter(Boolean);

  return {
    ...analysis,
    policy: {
      ...analysis.policy,
      label: `${analysis.policy.label} + interventions`,
      summary:
        "Deterministic intervention comparison built from the saved system map, selected leverage points, feedback loops, and tradeoffs.",
    },
    interpretation:
      "The intervention comparison applies the selected leverage-point changes to the saved base analysis. It does not re-run policy generation, so before/after values stay tied to the same policy graph.",
    impactShort: applyImpactDelta(analysis.impactShort, shortDelta),
    impactLong: applyImpactDelta(analysis.impactLong, longDelta),
    warnings: buildInterventionWarnings(analysis),
    bundleRationale:
      interventionNames.length > 0
        ? `Comparison applies ${interventionNames.slice(0, 3).join(", ")} to the saved base analysis.`
        : analysis.bundleRationale,
  };
}

function buildInterventionDelta(
  analysis: PolicyAnalysis,
  horizon: "short" | "long",
): Record<ImpactKey, number> {
  const delta = emptyDelta();
  const graph = analysis.graph;
  const nodeById = new Map(graph?.nodes.map((node) => [node.policy_node_id, node]) ?? []);
  const loopById = new Map(graph?.feedbackLoops.map((loop) => [loop.feedback_loop_id, loop]) ?? []);
  const horizonWeight = horizon === "long" ? 1.28 : 1;

  for (const bundle of analysis.bundle.slice(0, 4)) {
    const confidence = typeof bundle.confidence === "number" ? bundle.confidence : 0.68;
    const weight = Math.max(0.45, Math.min(1, confidence)) * horizonWeight;
    const targetedNodes = (bundle.targetedNodeIds ?? [])
      .map((id) => nodeById.get(id))
      .filter(Boolean);
    const targetedLoops = (bundle.targetedFeedbackLoopIds ?? [])
      .map((id) => loopById.get(id))
      .filter(Boolean);
    const text = [
      bundle.label,
      bundle.short,
      bundle.description,
      bundle.rationale,
      bundle.expectedSystemShift,
      ...(bundle.interventionPoints ?? []),
      ...targetedNodes.map((node) => `${node?.label} ${node?.description} ${node?.category}`),
      ...targetedLoops.map((loop) => `${loop?.loop_name} ${loop?.explanation}`),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (matches(text, ["afford", "rent", "price", "cost", "scarcity"])) {
      delta.affordability += 1.15 * weight;
      delta.publicSatisfaction += 0.45 * weight;
    }
    if (matches(text, ["supply", "vacancy", "idle", "unit", "home", "housing stock", "release"])) {
      delta.supply += 1.35 * weight;
      delta.affordability += 0.75 * weight;
    }
    if (
      matches(text, ["permit", "approval", "construction", "delivery", "milestone", "timeline"])
    ) {
      delta.constructionSpeed += 1.25 * weight;
      delta.supply += 0.85 * weight;
      delta.developerIncentives += 0.45 * weight;
    }
    if (matches(text, ["tenant", "household", "displacement", "protection", "low-income"])) {
      delta.tenantProtection += 1.1 * weight;
      delta.inequality -= 0.75 * weight;
      delta.publicSatisfaction += 0.45 * weight;
    }
    if (matches(text, ["trust", "transparent", "complian", "data", "declaration", "fair"])) {
      delta.publicSatisfaction += 1.05 * weight;
      delta.inequality -= 0.35 * weight;
    }
    if (matches(text, ["tax", "levy", "charge", "fee", "penalty", "enforcement"])) {
      delta.publicBudget += 0.65 * weight;
      delta.developerIncentives -= 0.55 * weight;
      delta.publicSatisfaction -= 0.18 * weight;
    }
    if (matches(text, ["subsid", "grant", "funding", "voucher", "rebate"])) {
      delta.publicBudget -= 0.95 * weight;
      delta.tenantProtection += 0.65 * weight;
      delta.affordability += 0.55 * weight;
    }
    if (matches(text, ["infrastructure", "transport", "utility", "capacity", "service"])) {
      delta.transportPressure -= 0.9 * weight;
      delta.publicBudget -= 0.55 * weight;
      delta.publicSatisfaction += 0.4 * weight;
    }

    for (const loop of targetedLoops) {
      if (loop?.loop_type === "reinforcing") {
        delta.affordability += 0.45 * weight;
        delta.inequality -= 0.35 * weight;
        delta.publicSatisfaction += 0.35 * weight;
      }
      if (loop?.loop_type === "balancing") {
        delta.supply += 0.45 * weight;
        delta.transportPressure -= 0.25 * weight;
        delta.publicSatisfaction += 0.3 * weight;
      }
    }
  }

  if (analysis.bundle.length > 0) {
    delta.publicSatisfaction += 0.5 * horizonWeight;
  }

  return Object.fromEntries(
    IMPACT_KEYS.map((key) => [key, Number(delta[key].toFixed(1))]),
  ) as Record<ImpactKey, number>;
}

function applyImpactDelta(base: Impact, delta: Record<ImpactKey, number>): Impact {
  return Object.fromEntries(
    IMPACT_KEYS.map((key) => [key, clampImpact(base[key] + delta[key])]),
  ) as Impact;
}

function buildInterventionWarnings(analysis: PolicyAnalysis): PolicyAnalysis["warnings"] {
  const tradeoffs = analysis.bundle.flatMap((item) => item.tradeoffs ?? []).filter(Boolean);
  const mapped = tradeoffs.slice(0, 3).map((detail, index) => ({
    severity: index === 0 ? ("medium" as const) : ("low" as const),
    title: index === 0 ? "Intervention tradeoff" : "Monitoring requirement",
    detail,
  }));
  if (mapped.length > 0) return mapped;
  return [
    {
      severity: "low",
      title: "Monitor second-order effects",
      detail:
        "The comparison shifts only the mapped intervention dimensions. Analysts should still monitor affected nodes and feedback loops after implementation.",
    },
  ];
}

function emptyDelta(): Record<ImpactKey, number> {
  return Object.fromEntries(IMPACT_KEYS.map((key) => [key, 0])) as Record<ImpactKey, number>;
}

function matches(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function clampImpact(value: number) {
  return Math.max(-10, Math.min(10, Number(value.toFixed(1))));
}

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

function buildActionText(bundle: BundleItem, mapping: ReturnType<typeof buildBundleMapping>) {
  const point = formatDisplayText(mapping.interventionPoints[0] ?? "");
  const nodes = mapping.nodeLabels.slice(0, 2).map(formatDisplayText).join(" and ");
  const stakeholders = mapping.stakeholderLabels.slice(0, 2).map(formatDisplayText).join(" and ");
  const rawAction = bundle.short || bundle.description || "";
  const action = formatDisplayText(rawAction);

  if (action && !isSlugLike(rawAction)) {
    return action;
  }
  if (point && nodes && stakeholders) {
    return `Use "${point}" to change ${nodes}, with implementation ownership focused on ${stakeholders}. This targets the causal system, not only the visible symptom.`;
  }
  if (point && nodes) {
    return `Use "${point}" to change ${nodes}, then monitor whether connected nodes move in the expected direction.`;
  }
  if (point) {
    return `Implement "${point}" as the concrete leverage change, then check the mapped ripple before scaling.`;
  }
  return "Treat this as a root-cause leverage point, not a broad policy theme; assign an owner, define a measurable threshold, and monitor the connected nodes.";
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
      {formatDisplayText(label)}
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
              {formatDisplayText(value)}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">{empty}</span>
        )}
      </div>
    </div>
  );
}

function formatDisplayText(value: string) {
  const cleaned = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (/[.!?]/.test(cleaned) || cleaned.length > 80) {
    return cleaned;
  }
  return cleaned.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function isSlugLike(value: string) {
  const compact = value.trim();
  if (!compact) return true;
  return /^[a-z0-9-_\s]{1,40}$/.test(compact) && !compact.includes(".");
}
