import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { useWizard } from "./wizard-context";
import { analyzePolicy } from "@/lib/policygraph/analyze.functions";

export function Step4Bundle() {
  const w = useWizard();
  const a = w.analysis;
  const fn = useServerFn(analyzePolicy);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const run = useMutation({
    mutationFn: () => {
      const bundleNames = (a?.bundle ?? []).map((b) => b.label).join(", ");
      return fn({
        data: {
          query: `${w.query} — stacked with: ${bundleNames}`,
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
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
          Step 4 — Suggested policy bundle
        </div>
        <h2 className="mt-2 font-display text-4xl font-semibold">
          Highest-leverage interventions
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{a.bundleRationale}</p>
      </div>

      <div className="space-y-3">
        {a.bundle.map((b, i) => {
          const isOpen = openIdx === i;
          const body = b.description || b.rationale;
          return (
            <div key={i} className="rounded-2xl border hairline bg-surface/40">
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-3 p-5 text-left"
              >
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Intervention {i + 1}
                  </div>
                  <div className="mt-1 font-display text-xl font-semibold">{b.label}</div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && body && (
                <div className="border-t hairline px-5 py-4 space-y-3">
                  <p className="text-sm text-muted-foreground">{body}</p>
                  {b.description && b.rationale && b.rationale !== b.description && (
                    <p className="text-sm text-muted-foreground">{b.rationale}</p>
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
            <><Loader2 className="h-4 w-4 animate-spin" /> Simulating bundle…</>
          ) : (
            <>Simulate bundle & compare <ArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}
