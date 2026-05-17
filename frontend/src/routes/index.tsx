import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useDeferredValue } from "react";

import { AmbientBlobs } from "../components/AmbientBlobs";
import { MorphSentence } from "../components/MorphSentence";
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

  // Defer slider changes so dragging is buttery, even when results take a moment.
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
      <div className="mx-auto max-w-7xl px-6 pb-16 pt-8 md:px-10 md:pt-14">
        <section className="relative">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.2, 0.7, 0.3, 1] }}
            className="space-y-6"
          >
            <MorphSentence inputType={inputType} outputType={outputType} />
            <p className="max-w-xl text-balance text-base leading-relaxed text-[color:var(--color-muted-foreground)]">
              Pick anything as the seed. Pick anything as the recommendation. Then tune the
              algorithm — popularity, diversity, era, the exact artists you do and don't want. Your
              dials. Your taste.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-6 md:gap-8">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className="text-xs uppercase tracking-widest text-[color:var(--color-muted-foreground)]">
                I have a
              </span>
              <TypePicker scope="input" value={inputType} onChange={setInputType} />
              <span className="text-xs uppercase tracking-widest text-[color:var(--color-muted-foreground)]">
                show me
              </span>
              <TypePicker scope="output" value={outputType} onChange={setOutputType} />
            </div>

            <SeedInput inputType={inputType} selected={seed} onSelect={setSeed} />
          </div>
        </section>

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

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-card)]/40 px-6 py-16 text-center">
      <div className="mx-auto max-w-md space-y-3">
        <div className="font-display text-2xl">Start with a seed.</div>
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          Search above to pick a song, album, artist, or playlist. Then watch your recommendations
          re-rank live as you tune the dials.
        </p>
      </div>
    </div>
  );
}
