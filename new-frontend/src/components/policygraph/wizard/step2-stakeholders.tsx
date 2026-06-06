import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, ArrowLeft, ArrowRight, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { useWizard } from "./wizard-context";
import { analyzePolicy, type Stakeholder } from "@/lib/policygraph/analyze.functions";
import { StakeholderCard } from "./stakeholder-card";
import { DatasetPicker } from "./dataset-picker";

const LEVELS: Stakeholder["level"][] = ["micro", "meso", "macro"];
const LEVEL_TITLE: Record<Stakeholder["level"], string> = {
  micro: "Micro — actors & organisations",
  meso: "Meso — environment & resources",
  macro: "Macro — system forces",
};

export function Step2Stakeholders() {
  const w = useWizard();
  const a = w.analysis;
  const [adding, setAdding] = useState(false);
  const [newSt, setNewSt] = useState<{ label: string; level: Stakeholder["level"]; note: string }>({
    label: "",
    level: "micro",
    note: "",
  });

  // Clear any legacy persisted pending stakeholders from previous sessions
  useEffect(() => {
    if (w.customStakeholders.length > 0) w.setCustomStakeholders([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fn = useServerFn(analyzePolicy);
  const rerun = useMutation({
    mutationFn: () =>
      fn({
        data: {
          query: w.query,
          horizon: w.horizon,
          draftText: w.draftText || undefined,
          extraStakeholders: w.customStakeholders,
          selectedDatasets: w.selectedDatasets,
        },
      }),
    onSuccess: (res) => {
      w.setAnalysis(res);
      w.setStep(3);
    },
  });

  if (!a) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed hairline bg-surface/40 p-10 text-center">
        <p className="text-muted-foreground">No analysis yet. Start at Step 1.</p>
        <button
          onClick={() => w.setStep(1)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Step 1
        </button>
      </div>
    );
  }

  const grouped = LEVELS.map((lvl) => ({
    lvl,
    items: a.stakeholders.filter((s) => s.level === lvl),
  }));

  function removeStakeholder(id: string) {
    const cur = w.analysis;
    if (!cur) return;
    w.setAnalysis({ ...cur, stakeholders: cur.stakeholders.filter((s) => s.id !== id) });
  }

  function addCustom() {
    if (!newSt.label.trim()) return;
    const cur = w.analysis;
    if (!cur) return;
    const label = newSt.label.trim();
    const short = label
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 3)
      .toUpperCase() || "NEW";
    const newStake: Stakeholder = {
      id: `custom-${Date.now()}`,
      label,
      short,
      level: newSt.level,
      group: "people",
      note: newSt.note || "Custom stakeholder added for this analysis.",
      impact: 0,
      analysis: [
        { key: "micro", label: "Micro", value: newSt.note || "Custom stakeholder — not yet analysed in depth." },
        { key: "meso", label: "Meso", value: "—" },
        { key: "macro", label: "Macro", value: "—" },
      ],
    };
    w.setAnalysis({ ...cur, stakeholders: [...cur.stakeholders, newStake] });
    setNewSt({ label: "", level: "micro", note: "" });
    setAdding(false);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
          Step 2 — Stakeholders & data sources
        </div>
        <h2 className="mt-2 font-display text-4xl font-semibold">{a.policy.label}</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{a.policy.summary}</p>
        <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-primary">
          {a.interpretation}
        </div>
      </div>

      {/* Stakeholders */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl font-semibold">Stakeholders</h3>
            <p className="text-sm text-muted-foreground">
              Click any card to expand the full Micro / Meso / Macro analysis. Remove what
              doesn't apply, or add stakeholders the model missed.
            </p>
          </div>
          <button
            onClick={() => setAdding((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-full border hairline bg-surface/40 px-3 py-1.5 text-xs hover:border-primary/60"
          >
            <Plus className="h-3.5 w-3.5" /> Add custom stakeholder
          </button>
        </div>

        {adding && (
          <div className="rounded-xl border border-dashed hairline bg-surface/30 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_160px]">
              <input
                value={newSt.label}
                onChange={(e) => setNewSt({ ...newSt, label: e.target.value })}
                placeholder="Stakeholder name (e.g. SME landlords)"
                className="rounded-lg border hairline bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <select
                value={newSt.level}
                onChange={(e) => setNewSt({ ...newSt, level: e.target.value as Stakeholder["level"] })}
                className="rounded-lg border hairline bg-background/60 px-3 py-2 text-sm"
              >
                <option value="micro">Micro level</option>
                <option value="meso">Meso level</option>
                <option value="macro">Macro level</option>
              </select>
            </div>
            <textarea
              value={newSt.note}
              onChange={(e) => setNewSt({ ...newSt, note: e.target.value })}
              placeholder="Short note (optional) — what should the AI know about them?"
              rows={2}
              className="mt-2 w-full rounded-lg border hairline bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setAdding(false)} className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button
                onClick={addCustom}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                <Plus className="h-3 w-3" /> Add to this analysis
              </button>
            </div>
          </div>
        )}



        {grouped.map(({ lvl, items }) =>
          items.length === 0 ? null : (
            <div key={lvl} className="space-y-3">
              <h4 className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {LEVEL_TITLE[lvl]}
              </h4>
              <div className="space-y-3">
                {items.map((s) => (
                  <StakeholderCard
                    key={s.id}
                    stakeholder={s}
                    onRemove={() => removeStakeholder(s.id)}
                  />
                ))}
              </div>
            </div>
          )
        )}
      </section>

      {/* Datasets */}
      <section className="border-t hairline pt-10">
        <DatasetPicker />
      </section>

      {rerun.error && (
        <div className="flex items-start gap-2 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
          {rerun.error.message}
        </div>
      )}

      <div className="flex items-center justify-between border-t hairline pt-6">
        <button
          onClick={() => w.setStep(1)}
          className="inline-flex items-center gap-2 rounded-xl border hairline px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={() => rerun.mutate()}
          disabled={rerun.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {rerun.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Re-grounding with your selections…</>
          ) : w.selectedDatasets.length !== a.datasets.length ? (
            <><Sparkles className="h-4 w-4" /> Re-analyse & continue</>
          ) : (
            <>Continue to system map <ArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}
