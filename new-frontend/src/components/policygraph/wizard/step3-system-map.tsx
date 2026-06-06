import { useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, X } from "lucide-react";
import { useWizard } from "./wizard-context";
import { InteractiveGraph } from "../interactive-graph";
import { FeedbackLoopCard } from "../feedback-loop-card";
import { WarningCard } from "../warning-card";
import { StakeholderCard } from "./stakeholder-card";

export function Step3SystemMap() {
  const w = useWizard();
  const a = w.analysis;
  const [drawerId, setDrawerId] = useState<string | null>(null);

  if (!a) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed hairline bg-surface/40 p-10 text-center">
        <p className="text-muted-foreground">No analysis yet.</p>
      </div>
    );
  }

  const focus = drawerId ? a.stakeholders.find((s) => s.id === drawerId) : null;
  const focusLoops = focus
    ? a.loops.filter((l) => l.chain.some((c) => c.node.toLowerCase().includes(focus.label.toLowerCase().split(" ")[0])))
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
          Step 3 — System map, data & risks
        </div>
        <h2 className="mt-2 font-display text-4xl font-semibold">
          {a.policy.label}
        </h2>
      </div>

      {/* Live data panel */}
      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
          Grounding data — data.gov.hk
        </div>
        <h3 className="mt-2 font-display text-2xl font-semibold">
          {w.selectedDatasets.length || a.datasets.length} live HK datasets
        </h3>
        {a.datasetUsage && (
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{a.datasetUsage}</p>
        )}
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {(w.selectedDatasets.length ? w.selectedDatasets : a.datasets).map((d) => (
            <li key={d.id}>
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-xl border hairline bg-surface/40 p-4 hover:border-primary/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {d.organization}
                    </div>
                    <div className="mt-1 truncate font-semibold">{d.title}</div>
                  </div>
                  <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                </div>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Interactive map */}
      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
          Interactive system map
        </div>
        <h3 className="mt-2 font-display text-2xl font-semibold">
          Click a node for full context
        </h3>
        <div className="mt-4">
          <div
            // intercept clicks to open drawer based on a data-* on text/circles inside InteractiveGraph
            // The existing component handles its own hover/select; we wrap and listen for clicks bubbling up.
            onClick={(e) => {
              const el = (e.target as HTMLElement).closest("[data-stakeholder-id]") as HTMLElement | null;
              if (el?.dataset.stakeholderId) setDrawerId(el.dataset.stakeholderId);
            }}
          >
            <InteractiveGraph stakeholders={a.stakeholders} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {a.stakeholders.map((s) => (
            <button
              key={s.id}
              onClick={() => setDrawerId(s.id)}
              className="rounded-full border hairline bg-surface/40 px-3 py-1 text-xs text-muted-foreground hover:border-primary/60 hover:text-foreground"
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {/* Feedback loops */}
      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
          Feedback loops
        </div>
        <h3 className="mt-2 font-display text-2xl font-semibold">What the system does back</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {a.loops.map((loop, i) => (
            <FeedbackLoopCard key={loop.id} loop={loop} index={i} />
          ))}
        </div>
      </section>

      {/* Warnings */}
      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
          Risks & unintended consequences
        </div>
        <h3 className="mt-2 font-display text-2xl font-semibold">Where it could fail</h3>
        <div className="mt-4 space-y-3">
          {a.warnings.map((w, i) => (
            <WarningCard key={i} warning={w} />
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between border-t hairline pt-6">
        <button
          onClick={() => w.setStep(2)}
          className="inline-flex items-center gap-2 rounded-xl border hairline px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={() => w.setStep(4)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Suggested policy bundle <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Drawer */}
      {focus && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-foreground/30 backdrop-blur-sm" onClick={() => setDrawerId(null)} />
          <div className="w-full max-w-xl overflow-y-auto border-l hairline bg-background p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-wider text-primary">
                Stakeholder detail
              </div>
              <button
                onClick={() => setDrawerId(null)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4">
              <StakeholderCard stakeholder={focus} />
            </div>
            {focusLoops.length > 0 && (
              <div className="mt-6">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Participates in {focusLoops.length} loop{focusLoops.length === 1 ? "" : "s"}
                </div>
                <div className="mt-3 space-y-3">
                  {focusLoops.map((l, i) => (
                    <FeedbackLoopCard key={l.id} loop={l} index={i} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
