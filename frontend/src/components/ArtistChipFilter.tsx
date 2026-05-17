import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { search } from "../lib/api";
import type { SearchHit } from "../lib/schemas";
import { cn } from "../lib/utils";

export type ArtistChipMode = "include" | "exclude";

export type ArtistChip = {
  id: string;
  name: string;
  mode: ArtistChipMode;
};

type Props = {
  artists: ArtistChip[];
  onChange: (next: ArtistChip[]) => void;
};

export function ArtistChipFilter({ artists, onChange }: Props) {
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
    onChange([...artists, { id: hit.id, name: hit.name, mode: "include" }]);
    setQ("");
  }

  function toggleMode(id: string) {
    onChange(
      artists.map((a) =>
        a.id === id ? { ...a, mode: a.mode === "include" ? "exclude" : "include" } : a,
      ),
    );
  }

  function remove(id: string) {
    onChange(artists.filter((a) => a.id !== id));
  }

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-[color:var(--color-muted-foreground)]">
          Artist filter
        </span>
        {artists.length > 0 && (
          <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted-foreground)]">
            tap chip to flip include / exclude
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-2 py-2">
        {artists.map((a) => (
          <span
            key={a.id}
            className={cn(
              "inline-flex items-center gap-1 rounded-full pl-2.5 pr-1 py-1 text-xs font-medium transition",
              a.mode === "include"
                ? "bg-[color:var(--color-mint)]/60 text-[color:var(--color-foreground)]"
                : "bg-[color:var(--color-peach)]/60 text-[color:var(--color-foreground)] line-through decoration-1",
            )}
          >
            <button
              type="button"
              onClick={() => toggleMode(a.id)}
              className="flex items-center gap-1.5 outline-none"
              aria-label={`${a.name} is ${a.mode === "include" ? "included" : "excluded"}. Click to flip.`}
              aria-pressed={a.mode === "include"}
            >
              <span
                aria-hidden
                className={cn(
                  "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] font-bold no-underline",
                  a.mode === "include"
                    ? "bg-[color:var(--color-mint-deep)]/70 text-[color:var(--color-background)]"
                    : "bg-[color:var(--color-peach-deep)]/70 text-[color:var(--color-background)]",
                )}
              >
                {a.mode === "include" ? "+" : "−"}
              </span>
              <span>{a.name}</span>
            </button>
            <button
              type="button"
              onClick={() => remove(a.id)}
              className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[color:var(--color-muted-foreground)] no-underline hover:bg-[color:var(--color-muted)] hover:text-[color:var(--color-foreground)]"
              aria-label={`Remove ${a.name}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type to add an artist…"
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
