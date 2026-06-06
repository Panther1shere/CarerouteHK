import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b hairline bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-md bg-primary/20" />
            <div className="absolute inset-[3px] rounded-sm border border-primary/60" />
            <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
            <div className="absolute left-1 top-1 h-1 w-1 rounded-full bg-primary/70" />
            <div className="absolute bottom-1 right-1 h-1 w-1 rounded-full bg-primary/70" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-lg font-semibold tracking-tight">PolicyGraph</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">HK</span>
          </div>
        </Link>
        <nav className="hidden items-center gap-7 text-sm md:flex">
          <Link to="/" className="text-muted-foreground transition hover:text-foreground [&.active]:text-foreground">Simulator</Link>
          <Link to="/about" className="text-muted-foreground transition hover:text-foreground [&.active]:text-foreground">Method</Link>
          <Link to="/use-cases" className="text-muted-foreground transition hover:text-foreground [&.active]:text-foreground">Roadmap</Link>
        </nav>
        <a
          href="#simulator"
          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition hover:opacity-90"
        >
          Run a policy
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t hairline mt-32">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-3">
        <div>
          <div className="font-display text-2xl font-semibold">PolicyGraph HK</div>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            A decision-intelligence platform for governments. See the system before you act.
          </p>
        </div>
        <div className="text-sm">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Product</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/" className="hover:text-foreground">Simulator</Link></li>
            <li><Link to="/about" className="hover:text-foreground">Method</Link></li>
            <li><Link to="/use-cases" className="hover:text-foreground">Roadmap</Link></li>
          </ul>
        </div>
        <div className="text-sm text-muted-foreground">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Note</div>
          <p>
            Demo model built on the Innolabs system-thinking framework — system maps,
            feedback loops, system boundaries, and intervention points.
          </p>
        </div>
      </div>
      <div className="border-t hairline">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} PolicyGraph HK</span>
          <span className="font-mono uppercase tracking-[0.2em]">v0.1 · demo model</span>
        </div>
      </div>
    </footer>
  );
}
