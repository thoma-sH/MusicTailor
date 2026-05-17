import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useDeferredValue } from "react";

import { AmbientBlobs } from "../components/AmbientBlobs";
import { HeroDemo } from "../components/HeroDemo";
import { PresetShowcase } from "../components/PresetShowcase";
import { ResultsGrid } from "../components/ResultsGrid";
import { SeedInput } from "../components/SeedInput";
import { SliderPanel } from "../components/SliderPanel";
import { TypePicker } from "../components/TypePicker";
import { recommend } from "../lib/api";
import type { RecommendRequest } from "../lib/schemas";
import { useAppStore } from "../state/app";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const inputType = useAppStore((s) => s.inputType);
  const outputType = useAppStore((s) => s.outputType);
  const seed = useAppStore((s) => s.seed);
  const sliders = useAppStore((s) => s.sliders);
  const setInputType = useAppStore((s) => s.setInputType);
  const setOutputType = useAppStore((s) => s.setOutputType);
  const setSeed = useAppStore((s) => s.setSeed);

  const deferredSliders = useDeferredValue(sliders);

  const req: RecommendRequest | null = seed
    ? {
        seed: { input_type: inputType, id: seed.id },
        output_type: outputType,
        sliders: deferredSliders,
        k: 10,
      }
    : null;

  const { data, isFetching } = useQuery({
    queryKey: ["recommend", req],
    queryFn: ({ signal }) => recommend(req as RecommendRequest, signal),
    enabled: req !== null,
    staleTime: 30_000,
  });

  return (
    <>
      <AmbientBlobs inputType={inputType} outputType={outputType} />
      <div className="mx-auto max-w-7xl px-6 pb-24 md:px-10">
        <Hero />
        <PresetShowcase />
        <Composer
          inputType={inputType}
          outputType={outputType}
          onInputType={setInputType}
          onOutputType={setOutputType}
          seed={seed}
          onSelectSeed={setSeed}
        />
        <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
          <div className="order-2 lg:order-1">
            {seed ? (
              <ResultsGrid items={data?.items ?? []} outputType={outputType} loading={isFetching} />
            ) : (
              <EmptyState />
            )}
          </div>
          <aside className="order-1 lg:order-2 lg:sticky lg:top-6 lg:self-start">
            <SliderPanel accent={outputType} />
          </aside>
        </section>
      </div>
    </>
  );
}

function Hero() {
  return (
    <section className="relative grid gap-10 pt-10 pb-16 md:pt-16 md:pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-center lg:gap-16">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.2, 0.7, 0.3, 1] }}
        className="space-y-7"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)]/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-muted-foreground)] backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-mint-deep)]" />a
          recommendation rig, not a feed
        </span>
        <h1 className="text-balance font-display text-[clamp(2.8rem,8vw,6rem)] font-light leading-[0.92] tracking-tight">
          Recommendations,
          <br />
          <span className="italic text-[color:var(--color-foreground)]/80">tuned</span> to you.
        </h1>
        <p className="max-w-md text-pretty text-base leading-relaxed text-[color:var(--color-muted-foreground)] md:text-lg">
          Seed it with a song, album, artist, or playlist. Ask for any of the four back. Tune the
          dials until the result is exactly the kind of strange you wanted.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="#composer"
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-foreground)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-background)] no-underline transition hover:opacity-90"
          >
            Start a recommendation
            <span aria-hidden>→</span>
          </a>
          <a
            href="/presets"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)]/70 px-5 py-2.5 text-sm font-medium text-[color:var(--color-foreground)] no-underline backdrop-blur transition hover:bg-[color:var(--color-card)]"
          >
            Browse presets
          </a>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.75, ease: [0.2, 0.7, 0.3, 1], delay: 0.1 }}
      >
        <HeroDemo />
      </motion.div>
    </section>
  );
}

function Composer({
  inputType,
  outputType,
  onInputType,
  onOutputType,
  seed,
  onSelectSeed,
}: {
  inputType: ReturnType<typeof useAppStore.getState>["inputType"];
  outputType: ReturnType<typeof useAppStore.getState>["outputType"];
  onInputType: (t: ReturnType<typeof useAppStore.getState>["inputType"]) => void;
  onOutputType: (t: ReturnType<typeof useAppStore.getState>["outputType"]) => void;
  seed: ReturnType<typeof useAppStore.getState>["seed"];
  onSelectSeed: (s: ReturnType<typeof useAppStore.getState>["seed"]) => void;
}) {
  return (
    <section
      id="composer"
      className="scroll-mt-6 space-y-6 border-t border-[color:var(--color-border)]/60 pt-12"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-muted-foreground)]">
            compose
          </div>
          <h2 className="mt-1 font-display text-3xl font-light tracking-tight md:text-4xl">
            Build your own.
          </h2>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="text-xs uppercase tracking-widest text-[color:var(--color-muted-foreground)]">
          I have a
        </span>
        <TypePicker scope="input" value={inputType} onChange={onInputType} />
        <span className="text-xs uppercase tracking-widest text-[color:var(--color-muted-foreground)]">
          show me
        </span>
        <TypePicker scope="output" value={outputType} onChange={onOutputType} />
      </div>
      <SeedInput inputType={inputType} selected={seed} onSelect={onSelectSeed} />
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-card)]/40 px-6 py-16 text-center">
      <div className="mx-auto max-w-md space-y-3">
        <div className="font-display text-2xl">Start with a seed.</div>
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          Pick something above. The recommendations re-rank live as you tune the dials on the right.
        </p>
      </div>
    </div>
  );
}
