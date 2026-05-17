import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="relative min-h-screen text-[color:var(--color-foreground)] antialiased">
      <TopNav />
      <main className="relative z-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function TopNav() {
  return (
    <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 pt-6 md:px-10">
      <Link to="/" className="inline-flex items-baseline gap-2 font-display text-xl tracking-tight">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: "var(--color-lavender-deep)" }}
        />
        <span>MusicTailor</span>
      </Link>
      <nav className="flex items-center gap-1 text-sm">
        <NavLink to="/">Tailor</NavLink>
        <NavLink to="/presets">Presets</NavLink>
      </nav>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-full px-3 py-1.5 text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-muted)] hover:text-[color:var(--color-foreground)]"
      activeProps={{
        className:
          "rounded-full px-3 py-1.5 bg-[color:var(--color-muted)] text-[color:var(--color-foreground)]",
      }}
    >
      {children}
    </Link>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 mx-auto mt-24 max-w-7xl px-6 pb-10 text-xs text-[color:var(--color-muted-foreground)] md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--color-border)] pt-6">
        <div>MusicTailor · Tune your own algorithm</div>
        <div className="opacity-60">Demo dataset · curated tracks for preview</div>
      </div>
    </footer>
  );
}
