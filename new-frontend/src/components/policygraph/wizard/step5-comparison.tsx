import { useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useWizard } from "./wizard-context";
import { ImpactChart } from "../impact-chart";

export function Step5Comparison() {
  const w = useWizard();
  const [horizon, setHorizon] = useState<"short" | "long">(w.horizon);
  const [view, setView] = useState<"base" | "bundle">("base");
  const base = w.analysis;
  const bundle = w.bundleAnalysis;

  if (!base || !bundle) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed hairline bg-surface/40 p-10 text-center">
        <p className="text-muted-foreground">Run the bundle simulation in Step 4 first.</p>
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
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
            Step 5 — Pre / post comparison
          </div>
          <h2 className="mt-2 font-display text-4xl font-semibold">
            Base policy <span className="italic text-primary">vs</span> with bundle
          </h2>
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
              {view === "base" ? "Base policy alone" : "With suggested bundle"}
            </div>
            <h4 className="font-display text-xl font-semibold">{activeAnalysis.policy.label}</h4>
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
              onClick={() => setView("bundle")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
                view === "bundle" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              + Bundle
            </button>
          </div>
        </div>
        <div className="mt-6">
          <ImpactChart
            impact={activeImpact}
            compareImpact={view === "bundle" ? baseImpact : undefined}
          />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Note: estimates use the same 9-dimension framework, grounded in your selected
        data.gov.hk datasets. Treat as decision support, not measured outcomes.
      </p>

      <div className="flex items-center justify-between border-t hairline pt-6">
        <button
          onClick={() => w.setStep(4)}
          className="inline-flex items-center gap-2 rounded-xl border hairline px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={() => { if (confirm("Reset and start a new analysis?")) w.reset(); }}
          className="inline-flex items-center gap-2 rounded-xl border hairline px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4" /> Start new analysis
        </button>
      </div>
    </div>
  );
}
