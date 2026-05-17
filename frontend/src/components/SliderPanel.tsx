import { motion } from "motion/react";

import type { MediaType } from "../lib/schemas";
import { useAppStore } from "../state/app";
import { type ArtistChip, ArtistChipFilter } from "./ArtistChipFilter";
import { Dial } from "./Dial";
import { SliderRadar } from "./SliderRadar";

type Props = {
  accent: MediaType;
};

const GENRES = ["indie", "electronic", "rnb", "jazz", "rock", "ambient", "hiphop", "pop"];

export function SliderPanel({ accent }: Props) {
  const sliders = useAppStore((s) => s.sliders);
  const setSlider = useAppStore((s) => s.setSlider);
  const resetSliders = useAppStore((s) => s.resetSliders);
  const presets = useAppStore((s) => s.presets);
  const applyPreset = useAppStore((s) => s.applyPreset);
  const saveCurrentAsPreset = useAppStore((s) => s.saveCurrentAsPreset);

  return (
    <motion.section
      layout
      className="space-y-6 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]/85 p-6 shadow-sm backdrop-blur md:p-7"
      aria-label="Algorithm controls"
    >
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="font-display text-xl">Your algorithm</div>
          <p className="text-xs text-[color:var(--color-muted-foreground)]">
            Drag the dials. Recommendations re-rank live.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const name = window.prompt("Name this preset");
            if (name?.trim()) saveCurrentAsPreset(name.trim());
          }}
          className="rounded-full bg-[color:var(--color-foreground)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-background)] transition hover:opacity-90"
        >
          Save preset
        </button>
      </header>

      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-[color:var(--color-muted-foreground)]">
            Presets
          </span>
          {presets.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-2.5 py-1 text-xs transition hover:border-[color:var(--color-ring)]"
            >
              {p.name}
            </button>
          ))}
          <button
            type="button"
            onClick={resetSliders}
            className="ml-auto rounded-full px-2.5 py-1 text-xs text-[color:var(--color-muted-foreground)] underline-offset-4 hover:underline"
          >
            Reset
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-[color:var(--color-border)]/60 bg-[color:var(--color-background)]/40 p-4">
        <SliderRadar sliders={sliders} accent={accent} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Dial
          label="Popularity"
          axisLabels={["underground", "popular"]}
          hint="Push toward smaller artists, or chart hits."
          accent={accent}
          min={-1}
          max={1}
          step={0.05}
          value={sliders.popularity_bias}
          onChange={(v) => setSlider("popularity_bias", v)}
          formatValue={(v) => (v === 0 ? "neutral" : v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
        />
        <Dial
          label="Era"
          axisLabels={["older", "newer"]}
          hint="Bias toward older or newer releases."
          accent={accent}
          min={-1}
          max={1}
          step={0.05}
          value={sliders.era_bias}
          onChange={(v) => setSlider("era_bias", v)}
          formatValue={(v) => (v === 0 ? "neutral" : v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
        />
        <Dial
          label="Diversity"
          axisLabels={["tight", "scattered"]}
          hint="How many different artists to mix in."
          accent={accent}
          min={0}
          max={1}
          step={0.05}
          value={sliders.diversity}
          onChange={(v) => setSlider("diversity", v)}
        />
        <Dial
          label="Discovery"
          axisLabels={["close", "wide"]}
          hint="How far from the seed to explore."
          accent={accent}
          min={0}
          max={1}
          step={0.05}
          value={sliders.discovery_radius}
          onChange={(v) => setSlider("discovery_radius", v)}
        />
      </div>

      <TagChips
        included={sliders.tags_include}
        excluded={sliders.tags_exclude}
        onChange={(inc, exc) => {
          setSlider("tags_include", inc);
          setSlider("tags_exclude", exc);
        }}
      />

      <ArtistFilterSection accent={accent} />
    </motion.section>
  );
}

function ArtistFilterSection({ accent: _accent }: { accent: MediaType }) {
  const sliders = useAppStore((s) => s.sliders);
  const setSlider = useAppStore((s) => s.setSlider);
  const artistNames = useAppStore((s) => s.artistNames);
  const rememberArtistName = useAppStore((s) => s.rememberArtistName);

  const artists: ArtistChip[] = [
    ...sliders.artists_include.map((id) => ({
      id,
      name: artistNames[id] ?? prettify(id),
      mode: "include" as const,
    })),
    ...sliders.artists_exclude.map((id) => ({
      id,
      name: artistNames[id] ?? prettify(id),
      mode: "exclude" as const,
    })),
  ];

  return (
    <ArtistChipFilter
      artists={artists}
      onChange={(next) => {
        for (const a of next) rememberArtistName(a.id, a.name);
        setSlider(
          "artists_include",
          next.filter((a) => a.mode === "include").map((a) => a.id),
        );
        setSlider(
          "artists_exclude",
          next.filter((a) => a.mode === "exclude").map((a) => a.id),
        );
      }}
    />
  );
}

function prettify(id: string): string {
  return id
    .replace(/^a-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function TagChips({
  included,
  excluded,
  onChange,
}: {
  included: string[];
  excluded: string[];
  onChange: (inc: string[], exc: string[]) => void;
}) {
  function toggle(tag: string) {
    if (included.includes(tag)) {
      // include → exclude
      onChange(
        included.filter((t) => t !== tag),
        [...excluded.filter((t) => t !== tag), tag],
      );
    } else if (excluded.includes(tag)) {
      // exclude → off
      onChange(
        included,
        excluded.filter((t) => t !== tag),
      );
    } else {
      // off → include
      onChange([...included, tag], excluded);
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium uppercase tracking-wider text-[color:var(--color-muted-foreground)]">
        Genres
      </span>
      <div className="flex flex-wrap gap-1.5">
        {GENRES.map((tag) => {
          const inc = included.includes(tag);
          const exc = excluded.includes(tag);
          return (
            <button
              type="button"
              key={tag}
              onClick={() => toggle(tag)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                inc
                  ? "border-[color:var(--color-mint-deep)] bg-[color:var(--color-mint)]/60 text-[color:var(--color-foreground)]"
                  : exc
                    ? "border-[color:var(--color-peach-deep)] bg-[color:var(--color-peach)]/60 text-[color:var(--color-foreground)] line-through"
                    : "border-[color:var(--color-border)] text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
              }`}
              aria-pressed={inc || exc}
              title={inc ? "Click to exclude" : exc ? "Click to clear" : "Click to include"}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
