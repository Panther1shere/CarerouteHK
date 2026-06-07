import { useState } from "react";
import { ChevronDown, Trash2, ExternalLink } from "lucide-react";
import type { Stakeholder } from "@/lib/policygraph/analyze.functions";

const LEVEL_STYLE: Record<Stakeholder["level"], { label: string; bar: string; tint: string }> = {
  micro: { label: "Micro Level", bar: "bg-slate-500", tint: "bg-slate-500/5" },
  meso: { label: "Meso Level", bar: "bg-sky-600", tint: "bg-sky-600/5" },
  macro: { label: "Macro Level", bar: "bg-rose-500", tint: "bg-rose-500/5" },
};

const GROUP_DOT: Record<Stakeholder["group"], string> = {
  people: "bg-primary",
  market: "bg-coral",
  government: "bg-jade",
};

export function StakeholderCard({
  stakeholder,
  onRemove,
}: {
  stakeholder: Stakeholder;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const s = stakeholder;
  const style = LEVEL_STYLE[s.level];
  return (
    <div className="overflow-hidden rounded-2xl border hairline bg-background/60">
      <div className={`flex items-center gap-3 ${style.tint} px-4 py-3`}>
        <div className={`h-10 w-1 rounded-full ${style.bar}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${GROUP_DOT[s.group]}`} />
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {style.label} · {s.group}
            </span>
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold">{s.label}</div>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="rounded p-1.5 text-muted-foreground hover:text-coral"
            title="Remove stakeholder"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded p-1.5 text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {!open && (
        <div className="border-t hairline px-4 py-3 text-xs text-muted-foreground">{s.note}</div>
      )}

      {open && (
        <div className="border-t hairline">
          <div className="px-4 py-3 text-xs text-muted-foreground">{s.note}</div>
          <table className="w-full text-left text-sm">
            <tbody>
              {s.analysis.map((row, i) => (
                <tr key={i} className="border-t hairline align-top">
                  <td className="w-44 bg-surface/30 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {row.label}
                  </td>
                  <td className="px-4 py-3">
                    <div>{row.value}</div>
                    {row.source && (
                      <a
                        href={row.source.startsWith("http") ? row.source : "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
                      >
                        source:{" "}
                        {row.source.length > 60 ? row.source.slice(0, 60) + "…" : row.source}
                        {row.source.startsWith("http") && <ExternalLink className="h-3 w-3" />}
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
