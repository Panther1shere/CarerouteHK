import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Send, Loader2, MessageSquare, X, Sparkles } from "lucide-react";
import { useWizard } from "./wizard-context";
import { chatWithContext } from "@/lib/policygraph/analyze.functions";

export function Chatbot() {
  const { step, query, horizon, analysis, selectedDatasets, chatMessages, setChatMessages } = useWizard();
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fn = useServerFn(chatWithContext);

  const send = useMutation({
    mutationFn: async (text: string) => {
      const nextMsgs = [...chatMessages, { role: "user" as const, content: text }];
      setChatMessages(nextMsgs);
      const summary = analysis
        ? JSON.stringify({
            interpretation: analysis.interpretation,
            policy: analysis.policy,
            stakeholders: analysis.stakeholders.map((s) => ({
              label: s.label, level: s.level, group: s.group, impact: s.impact, note: s.note,
            })),
            loops: analysis.loops.map((l) => ({ title: l.title, type: l.type, summary: l.summary })),
            warnings: analysis.warnings,
            bundle: analysis.bundle,
          })
        : undefined;
      const datasets = (selectedDatasets.length ? selectedDatasets : analysis?.datasets ?? [])
        .slice(0, 12)
        .map((d) => ({ title: d.title, url: d.url }));
      const res = await fn({
        data: {
          messages: nextMsgs,
          context: { step, query, horizon, analysisSummary: summary, datasets },
        },
      });
      setChatMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, send.isPending]);

  function submit() {
    const t = input.trim();
    if (!t || send.isPending) return;
    setInput("");
    send.mutate(t);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-2xl hover:opacity-90"
      >
        <MessageSquare className="h-4 w-4" /> Ask the assistant
      </button>
    );
  }

  return (
    <aside className="fixed bottom-6 right-6 z-50 flex h-[min(70vh,640px)] w-[min(420px,calc(100vw-32px))] flex-col rounded-2xl border hairline bg-background/95 shadow-2xl backdrop-blur">
      <header className="flex items-center justify-between border-b hairline px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/15">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold">Policy assistant</div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Step {step} · grounded in your datasets
            </div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {chatMessages.length === 0 && (
          <div className="rounded-xl border border-dashed hairline bg-surface/40 p-3 text-xs text-muted-foreground">
            Ask me anything about the current step. I have the full context of your policy,
            stakeholders, selected data sources, and the latest analysis.
          </div>
        )}
        {chatMessages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "border hairline bg-surface/60"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {send.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl border hairline bg-surface/60 px-3 py-2 text-sm">
              <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> thinking…
            </div>
          </div>
        )}
        {send.error && (
          <div className="rounded-lg border border-coral/40 bg-coral/10 p-2 text-xs">
            {send.error.message}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="flex items-center gap-2 border-t hairline p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask, refine, challenge…"
          className="min-w-0 flex-1 rounded-lg border hairline bg-surface/40 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        <button
          type="submit"
          disabled={send.isPending || !input.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-primary p-2 text-primary-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </aside>
  );
}
