import { AlertTriangle } from "lucide-react";
import type { Warning } from "@/lib/policygraph/policies";

const sevColor: Record<Warning["severity"], string> = {
  low: "var(--color-jade)",
  medium: "var(--color-amber)",
  high: "var(--color-coral)",
};

export function WarningCard({ warning }: { warning: Warning }) {
  return (
    <div
      className="rounded-xl border bg-surface/50 p-4"
      style={{ borderColor: `${sevColor[warning.severity]}55` }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ color: sevColor[warning.severity] }}
        />
        <div>
          <div className="flex items-center gap-2">
            <h5 className="font-semibold">{warning.title}</h5>
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
              style={{ background: sevColor[warning.severity], color: "var(--color-ink)" }}
            >
              {warning.severity}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{warning.detail}</p>
        </div>
      </div>
    </div>
  );
}
