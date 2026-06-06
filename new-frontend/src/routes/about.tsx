import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "Method — PolicyGraph HK" },
      {
        name: "description",
        content:
          "How PolicyGraph HK turns system-thinking — stakeholders, feedback loops, system boundaries, and intervention points — into decision intelligence for government.",
      },
      { property: "og:title", content: "Method — PolicyGraph HK" },
      {
        property: "og:description",
        content: "The system-thinking method behind PolicyGraph HK.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-20">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Method</div>
        <h1 className="mt-3 font-display text-5xl font-semibold leading-tight md:text-6xl">
          Decision intelligence, not another dashboard.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Most smart-city tools tell you what is happening. PolicyGraph HK shows you{" "}
          <em>why</em> it is happening, who is influencing it, what loops are reinforcing it,
          where a policy might fail, and what combination of actions works better.
        </p>

        <Section title="The problem">
          Governments make decisions in complex systems where the full picture is hard to see.
          In housing, a single decision ripples through tenants, landlords, developers, land
          prices, public housing demand, government budget, transport pressure, inequality,
          and public satisfaction. The challenge is not missing data — it is{" "}
          <em>disconnected</em> data. A normal dashboard shows that rent is increasing, but
          not which feedback loop is driving it.
        </Section>

        <Section title="The frame">
          PolicyGraph HK uses the Innolabs system-thinking framework — system maps, reinforcing
          and balancing feedback loops, system boundaries, and intervention points — to turn
          public data into structured decision intelligence.
        </Section>

        <Section title="How a simulation works">
          A user enters a policy in plain language. The platform identifies the affected
          stakeholders, the edges between them, the loops it triggers, the dimensions on which
          impact is most likely (positive or negative, short or long term), the most likely
          second-order failures, and the bundle of interventions that maximises leverage.
        </Section>

        <Section title="Why now">
          Cities are becoming more complex. Housing, transport, climate, aging population,
          and inequality no longer stand alone — they influence each other. Hong Kong has
          strong public data infrastructure, but the policy layer still needs better tools
          to turn that data into system-level decisions.
        </Section>

        <blockquote className="mt-12 border-l-2 border-primary/60 pl-5 font-display text-2xl italic">
          Instead of reacting after a policy fails, governments can test policies before
          implementation and design smarter, more resilient solutions.
        </blockquote>
      </article>
      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-semibold text-primary">{title}</h2>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground md:text-lg">{children}</p>
    </section>
  );
}
