import { useId } from "react";

import type { MediaType } from "../lib/schemas";
import { TYPE_ACCENT } from "../lib/typeColors";

type Props = {
  label: string;
  hint?: string;
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
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          className="text-xs font-medium uppercase tracking-wider text-[color:var(--color-muted-foreground)]"
        >
          {label}
        </label>
        <span className="font-mono text-xs text-[color:var(--color-foreground)]/80 tabular-nums">
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
            "--accent": TYPE_ACCENT[accent].deep,
          } as React.CSSProperties
        }
      />
      {hint && <p className="text-xs text-[color:var(--color-muted-foreground)]/80">{hint}</p>}
    </div>
  );
}
