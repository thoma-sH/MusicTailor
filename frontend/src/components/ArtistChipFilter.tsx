import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { search } from "../lib/api";
import type { SearchHit } from "../lib/schemas";
import { cn } from "../lib/utils";

export type ArtistFilterMode = "any" | "include" | "exclude";

type Props = {
  /** Map of artist id → display name (so chips can render names). */
  artists: { id: string; name: string }[];
  mode: ArtistFilterMode;
  onChange: (
    next: { ids: string[]; names: Record<string, string> },
    mode: ArtistFilterMode,
  ) => void;
};

export function ArtistChipFilter({ artists, mode, onChange }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const { data } = useQuery({
    queryKey: ["search", "artist", q],
    queryFn: ({ signal }) => search("artist", q, signal),
    enabled: open && q.length > 0,
    staleTime: 30_000,
  });

  function add(hit: SearchHit) {
    if (artists.some((a) => a.id === hit.id)) return;
    const nextArtists = [...artists, { id: hit.id, name: hit.name }];
    const names: Record<string, string> = {};
    for (const a of nextArtists) names[a.id] = a.name;
    onChange({ ids: nextArtists.map((a) => a.id), names }, mode === "any" ? "include" : mode);
    setQ("");
  }

  function remove(id: string) {
    const nextArtists = artists.filter((a) => a.id !== id);
    const names: Record<string, string> = {};
    for (const a of nextArtists) names[a.id] = a.name;
    onChange({ ids: nextArtists.map((a) => a.id), names }, nextArtists.length === 0 ? "any" : mode);
  }

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-[color:var(--color-muted-foreground)]">
          Artist filter
        </span>
        <ModeSwitch
          mode={mode}
          disabled={artists.length === 0}
          onChange={(m) => onChange({ ids: artists.map((a) => a.id), names: namesOf(artists) }, m)}
        />
      </div>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-2 py-2",
          mode === "include" && "border-[color:var(--color-mint-deep)]/40",
          mode === "exclude" && "border-[color:var(--color-peach-deep)]/40",
        )}
      >
        {artists.map((a) => (
          <button
            type="button"
            key={a.id}
            onClick={() => remove(a.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition",
              mode === "exclude"
                ? "bg-[color:var(--color-peach)]/60 text-[color:var(--color-foreground)] hover:bg-[color:var(--color-peach)]"
                : "bg-[color:var(--color-mint)]/60 text-[color:var(--color-foreground)] hover:bg-[color:var(--color-mint)]",
            )}
            aria-label={`Remove ${a.name}`}
          >
            <span>{a.name}</span>
            <span aria-hidden className="opacity-60">
              ×
            </span>
          </button>
        ))}
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={
            mode === "exclude" ? "Type to add an artist to exclude…" : "Type to add an artist…"
          }
          className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-[color:var(--color-muted-foreground)]"
          aria-label="Search an artist to filter"
        />
      </div>
      <AnimatePresence>
        {open && q.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.15 }}
            className="max-h-[40vh] overflow-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-md"
          >
            {(data?.hits ?? []).map((hit) => (
              <button
                type="button"
                key={hit.id}
                onClick={() => add(hit)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[color:var(--color-muted)]"
              >
                <img src={hit.image} alt="" className="h-8 w-8 rounded object-cover" />
                <span>{hit.name}</span>
              </button>
            ))}
            {data?.hits.length === 0 && (
              <div className="px-3 py-2 text-xs text-[color:var(--color-muted-foreground)]">
                No matches.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function namesOf(arr: { id: string; name: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of arr) out[a.id] = a.name;
  return out;
}

function ModeSwitch({
  mode,
  disabled,
  onChange,
}: {
  mode: ArtistFilterMode;
  disabled: boolean;
  onChange: (m: ArtistFilterMode) => void;
}) {
  const options: { v: ArtistFilterMode; label: string }[] = [
    { v: "include", label: "must include" },
    { v: "any", label: "no bias" },
    { v: "exclude", label: "must exclude" },
  ];
  return (
    <div
      role="toolbar"
      aria-label="Artist filter mode"
      className="inline-flex rounded-full border border-[color:var(--color-border)] p-0.5 text-[10px] uppercase tracking-wider"
    >
      {options.map((o) => {
        const active = o.v === mode;
        return (
          <button
            type="button"
            key={o.v}
            aria-pressed={active}
            disabled={disabled && o.v !== "any"}
            onClick={() => onChange(o.v)}
            className={cn(
              "rounded-full px-2 py-1 transition disabled:opacity-40",
              active
                ? "bg-[color:var(--color-foreground)] text-[color:var(--color-background)]"
                : "text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
