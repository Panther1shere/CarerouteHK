import { createFileRoute } from "@tanstack/react-router";
import { Bus, HeartPulse, Leaf, Recycle, Stethoscope, Users } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/use-cases")({
  head: () => ({
    meta: [
      { title: "Roadmap — PolicyGraph HK" },
      {
        name: "description",
        content:
          "Housing is the first PolicyGraph HK module. Next: transport, elderly care, climate resilience, public health, and waste management.",
      },
      { property: "og:title", content: "Roadmap — PolicyGraph HK" },
      {
        property: "og:description",
        content: "Where PolicyGraph HK goes after housing.",
      },
    ],
  }),
  component: UseCasesPage,
});

const modules = [
  { icon: Users, title: "Housing", status: "Live (demo)", body: "Affordability, supply, tenant protection, developer incentives, land supply." },
  { icon: Bus, title: "Transport", status: "Q2 roadmap", body: "Congestion, network load, modal shift, infrastructure ROI." },
  { icon: HeartPulse, title: "Elderly care", status: "Q3 roadmap", body: "Care capacity, family support, public spend, isolation risk." },
  { icon: Leaf, title: "Climate resilience", status: "Q4 roadmap", body: "Flood risk, heat exposure, district-level adaptation portfolios." },
  { icon: Stethoscope, title: "Public health", status: "Exploration", body: "Preventive care leverage, hospital load, behavioural feedback." },
  { icon: Recycle, title: "Waste management", status: "Exploration", body: "Recycling rates, landfill load, producer-responsibility incentives." },
];

function UseCasesPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-20">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Roadmap</div>
        <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold leading-tight md:text-6xl">
          Housing today. <span className="italic text-primary">The city tomorrow.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          The platform generalises beyond housing. Each module is a new system model with its
          own stakeholders, loops, dimensions, and intervention library.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <div key={m.title} className="rounded-2xl border hairline bg-surface/40 p-6">
              <div className="mb-5 flex items-center justify-between">
                <m.icon className="h-6 w-6 text-primary" />
                <span className="rounded-full border hairline px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {m.status}
                </span>
              </div>
              <h3 className="font-display text-2xl font-semibold">{m.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{m.body}</p>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
