import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Send, Loader2, MessageSquare, X, Sparkles } from "lucide-react";
import { useWizard } from "./wizard-context";
import { chatWithContext } from "@/lib/policygraph/analyze.functions";

export function Chatbot() {
<<<<<<< HEAD
  const { step, query, horizon, analysis, selectedDatasets, chatMessages, setChatMessages } = useWizard();
  const [open, setOpen] = useState(false);
=======
  const { step, query, horizon, analysis, selectedDatasets, chatMessages, setChatMessages } =
    useWizard();
  const [open, setOpen] = useState(true);
>>>>>>> 7a19f56 (added the small thing)
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
              label: s.label,
              level: s.level,
              group: s.group,
              impact: s.impact,
              note: s.note,
            })),
            loops: analysis.loops.map((l) => ({
              title: l.title,
              type: l.type,
              summary: l.summary,
            })),
            warnings: analysis.warnings,
            bundle: analysis.bundle,
          })
        : undefined;
      const datasets = (selectedDatasets.length ? selectedDatasets : (analysis?.datasets ?? []))
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
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full border hairline bg-white px-4 py-3 text-sm font-semibold text-foreground shadow-[0_18px_40px_rgba(15,23,42,0.14)] transition hover:border-primary/25 hover:text-primary"
      >
        <MessageSquare className="h-4 w-4" /> Ask the assistant
      </button>
    );
  }

  return (
    <aside className="fixed bottom-6 right-6 z-50 flex h-[min(68vh,640px)] w-[min(420px,calc(100vw-32px))] flex-col rounded-[24px] border hairline bg-white/96 shadow-[0_28px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl">
      <header className="flex items-center justify-between border-b hairline px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl border hairline bg-primary/8">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Policy assistant</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Context
            </div>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-full border hairline p-2 text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {chatMessages.length === 0 && (
          <div className="rounded-2xl border border-dashed hairline bg-surface p-4 text-xs leading-6 text-muted-foreground">
            Ask me anything about the current step. I have the full context of your policy,
            stakeholders, selected data sources, and the latest analysis.
          </div>
        )}
        {chatMessages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground shadow-[0_10px_20px_rgba(15,23,42,0.08)]"
                  : "border hairline bg-surface/80 text-foreground"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {send.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl border hairline bg-surface/80 px-3 py-2 text-sm">
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
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-2 border-t hairline p-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask, refine, challenge…"
          className="min-w-0 flex-1 rounded-xl border hairline bg-surface px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <button
          type="submit"
          disabled={send.isPending || !input.trim()}
          className="inline-flex items-center justify-center rounded-xl bg-primary p-2.5 text-primary-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </aside>
  );
}
