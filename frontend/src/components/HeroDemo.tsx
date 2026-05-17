import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { recommend } from "../lib/api";
import type { MediaType, RecommendItem, RecommendRequest } from "../lib/schemas";
import { TYPE_ACCENT, TYPE_LABEL, TYPE_LABEL_PLURAL } from "../lib/typeColors";

type DemoConfig = {
  label: string;
  seedId: string;
  seedName: string;
  seedImage: string;
  inputType: MediaType;
  outputType: MediaType;
};

const CYCLE: DemoConfig[] = [
  {
    label: "alternative classics",
    seedId: "a-radiohead",
    seedName: "Radiohead",
    seedImage: "https://placehold.co/400x400/e8b6c9/3a2b5c?text=Radiohead&font=playfair",
    inputType: "artist",
    outputType: "song",
  },
  {
    label: "downtempo electronic",
    seedId: "a-bonobo",
    seedName: "Bonobo",
    seedImage: "https://placehold.co/400x400/9fd6c5/3a2b5c?text=Bonobo&font=playfair",
    inputType: "artist",
    outputType: "playlist",
  },
  {
    label: "indie pop, intimate",
    seedId: "t-aurora-1",
    seedName: "Runaway",
    seedImage: "https://placehold.co/400x400/c9b6e8/3a2b5c?text=Runaway&font=playfair",
    inputType: "song",
    outputType: "album",
  },
  {
    label: "R&B, after-hours",
    seedId: "a-frank",
    seedName: "Frank Ocean",
    seedImage: "https://placehold.co/400x400/f4c4a3/3a2b5c?text=Frank+Ocean&font=playfair",
    inputType: "artist",
    outputType: "artist",
  },
];

const CYCLE_MS = 6500;

export function HeroDemo() {
  const [idx, setIdx] = useState(0);
  const current = CYCLE[idx];

  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % CYCLE.length);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, []);

  const req: RecommendRequest = {
    seed: { input_type: current.inputType, id: current.seedId },
    output_type: current.outputType,
    sliders: {
      popularity_bias: 0,
      diversity: 0.5,
      discovery_radius: 0.7,
      era_bias: 0,
      tags_include: [],
      tags_exclude: [],
      artists_include: [],
      artists_exclude: [],
      seed_weight_curve: "linear",
    },
    k: 4,
  };

  const { data } = useQuery({
    queryKey: ["hero-demo", current.seedId, current.outputType],
    queryFn: ({ signal }) => recommend(req, signal),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const items = data?.items ?? [];
  const inputAccent = TYPE_ACCENT[current.inputType];
  const outputAccent = TYPE_ACCENT[current.outputType];

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[2.5rem] opacity-60 blur-3xl"
        style={{
          background: `radial-gradient(60% 50% at 30% 30%, ${inputAccent.soft} 0%, transparent 70%), radial-gradient(50% 60% at 80% 80%, ${outputAccent.soft} 0%, transparent 75%)`,
        }}
      />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-[color:var(--color-border)] bg-[color:var(--color-card)]/85 p-5 shadow-[0_30px_80px_-30px_rgba(40,20,80,0.25),0_8px_24px_-12px_rgba(40,20,80,0.12)] backdrop-blur-xl md:p-6">
        <DemoChrome label={current.label} idx={idx} count={CYCLE.length} />

        <AnimatePresence mode="wait">
          <motion.div
            key={`${current.seedId}->${current.outputType}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.4, ease: [0.2, 0.7, 0.3, 1] }}
            className="mt-4 space-y-3"
          >
            <SeedRow image={current.seedImage} name={current.seedName} type={current.inputType} />
            <Arrow outputType={current.outputType} />
            <ResultStack items={items} outputType={current.outputType} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function DemoChrome({ label, idx, count }: { label: string; idx: number; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="relative inline-flex h-2 w-2 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--color-mint-deep)] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--color-mint-deep)]" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]">
          live · {label}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {Array.from({ length: count }, (_, i) => i).map((i) => (
          <span
            key={`dot-${i}`}
            className={`h-1 rounded-full transition-all ${
              i === idx
                ? "w-6 bg-[color:var(--color-foreground)]/60"
                : "w-1.5 bg-[color:var(--color-border)]"
            }`}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

function SeedRow({ image, name, type }: { image: string; name: string; type: MediaType }) {
  const accent = TYPE_ACCENT[type];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-3">
      <img src={image} alt="" className="h-14 w-14 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: accent.deep }}
        >
          seed · {TYPE_LABEL[type]}
        </div>
        <div className="truncate font-display text-lg leading-tight">{name}</div>
      </div>
    </div>
  );
}

function Arrow({ outputType }: { outputType: MediaType }) {
  const accent = TYPE_ACCENT[outputType];
  return (
    <div className="flex items-center gap-3 pl-3">
      <div
        className="h-8 w-px"
        style={{
          background: `linear-gradient(to bottom, transparent, ${accent.deep}, transparent)`,
        }}
      />
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]">
        → showing {TYPE_LABEL_PLURAL[outputType]}
      </div>
    </div>
  );
}

function ResultStack({ items, outputType }: { items: RecommendItem[]; outputType: MediaType }) {
  const accent = TYPE_ACCENT[outputType];
  return (
    <div className="space-y-2">
      {items.length === 0 &&
        Array.from({ length: 3 }, (_, i) => i).map((i) => <ResultSkeleton key={`skel-${i}`} />)}
      {items.slice(0, 3).map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
          className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-2.5"
        >
          <div
            className="h-10 w-10 shrink-0 overflow-hidden rounded-lg"
            style={{ background: accent.soft }}
          >
            {item.image && <img src={item.image} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{item.name}</div>
            <div className="truncate text-xs text-[color:var(--color-muted-foreground)]">
              {item.artist_name || item.why}
            </div>
          </div>
          <div className="hidden font-mono text-[10px] tabular-nums text-[color:var(--color-muted-foreground)] sm:block">
            {item.popularity.toString().padStart(2, "0")}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-2.5">
      <div className="h-10 w-10 shrink-0 rounded-lg bg-[color:var(--color-muted)]" />
      <div className="flex-1 space-y-1">
        <div className="h-3 w-1/2 rounded bg-[color:var(--color-muted)]" />
        <div className="h-2 w-1/3 rounded bg-[color:var(--color-muted)]" />
      </div>
    </div>
  );
}
