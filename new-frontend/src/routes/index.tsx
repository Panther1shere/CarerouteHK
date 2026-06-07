import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  CircleUser,
  FileText,
  FolderKanban,
  History,
  House,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import { WizardShell } from "@/components/policygraph/wizard/wizard-shell";
import { WizardProvider, useWizard } from "@/components/policygraph/wizard/wizard-context";
import {
  listPolicyHistory,
  loadSavedPolicyAnalysis,
  type PolicySummary,
} from "@/lib/policygraph/analyze.functions";
import {
  Sidebar as SidebarFrame,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PolicyGraph HK" },
      {
        name: "description",
        content:
          "Internal decision-support platform for HKSAR policy teams. Simulate housing policies, map stakeholders, and surface high-leverage interventions.",
      },
      { property: "og:title", content: "PolicyGraph HK" },
      {
        property: "og:description",
        content: "Simulate housing policies against a system model before implementation.",
      },
    ],
  }),
  component: AppShell,
});

const primaryNav = [
  { label: "Workspace", to: "/", icon: LayoutDashboard, exact: true },
  { label: "Method", to: "/about", icon: FileText },
  { label: "Roadmap", to: "/use-cases", icon: FolderKanban },
];

function AppShell() {
  return (
    <WizardProvider>
      <SidebarProvider defaultOpen>
        <SidebarFrame collapsible="icon" className="border-r nav-divider bg-transparent">
          <WorkspaceSidebar />
          <SidebarRail />
        </SidebarFrame>
        <SidebarInset className="min-w-0 bg-transparent text-foreground">
          <TopBar />
          <main className="flex-1 px-5 py-5 md:px-7 md:py-6">
            <div className="panel-elevated min-h-[calc(100vh-5rem)] rounded-[30px] border hairline">
              <WizardShell />
            </div>
            <div className="h-10" />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </WizardProvider>
  );
}

function WorkspaceSidebar() {
  const wizard = useWizard();
  const listHistoryFn = useServerFn(listPolicyHistory);
  const loadSavedPolicyFn = useServerFn(loadSavedPolicyAnalysis);
  const history = useQuery({
    queryKey: ["policy-history"],
    queryFn: () => listHistoryFn(),
    staleTime: 15_000,
  });
  const loadPolicy = useMutation({
    mutationFn: (policyId: number) => loadSavedPolicyFn({ data: { policyId } }),
    onSuccess: (analysis) => {
      wizard.setQuery(analysis.policy.label);
      wizard.setDraftText("");
      wizard.setAnalysis(analysis);
      wizard.setBundleAnalysis(null);
      wizard.setSelectedDatasets(analysis.datasets ?? []);
      wizard.setCustomStakeholders([]);
      wizard.setStep(3);
    },
  });

  return (
    <div className="nav-rail flex h-full flex-col overflow-hidden">
      <div className="border-b nav-divider px-5 pb-5 pt-6 group-data-[collapsible=icon]:px-2">
        <div className="flex items-start gap-3">
          <div className="relative mt-0.5 h-11 w-11 shrink-0 rounded-xl border border-white/10 bg-white/4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="absolute inset-[8px] rounded-lg border border-white/20" />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#9bb8e8]" />
            <div className="absolute left-[9px] top-[9px] h-1.5 w-1.5 rounded-full bg-white/45" />
            <div className="absolute bottom-[9px] right-[9px] h-1.5 w-1.5 rounded-full bg-white/35" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="font-display text-xl font-semibold tracking-tight text-white">
              PolicyGraph HK
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.24em] text-slate-300/70">
              Housing policy workspace
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mb-8">
          <div className="px-3 pb-3 font-mono text-[10px] uppercase tracking-[0.28em] text-slate-300/58 group-data-[collapsible=icon]:hidden">
            Primary navigation
          </div>
          <nav className="space-y-1.5">
            {primaryNav.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                activeOptions={item.exact ? { exact: true } : undefined}
                title={item.label}
                className="relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-200/82 transition duration-150 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-r-full before:bg-transparent hover:bg-white/5 hover:text-white group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 [&.active]:bg-white/7 [&.active]:text-white [&.active]:before:bg-[#8fb1e3]"
              >
                <item.icon className="h-[18px] w-[18px] shrink-0 stroke-[1.8]" />
                <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="mb-8 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-slate-300/58">
              Saved analyses
            </div>
            {history.data && (
              <span className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-300/62">
                {history.data.length}
              </span>
            )}
          </div>
          <PolicyHistoryList
            policies={history.data ?? []}
            isLoading={history.isPending}
            error={history.error}
            loadingPolicyId={loadPolicy.variables ?? null}
            onSelectPolicy={(policyId) => loadPolicy.mutate(policyId)}
          />
          {loadPolicy.error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-300/25 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-100/88">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Could not load that saved analysis.
            </div>
          )}
        </div>

        <div className="group-data-[collapsible=icon]:hidden">
          <div className="px-3 pb-3 font-mono text-[10px] uppercase tracking-[0.28em] text-slate-300/58">
            Workspace
          </div>
          <div className="rounded-2xl border border-white/6 bg-white/[0.035] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg border border-white/8 bg-white/6">
                <House className="h-4 w-4 stroke-[1.8] text-slate-200/84" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-100/92">Hong Kong Housing</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400/72">
                  Sandbox module
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t nav-divider px-4 py-4">
        <button className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-200/78 transition hover:bg-white/5 hover:text-white group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
          <Settings className="h-[18px] w-[18px] shrink-0 stroke-[1.8]" />
          <span className="group-data-[collapsible=icon]:hidden">Settings</span>
        </button>
      </div>
    </div>
  );
}

function PolicyHistoryList({
  policies,
  isLoading,
  error,
  loadingPolicyId,
  onSelectPolicy,
}: {
  policies: PolicySummary[];
  isLoading: boolean;
  error: unknown;
  loadingPolicyId: number | null;
  onSelectPolicy: (policyId: number) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-[74px] animate-pulse rounded-xl border border-white/6 bg-white/[0.035]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-xs leading-5 text-red-100/88">
        Saved analysis history is unavailable. Check that the backend is running.
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <div className="rounded-xl border border-white/6 bg-white/[0.03] px-4 py-4 text-xs leading-5 text-slate-300/72">
        No saved backend analyses yet. Run a policy analysis and it will appear here.
      </div>
    );
  }

  return (
    <ul className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
      {policies.map((policy) => (
        <li key={policy.policy_id}>
          <button
            type="button"
            onClick={() => onSelectPolicy(policy.policy_id)}
            disabled={loadingPolicyId === policy.policy_id}
            className="group flex w-full min-w-0 items-start gap-3 rounded-xl border border-white/6 bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/10 hover:bg-white/[0.055] disabled:opacity-65"
          >
            <History className="mt-0.5 h-[16px] w-[16px] shrink-0 stroke-[1.8] text-slate-400/80 transition group-hover:text-slate-200" />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium leading-5 text-slate-100/88">
                {policy.text_preview}
              </span>
              <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400/68">
                {formatHistoryDate(policy.created_at)} · {policy.node_count} nodes ·{" "}
                {policy.feedback_loop_count} loops
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-HK", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function TopBar() {
  return (
    <header className="sticky top-0 z-30 px-5 pt-5 md:px-7 md:pt-6">
      <div className="flex items-center justify-between rounded-[22px] border hairline bg-white/82 px-5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.05)] backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="h-9 w-9 rounded-full border hairline bg-white text-primary hover:bg-surface" />
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/80">
              Hong Kong Government policy tool
            </div>
            <div className="mt-1 truncate text-sm text-muted-foreground">
              Internal decision-support environment for housing policy analysis
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 rounded-full border hairline bg-white px-3 py-2 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10">
              <CircleUser className="h-4 w-4 text-primary" />
            </div>
            <div className="hidden text-left leading-tight md:block">
              <div className="text-xs font-semibold">A. Wong</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Senior analyst
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
