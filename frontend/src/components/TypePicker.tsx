import { motion } from "motion/react";
import type { MediaType } from "../lib/schemas";
import { TYPE_ACCENT, TYPE_ICON, TYPE_LABEL } from "../lib/typeColors";
import { cn } from "../lib/utils";

type Props = {
  value: MediaType;
  onChange: (t: MediaType) => void;
  /** Unique layout id to keep input vs output pickers' animations separate. */
  scope: string;
};

const TYPES: MediaType[] = ["song", "album", "artist", "playlist"];

export function TypePicker({ value, onChange, scope }: Props) {
  return (
    <div
      role="toolbar"
      aria-label="Select media type"
      className="inline-flex flex-wrap items-center gap-1 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)]/70 p-1 shadow-sm backdrop-blur"
    >
      {TYPES.map((t) => {
        const selected = t === value;
        const accent = TYPE_ACCENT[t];
        return (
          <button
            key={t}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(t)}
            className={cn(
              "relative isolate rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              selected
                ? "text-[color:var(--color-foreground)]"
                : "text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]",
            )}
            style={{ minHeight: 36, minWidth: 64 }}
          >
            {selected && (
              <motion.span
                layoutId={`type-pill-${scope}`}
                className="absolute inset-0 -z-10 rounded-full"
                style={{ background: accent.soft, opacity: 0.7 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
            <span aria-hidden className="mr-1.5 text-[color:var(--color-foreground)]/60">
              {TYPE_ICON[t]}
            </span>
            {TYPE_LABEL[t]}
          </button>
        );
      })}
    </div>
  );
}
