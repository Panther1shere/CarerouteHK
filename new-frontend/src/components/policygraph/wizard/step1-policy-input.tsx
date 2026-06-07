import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, FileText, Loader2, Play, X, AlertCircle } from "lucide-react";
import { useWizard } from "./wizard-context";
import { analyzePolicy, parseDraft } from "@/lib/policygraph/analyze.functions";

export function Step1PolicyInput() {
  const w = useWizard();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftFile, setDraftFile] = useState<string | null>(null);

  const parseFn = useServerFn(parseDraft);
  const analyzeFn = useServerFn(analyzePolicy);

  const parse = useMutation({
    mutationFn: async (file: File) => {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      return parseFn({ data: { filename: file.name, mimeType: file.type || "text/plain", contentBase64: b64 } });
    },
    onSuccess: (res) => {
      w.setDraftText(res.text);
      setDraftFile(res.filename);
      // pre-fill query with a short summary line if empty
      if (!w.query) {
        const firstLine = res.text.split("\n").find((l) => l.trim().length > 10)?.slice(0, 200);
        if (firstLine) w.setQuery(firstLine);
      }
    },
  });

  const analyze = useMutation({
    mutationFn: () =>
      analyzeFn({
        data: { query: w.query.trim(), horizon: w.horizon, draftText: w.draftText || undefined },
      }),
    onSuccess: (a) => {
      w.setAnalysis(a);
      // pre-select all returned datasets by default
      w.setSelectedDatasets(a.datasets);
      w.setStep(2);
    },
  });

  function onFiles(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > 6 * 1024 * 1024) {
      alert("File too large (max 6 MB).");
      return;
    }
    parse.mutate(f);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
          Step 1 — Policy input
        </div>
        <h2 className="mt-2 font-display text-4xl font-semibold">
          What policy do you want to analyse?
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Describe a policy in plain language, or upload a draft document. The model will
          plan its own dataset queries against data.gov.hk before any analysis.
        </p>
      </div>

      <div className="rounded-2xl border hairline bg-surface/40 p-5">
        <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Policy description
        </label>
        <textarea
          value={w.query}
          onChange={(e) => w.setQuery(e.target.value)}
          rows={4}
          placeholder="e.g. tax SDU landlords and route revenue into transitional housing"
          className="mt-2 w-full resize-y rounded-lg border hairline bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
        />

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Horizon emphasis
          </span>
          <div className="flex items-center gap-1 rounded-full border hairline bg-background/40 p-1">
            {(["short", "long"] as const).map((h) => (
              <button
                key={h}
                onClick={() => w.setHorizon(h)}
                className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider transition ${
                  w.horizon === h
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {h === "short" ? "0–2 yrs" : "5–10 yrs"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed hairline bg-surface/30 p-5">
        <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Optional — Upload policy draft
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Supported: .txt, .md, .json (max 6 MB). PDF/DOCX coming soon — paste the text
          for now.
        </p>

        {draftFile ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border hairline bg-background/60 p-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{draftFile}</div>
                <div className="text-[11px] text-muted-foreground">
                  {w.draftText.length.toLocaleString()} chars parsed
                </div>
              </div>
            </div>
            <button
              onClick={() => { w.setDraftText(""); setDraftFile(null); }}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={parse.isPending}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed hairline bg-background/40 py-6 text-sm text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60"
          >
            {parse.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Parsing…</>
            ) : (
              <><Upload className="h-4 w-4" /> Click to upload a draft document</>
            )}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".txt,.md,.markdown,.json,text/*,application/json"
          onChange={(e) => onFiles(e.target.files)}
        />
        {parse.error && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-xs">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coral" />
            {parse.error.message}
          </div>
        )}
      </div>

      {analyze.error && (
        <div className="flex items-start gap-2 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
          <div>
            <div className="font-medium">Analysis failed</div>
            <div className="text-muted-foreground">{analyze.error.message}</div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => analyze.mutate()}
          disabled={analyze.isPending || w.query.trim().length < 3}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {analyze.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Planning queries & analysing…</>
          ) : (
            <><Play className="h-4 w-4" /> Analyse policy → Step 2</>
          )}
        </button>
      </div>
    </div>
  );
}
