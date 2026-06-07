import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Loader2, Plus, X, ExternalLink, Check, Database } from "lucide-react";
import { useWizard } from "./wizard-context";
import { searchDatasets, type Dataset } from "@/lib/policygraph/analyze.functions";

export function DatasetPicker() {
  const w = useWizard();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Dataset[]>([]);
  const fn = useServerFn(searchDatasets);
  const search = useMutation({
    mutationFn: () => fn({ data: { query: q.trim(), rows: 8 } }),
    onSuccess: (r) => setResults(r.results),
  });

  const suggested = w.analysis?.datasets ?? [];
  const selectedIds = new Set(w.selectedDatasets.map((d) => d.id));

  function toggle(d: Dataset) {
    if (selectedIds.has(d.id)) {
      w.setSelectedDatasets(w.selectedDatasets.filter((x) => x.id !== d.id));
    } else {
      w.setSelectedDatasets([...w.selectedDatasets, d]);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-2xl font-semibold">Data sources from data.gov.hk</h3>
        <p className="text-sm text-muted-foreground">
          The model suggested these datasets. Curate them — uncheck any that don't fit, or search
          and add more. Step 3 will pull live records from your selection.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {suggested.map((d) => {
          const checked = selectedIds.has(d.id);
          return (
            <button
              key={d.id}
              onClick={() => toggle(d)}
              className={`group relative min-h-[150px] rounded-2xl border p-4 text-left transition ${
                checked
                  ? "border-primary bg-primary/6 shadow-[0_14px_28px_rgba(29,78,216,0.08)]"
                  : "hairline bg-background/55 hover:border-primary/40 hover:bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`grid h-9 w-9 place-items-center rounded-xl border ${
                      checked
                        ? "border-primary/25 bg-primary/10 text-primary"
                        : "hairline bg-white text-muted-foreground"
                    }`}
                  >
                    <Database className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {d.organization}
                    </div>
                    <div className="mt-0.5 max-w-[13rem] truncate text-[11px] text-primary/75">
                      query: "{d.query}"
                    </div>
                  </div>
                </div>
                <div
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hairline bg-white"
                  }`}
                >
                  {checked && <Check className="h-3 w-3" />}
                </div>
              </div>
              <div className="mt-4 font-display text-lg font-semibold leading-6 text-foreground">
                {d.title}
              </div>
              {d.notes && (
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {d.notes}
                </p>
              )}
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-3 right-3 rounded-full border hairline bg-white p-1.5 text-muted-foreground opacity-80 transition hover:text-primary group-hover:opacity-100"
                aria-label={`Open ${d.title}`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-dashed hairline bg-surface/30 p-4">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Search data.gov.hk for more datasets
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) search.mutate();
          }}
          className="mt-2 flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. waiting list, MTR, rent index"
              className="w-full rounded-lg border hairline bg-background/60 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <button
            type="submit"
            disabled={search.isPending || !q.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {search.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            Search
          </button>
        </form>

        {results.length > 0 && (
          <ul className="mt-3 space-y-2">
            {results.map((d) => {
              const already = selectedIds.has(d.id);
              const inSuggested = suggested.find((s) => s.id === d.id);
              return (
                <li
                  key={d.id}
                  className="flex items-start justify-between gap-3 rounded-lg border hairline bg-background/60 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {d.organization}
                    </div>
                    <div className="mt-0.5 text-sm font-semibold">{d.title}</div>
                  </div>
                  {already ? (
                    <button
                      onClick={() => toggle(d)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-2 py-1 text-[10px] text-primary"
                    >
                      <X className="h-3 w-3" /> Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (!inSuggested) w.setSelectedDatasets([...w.selectedDatasets, d]);
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] text-primary-foreground"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {w.selectedDatasets.length} dataset{w.selectedDatasets.length === 1 ? "" : "s"} selected
      </div>
    </div>
  );
}
