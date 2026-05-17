import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { search } from "../lib/api";
import type { MediaType, SearchHit } from "../lib/schemas";
import { TYPE_ACCENT, TYPE_LABEL } from "../lib/typeColors";
import { cn } from "../lib/utils";

type Props = {
  inputType: MediaType;
  selected: SearchHit | null;
  onSelect: (hit: SearchHit | null) => void;
};

const PLACEHOLDERS: Record<MediaType, string> = {
  song: "Search a song… try 'No Surprises'",
  album: "Search an album…",
  artist: "Search an artist… try 'Mitski'",
  playlist: "Pick a playlist… try 'Deep Focus'",
};

export function SeedInput({ inputType, selected, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset query + selection when the input type switches. `onSelect` is
  // intentionally excluded — parent re-creates it each render, which would
  // otherwise loop. Type-switch is the only valid trigger here.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    setQ("");
    onSelect(null);
  }, [inputType]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["search", inputType, q],
    queryFn: ({ signal }) => search(inputType, q, signal),
    // For playlist type we want the curated list even with empty query.
    enabled: open && (inputType === "playlist" || q.length > 0),
    staleTime: 30_000,
  });

  const hits = data?.hits ?? [];
  const accent = TYPE_ACCENT[inputType];

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-5 py-4 shadow-sm transition focus-within:border-[color:var(--color-ring)] focus-within:shadow-md"
        style={{ boxShadow: `0 1px 0 0 ${accent.soft} inset` }}
      >
        {selected?.image ? (
          <img src={selected.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
        ) : (
          <div
            aria-hidden
            className="h-10 w-10 shrink-0 rounded-lg"
            style={{ background: accent.soft }}
          />
        )}
        <div className="min-w-0 flex-1">
          {selected ? (
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setQ("");
                setOpen(true);
                queueMicrotask(() => inputRef.current?.focus());
              }}
              className="block w-full truncate text-left"
              aria-label="Clear selection"
            >
              <div className="truncate text-base font-medium leading-tight">{selected.name}</div>
              {selected.artist && (
                <div className="truncate text-sm text-[color:var(--color-muted-foreground)]">
                  {selected.artist}
                </div>
              )}
            </button>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={q}
              placeholder={PLACEHOLDERS[inputType]}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              className="w-full bg-transparent text-base outline-none placeholder:text-[color:var(--color-muted-foreground)]"
              aria-label={`Search ${TYPE_LABEL[inputType]}`}
            />
          )}
        </div>
        <div className="hidden text-xs uppercase tracking-widest text-[color:var(--color-muted-foreground)] sm:block">
          {TYPE_LABEL[inputType]}
        </div>
      </div>

      <AnimatePresence>
        {open && !selected && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="absolute z-30 mt-2 max-h-[60vh] w-full overflow-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-lg"
          >
            {isFetching && hits.length === 0 && (
              <div className="px-5 py-4 text-sm text-[color:var(--color-muted-foreground)]">
                Searching…
              </div>
            )}
            {!isFetching && hits.length === 0 && (q || inputType === "playlist") && (
              <div className="px-5 py-4 text-sm text-[color:var(--color-muted-foreground)]">
                No matches. The demo dataset is small — try "Radiohead", "Tycho", or "Frank Ocean".
              </div>
            )}
            <ul>
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(hit);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors",
                      "hover:bg-[color:var(--color-muted)]",
                    )}
                  >
                    <img
                      src={hit.image}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{hit.name}</div>
                      {hit.artist && (
                        <div className="truncate text-xs text-[color:var(--color-muted-foreground)]">
                          {hit.artist}
                        </div>
                      )}
                    </div>
                    {hit.popularity > 0 && (
                      <div className="hidden text-[10px] uppercase tracking-widest text-[color:var(--color-muted-foreground)] sm:block">
                        {hit.popularity}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
