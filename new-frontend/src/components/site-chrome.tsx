import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b hairline bg-white/88 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-xl border hairline bg-surface shadow-[0_10px_20px_rgba(15,23,42,0.05)]">
            <div className="absolute inset-[7px] rounded-lg border border-primary/28" />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
          </div>
          <div>
            <div className="font-display text-xl font-semibold tracking-tight">PolicyGraph HK</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/78">
              Government decision platform
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          <NavLink to="/">Simulator</NavLink>
          <NavLink to="/demo">Demo</NavLink>
          <NavLink to="/about">Method</NavLink>
          <NavLink to="/use-cases">Roadmap</NavLink>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-28 border-t hairline bg-white/6">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-3">
        <div>
          <div className="font-display text-2xl font-semibold">PolicyGraph HK</div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            Decision intelligence for public-sector teams designing and testing housing policy.
          </p>
        </div>
        <div className="text-sm">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.24em] text-primary/78">
            Navigation
          </div>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <Link to="/" className="transition hover:text-foreground">
                Simulator
              </Link>
            </li>
            <li>
              <Link to="/demo" className="transition hover:text-foreground">
                Demo
              </Link>
            </li>
            <li>
              <Link to="/about" className="transition hover:text-foreground">
                Method
              </Link>
            </li>
            <li>
              <Link to="/use-cases" className="transition hover:text-foreground">
                Roadmap
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm text-muted-foreground">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.24em] text-primary/78">
            Note
          </div>
          <p className="leading-6">
            This demonstration uses relationship maps, feedback loops, and intervention logic as
            decision-support inputs rather than as a substitute for policy judgment.
          </p>
        </div>
      </div>
      <div className="border-t hairline">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} PolicyGraph HK</span>
          <span className="font-mono uppercase tracking-[0.22em]">v0.1 · government sandbox</span>
        </div>
      </div>
    </footer>
  );
}

function NavLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground [&.active]:bg-primary [&.active]:text-primary-foreground"
    >
      {children}
    </Link>
  );
}
