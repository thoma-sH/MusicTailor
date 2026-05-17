import { useId } from "react";

import type { MediaType } from "../lib/schemas";
import { TYPE_ACCENT } from "../lib/typeColors";

type Props = {
  label: string;
  hint?: string;
  /** Axis labels rendered under the slider — e.g. ["Underground", "Popular"] */
  axisLabels?: [string, string];
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  accent: MediaType;
  formatValue?: (v: number) => string;
};

export function Dial({
  label,
  hint,
  axisLabels,
  value,
  min,
  max,
  step = 0.05,
  onChange,
  accent,
  formatValue,
}: Props) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  const accentDeep = TYPE_ACCENT[accent].deep;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          className="font-display text-sm font-medium tracking-tight text-[color:var(--color-foreground)]"
        >
          {label}
        </label>
        <span
          className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-2 py-0.5 font-mono text-[10px] tabular-nums text-[color:var(--color-foreground)]/80"
          style={{ borderColor: `color-mix(in oklch, ${accentDeep} 25%, var(--color-border))` }}
        >
          {formatValue ? formatValue(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="dial"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        style={
          {
            "--fill": `${pct}%`,
            "--accent": accentDeep,
          } as React.CSSProperties
        }
      />
      {axisLabels && (
        <div className="flex justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]/80">
          <span>{axisLabels[0]}</span>
          <span>{axisLabels[1]}</span>
        </div>
      )}
      {hint && (
        <p className="text-[11px] leading-snug text-[color:var(--color-muted-foreground)]/80">
          {hint}
        </p>
      )}
    </div>
  );
}
