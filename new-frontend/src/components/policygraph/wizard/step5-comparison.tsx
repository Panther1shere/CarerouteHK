import { useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useWizard } from "./wizard-context";
import { ImpactChart } from "../impact-chart";
import type { PolicyAnalysis } from "@/lib/policygraph/analyze.functions";

export function Step5Comparison() {
  const w = useWizard();
  const [horizon, setHorizon] = useState<"short" | "long">(w.horizon);
  const [view, setView] = useState<"base" | "intervention">("base");
  const base = w.analysis;
  const bundle = w.bundleAnalysis;

  if (!base || !bundle) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed hairline bg-surface/40 p-10 text-center">
        <p className="text-muted-foreground">Run the intervention simulation first.</p>
      </div>
    );
  }

  const baseImpact = horizon === "short" ? base.impactShort : base.impactLong;
  const bundleImpact = horizon === "short" ? bundle.impactShort : bundle.impactLong;
  const activeImpact = view === "base" ? baseImpact : bundleImpact;
  const activeAnalysis = view === "base" ? base : bundle;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.26em] text-primary">
            Compare
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full border hairline bg-surface/50 p-1">
          {(["short", "long"] as const).map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
                horizon === h ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {h === "short" ? "0–2 yrs" : "5–10 yrs"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border hairline bg-surface/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {view === "base" ? "Base" : "Intervention"}
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-full border hairline bg-background/50 p-1">
            <button
              onClick={() => setView("base")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
                view === "base" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Base
            </button>
            <button
              onClick={() => setView("intervention")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
                view === "intervention"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Intervention
            </button>
          </div>
        </div>
        <div className="mt-6">
          <ImpactChart
            impact={activeImpact}
            compareImpact={view === "intervention" ? baseImpact : undefined}
          />
        </div>
      </div>

      {base.bundle.length > 0 && (
        <section className="rounded-3xl border hairline bg-white/80 p-5 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
            Intervention map
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {base.bundle.map((item) => {
              const nodeNames = resolveNodeNames(base, item.targetedNodeIds ?? []);
              const loopNames = resolveLoopNames(base, item.targetedFeedbackLoopIds ?? []);
              return (
                <div
                  key={item.interventionKey ?? item.label}
                  className="rounded-2xl border hairline bg-surface/55 p-4"
                >
                  <div className="text-sm font-semibold text-foreground">{item.label}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[...nodeNames, ...loopNames].slice(0, 5).map((value) => (
                      <span
                        key={value}
                        className="rounded-full border hairline bg-white px-2.5 py-1 text-[11px] text-muted-foreground"
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <div className="flex items-center justify-between border-t hairline pt-6">
        <button
          onClick={() => w.setStep(4)}
          className="inline-flex items-center gap-2 rounded-xl border hairline px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={() => {
            if (confirm("Reset and start a new analysis?")) w.reset();
          }}
          className="inline-flex items-center gap-2 rounded-xl border hairline px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4" /> Start new analysis
        </button>
      </div>
    </div>
  );
}

function resolveNodeNames(analysis: PolicyAnalysis, ids: number[]) {
  const nodeById = new Map(
    analysis.graph?.nodes.map((node) => [node.policy_node_id, node.label]) ?? [],
  );
  return ids.map((id) => nodeById.get(id)).filter((value): value is string => Boolean(value));
}

function resolveLoopNames(analysis: PolicyAnalysis, ids: number[]) {
  const loopById = new Map(
    analysis.graph?.feedbackLoops.map((loop) => [loop.feedback_loop_id, loop.loop_name]) ?? [],
  );
  return ids.map((id) => loopById.get(id)).filter((value): value is string => Boolean(value));
}
