import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-xl space-y-4 text-center">
        <h1 className="text-5xl font-semibold tracking-tight">MusicTailor</h1>
        <p className="text-balance text-base text-muted-foreground">
          Find fan-favorite tracks from artists you've never heard but who fit your taste.
        </p>
        <p className="text-xs uppercase tracking-widest text-muted-foreground/60">
          Phase 0 — scaffold
        </p>
      </div>
    </main>
  );
}
