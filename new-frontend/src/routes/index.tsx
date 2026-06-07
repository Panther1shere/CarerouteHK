import { createFileRoute } from "@tanstack/react-router";
import { Settings, CircleUser } from "lucide-react";
import { WizardShell } from "@/components/policygraph/wizard/wizard-shell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PolicyGraph HK · Housing Module — Government Decision Platform" },
      {
        name: "description",
        content:
          "Internal decision-support platform for HKSAR policy teams. Simulate housing policies, map stakeholders, and surface high-leverage interventions.",
      },
      { property: "og:title", content: "PolicyGraph HK · Government Decision Platform" },
      {
        property: "og:description",
        content:
          "Simulate housing policies against a system model before implementation.",
      },
    ],
  }),
  component: AppShell,
});

const analysisHistory = [
  { id: "hsg-2026-0418", label: "Stronger rent control in high-density districts", date: "2 hours ago" },
  { id: "hsg-2026-0402", label: "Vacancy tax on idle residential units", date: "Yesterday" },
  { id: "hsg-2026-0391", label: "Faster approvals for public housing projects", date: "3 days ago" },
  { id: "hsg-2026-0377", label: "Targeted rent subsidies for low-income households", date: "1 week ago" },
];

function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1">
          <WizardShell />
          <div className="h-24" />
        </main>
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r hairline bg-surface/40 lg:flex">
      <div className="flex items-center gap-2.5 border-b hairline px-5 py-4">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-md bg-primary/20" />
          <div className="absolute inset-[3px] rounded-sm border border-primary/60" />
          <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
        </div>
        <div className="font-display text-sm font-semibold leading-none">POG</div>
      </div>

      <nav className="px-3 py-4">
        <div className="px-2 pb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          History
        </div>
        <ul className="space-y-0.5">
          {analysisHistory.map((h) => (
            <li key={h.id}>
              <button className="flex w-full min-w-0 flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left text-muted-foreground transition hover:bg-surface hover:text-foreground">
                <span className="block w-full truncate text-sm">{h.label}</span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  {h.date}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto border-t hairline px-3 py-3">
        <ul className="space-y-0.5 text-sm">
          <li>
            <button className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-muted-foreground hover:bg-surface hover:text-foreground">
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b hairline bg-background/85 backdrop-blur-xl">
      <div className="flex items-center justify-end px-6 py-3">
        <div className="flex items-center gap-2 rounded-md border hairline px-2 py-1">
          <CircleUser className="h-4 w-4 text-primary" />
          <div className="hidden text-left leading-tight md:block">
            <div className="text-xs font-semibold">A. Wong</div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Senior Analyst
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
