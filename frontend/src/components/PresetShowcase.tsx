import { useQueries } from "@tanstack/react-query";
import { motion } from "motion/react";

import { recommend } from "../lib/api";
import type { RecommendItem, RecommendRequest, Sliders } from "../lib/schemas";
import { SHOWCASE_PRESETS, type ShowcasePreset } from "../lib/showcasePresets";
import { TYPE_ACCENT } from "../lib/typeColors";
import { useAppStore } from "../state/app";

export function PresetShowcase() {
  const setSliders = useAppStore((s) => s.setSliders);
  const setInputType = useAppStore((s) => s.setInputType);
  const setOutputType = useAppStore((s) => s.setOutputType);
  const setSeed = useAppStore((s) => s.setSeed);

  const queries = useQueries({
    queries: SHOWCASE_PRESETS.map((p) => {
      const req: RecommendRequest = {
        seed: { input_type: p.demo.inputType, id: p.demo.seedId },
        output_type: p.demo.outputType,
        sliders: p.sliders,
        k: 3,
      };
      return {
        queryKey: ["showcase", p.id],
        queryFn: ({ signal }: { signal: AbortSignal }) => recommend(req, signal),
        staleTime: Number.POSITIVE_INFINITY,
      };
    }),
  });

  function apply(p: ShowcasePreset) {
    setSliders(p.sliders);
    setInputType(p.demo.inputType);
    setOutputType(p.demo.outputType);
    setSeed({
      id: p.demo.seedId,
      name: p.demo.seedName,
      artist: "",
      image: p.demo.seedImage,
      popularity: 0,
    });
    const el = document.getElementById("composer");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="mt-20 space-y-8 md:mt-28">
      <header className="flex items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-muted-foreground)]">
            calibration · 4 starting points
          </div>
          <h2 className="font-display text-3xl font-light tracking-tight md:text-4xl">
            Pick a starting mood.
          </h2>
          <p className="max-w-md text-sm text-[color:var(--color-muted-foreground)]">
            Each card is a slider snapshot we tuned for you. Tap one to load its dials and seed,
            then keep tweaking.
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        {SHOWCASE_PRESETS.map((p, i) => {
          const items = queries[i]?.data?.items ?? [];
          return (
            <ShowcaseCard key={p.id} preset={p} items={items} onApply={() => apply(p)} index={i} />
          );
        })}
      </div>
    </section>
  );
}

function ShowcaseCard({
  preset,
  items,
  onApply,
  index,
}: {
  preset: ShowcasePreset;
  items: RecommendItem[];
  onApply: () => void;
  index: number;
}) {
  const accent = TYPE_ACCENT[preset.demo.outputType];
  return (
    <motion.button
      type="button"
      onClick={onApply}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.2, 0.7, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]/80 p-5 text-left no-underline shadow-[0_18px_60px_-30px_rgba(40,20,80,0.18)] backdrop-blur-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-60 blur-2xl transition-opacity group-hover:opacity-80"
        style={{
          background: `radial-gradient(80% 100% at 50% 0%, ${accent.soft} 0%, transparent 70%)`,
        }}
      />

      <header className="relative space-y-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-muted-foreground)]">
          preset · {String(index + 1).padStart(2, "0")}
        </div>
        <div className="font-display text-xl leading-tight">{preset.name}</div>
        <div className="text-xs leading-snug text-[color:var(--color-muted-foreground)]">
          {preset.subtitle}
        </div>
      </header>

      <div className="relative space-y-1.5">
        {items.length === 0 &&
          Array.from({ length: 3 }, (_, i) => i).map((i) => <TrackSkeleton key={`tskel-${i}`} />)}
        {items.slice(0, 3).map((item) => (
          <TrackRow key={item.id} item={item} accent={accent.soft} />
        ))}
      </div>

      <SliderSnapshot sliders={preset.sliders} accentDeep={accent.deep} />

      <div className="relative flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-muted-foreground)]">
          seeded with {preset.demo.seedName.toLowerCase()}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-foreground)] transition-transform group-hover:translate-x-0.5">
          apply <span aria-hidden>→</span>
        </span>
      </div>
    </motion.button>
  );
}

function TrackRow({ item, accent }: { item: RecommendItem; accent: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 shrink-0 overflow-hidden rounded-md" style={{ background: accent }}>
        {item.image && <img src={item.image} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{item.name}</div>
        <div className="truncate text-[10px] text-[color:var(--color-muted-foreground)]">
          {item.artist_name}
        </div>
      </div>
    </div>
  );
}

function TrackSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 shrink-0 rounded-md bg-[color:var(--color-muted)]" />
      <div className="flex-1 space-y-1">
        <div className="h-2.5 w-3/4 rounded bg-[color:var(--color-muted)]" />
        <div className="h-2 w-1/2 rounded bg-[color:var(--color-muted)]" />
      </div>
    </div>
  );
}

type SliderViz = {
  key: keyof Sliders;
  label: string;
  /** Normalize value to 0..1 for visualization. */
  normalize: (v: number) => number;
};

const SNAPSHOT_SLIDERS: SliderViz[] = [
  { key: "popularity_bias", label: "pop", normalize: (v) => (v + 1) / 2 },
  { key: "diversity", label: "div", normalize: (v) => v },
  { key: "discovery_radius", label: "rad", normalize: (v) => v },
  { key: "era_bias", label: "era", normalize: (v) => (v + 1) / 2 },
];

function SliderSnapshot({ sliders, accentDeep }: { sliders: Sliders; accentDeep: string }) {
  return (
    <div className="relative space-y-1.5 rounded-xl border border-[color:var(--color-border)]/60 bg-[color:var(--color-background)]/40 p-3">
      {SNAPSHOT_SLIDERS.map((s) => {
        const raw = sliders[s.key] as number;
        const pos = Math.max(0, Math.min(1, s.normalize(raw)));
        return (
          <div key={s.key} className="flex items-center gap-2">
            <span className="w-7 shrink-0 font-mono text-[9px] uppercase tracking-widest text-[color:var(--color-muted-foreground)]">
              {s.label}
            </span>
            <div className="relative h-1 flex-1 rounded-full bg-[color:var(--color-border)]/60">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${pos * 100}%`, background: accentDeep, opacity: 0.55 }}
              />
              <div
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                style={{
                  left: `${pos * 100}%`,
                  background: "var(--color-card)",
                  borderColor: accentDeep,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
