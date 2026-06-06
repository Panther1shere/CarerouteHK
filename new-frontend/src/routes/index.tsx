import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Home,
  Building2,
  Bus,
  HeartPulse,
  GraduationCap,
  Leaf,
  Network,
  FileText,
  Settings,
  Bell,
  Search,
  CircleUser,
  ShieldCheck,
  Activity,
  ChevronRight,
} from "lucide-react";
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

const modules = [
  { id: "housing", label: "Housing", icon: Building2, status: "live" as const },
  { id: "transport", label: "Transport", icon: Bus, status: "soon" as const },
  { id: "health", label: "Public Health", icon: HeartPulse, status: "soon" as const },
  { id: "education", label: "Education", icon: GraduationCap, status: "soon" as const },
  { id: "environment", label: "Environment", icon: Leaf, status: "soon" as const },
];

const tools = [
  { id: "simulator", label: "Policy Simulator", icon: Network },
  { id: "briefs", label: "Decision Briefs", icon: FileText },
  { id: "monitor", label: "System Monitor", icon: Activity },
];

function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <Breadcrumbs />
        <main className="flex-1">
          <WizardShell />
          <div className="h-24" />
        </main>
        <StatusBar />
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
        <div>
          <div className="font-display text-sm font-semibold leading-none">PolicyGraph</div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-primary">
            HKSAR · Internal
          </div>
        </div>
      </div>

      <div className="px-3 py-4">
        <div className="rounded-lg border hairline bg-background/60 p-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            Workspace
          </div>
          <div className="mt-1 text-sm font-semibold">Housing Bureau</div>
          <div className="text-[11px] text-muted-foreground">Policy Innovation Unit</div>
        </div>
      </div>

      <nav className="px-3 pb-2">
        <div className="px-2 pb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          Modules
        </div>
        <ul className="space-y-0.5">
          {modules.map((m) => {
            const active = m.id === "housing";
            return (
              <li key={m.id}>
                <button
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm transition ${
                    active
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                  }`}
                  disabled={m.status === "soon"}
                >
                  <span className="flex items-center gap-2.5">
                    <m.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                    {m.label}
                  </span>
                  {m.status === "soon" ? (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      soon
                    </span>
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav className="px-3 pt-2">
        <div className="px-2 pb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          Tools
        </div>
        <ul className="space-y-0.5">
          {tools.map((t) => {
            const active = t.id === "simulator";
            return (
              <li key={t.id}>
                <a
                  href="#simulator"
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition ${
                    active
                      ? "bg-surface text-foreground"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto border-t hairline px-3 py-3">
        <ul className="space-y-0.5 text-sm">
          <li>
            <Link
              to="/about"
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              <FileText className="h-4 w-4" />
              Methodology
            </Link>
          </li>
          <li>
            <Link
              to="/use-cases"
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              <Network className="h-4 w-4" />
              Roadmap
            </Link>
          </li>
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
      <div className="flex items-center gap-4 px-6 py-3">
        <div className="flex items-center gap-2 lg:hidden">
          <div className="relative h-7 w-7">
            <div className="absolute inset-0 rounded-md bg-primary/20" />
            <div className="absolute inset-[3px] rounded-sm border border-primary/60" />
          </div>
          <span className="font-display text-sm font-semibold">PolicyGraph</span>
        </div>

        <div className="relative hidden max-w-md flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search policies, briefs, stakeholders…"
            className="w-full rounded-md border hairline bg-surface/50 py-1.5 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border hairline bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-jade/30 bg-jade/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-foreground md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-jade" />
            System nominal
          </span>
          <span className="hidden items-center gap-1.5 rounded-full border hairline px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground md:inline-flex">
            <ShieldCheck className="h-3 w-3 text-primary" />
            Restricted · L2
          </span>
          <button className="rounded-md border hairline p-1.5 text-muted-foreground hover:text-foreground">
            <Bell className="h-4 w-4" />
          </button>
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
      </div>
    </header>
  );
}

function Breadcrumbs() {
  return (
    <div className="border-b hairline bg-background/60">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Home className="h-3.5 w-3.5" />
          <ChevronRight className="h-3 w-3 opacity-50" />
          <span>Modules</span>
          <ChevronRight className="h-3 w-3 opacity-50" />
          <span>Housing</span>
          <ChevronRight className="h-3 w-3 opacity-50" />
          <span className="text-foreground">Policy Simulator</span>
        </nav>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Case ID</span>
          <span className="rounded border hairline bg-surface/50 px-2 py-0.5 text-foreground">
            HSG-2026-0418
          </span>
          <span className="hidden md:inline">· Last sync 2m ago</span>
        </div>
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <footer className="sticky bottom-0 border-t hairline bg-background/85 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-jade" /> Simulator online
          </span>
          <span className="hidden md:inline">Model v0.1 · demo dataset</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Env · STAGING</span>
          <span>© {new Date().getFullYear()} HKSAR PolicyGraph</span>
        </div>
      </div>
    </footer>
  );
}
