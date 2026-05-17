import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import type { MediaType, Sliders } from "../lib/schemas";
import { TYPE_ACCENT } from "../lib/typeColors";
import { useAppStore } from "../state/app";

type Props = {
  sliders: Sliders;
  accent: MediaType;
};

type Axis = {
  key: keyof Sliders;
  label: string;
  angle: number;
  /** Map raw slider value to 0..1 for radial position. */
  normalize: (v: number) => number;
  /** Map 0..1 radial position back to slider's native range. */
  denormalize: (n: number) => number;
  /** Quantize step (matches dial step). */
  step: number;
};

const AXES: Axis[] = [
  {
    key: "popularity_bias",
    label: "popularity",
    angle: 0,
    normalize: (v) => (v + 1) / 2,
    denormalize: (n) => n * 2 - 1,
    step: 0.05,
  },
  {
    key: "era_bias",
    label: "era",
    angle: 90,
    normalize: (v) => (v + 1) / 2,
    denormalize: (n) => n * 2 - 1,
    step: 0.05,
  },
  {
    key: "diversity",
    label: "diversity",
    angle: 180,
    normalize: (v) => v,
    denormalize: (n) => n,
    step: 0.05,
  },
  {
    key: "discovery_radius",
    label: "discovery",
    angle: 270,
    normalize: (v) => v,
    denormalize: (n) => n,
    step: 0.05,
  },
];

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = SIZE * 0.36;
const RINGS = [0.33, 0.66, 1];

function point(angleDeg: number, r: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [CENTER + Math.cos(a) * RADIUS * r, CENTER + Math.sin(a) * RADIUS * r];
}

function ringPath(r: number): string {
  return AXES.map((ax, i) => {
    const [x, y] = point(ax.angle, r);
    return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  })
    .concat("Z")
    .join(" ");
}

function quantize(n: number, step: number): number {
  return Math.round(n / step) * step;
}

export function SliderRadar({ sliders, accent }: Props) {
  const setSlider = useAppStore((s) => s.setSlider);
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const c = TYPE_ACCENT[accent];

  const values = AXES.map((ax) => {
    const raw = sliders[ax.key] as number;
    const norm = Math.max(0, Math.min(1, ax.normalize(raw)));
    return { axis: ax, value: norm };
  });

  const shape = values
    .map(({ axis, value }, i) => {
      const [x, y] = point(axis.angle, value);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .concat("Z")
    .join(" ");

  useEffect(() => {
    if (activeIdx === null) return;

    function clientToSvg(clientX: number, clientY: number): { x: number; y: number } | null {
      const svg = svgRef.current;
      if (!svg) return null;
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const local = pt.matrixTransform(ctm.inverse());
      return { x: local.x, y: local.y };
    }

    function onMove(e: PointerEvent) {
      if (activeIdx === null) return;
      const local = clientToSvg(e.clientX, e.clientY);
      if (!local) return;
      const axis = AXES[activeIdx];
      const angleRad = ((axis.angle - 90) * Math.PI) / 180;
      const ax = Math.cos(angleRad);
      const ay = Math.sin(angleRad);
      const dx = local.x - CENTER;
      const dy = local.y - CENTER;
      const proj = (dx * ax + dy * ay) / RADIUS;
      const normalized = Math.max(0, Math.min(1, proj));
      const denorm = axis.denormalize(normalized);
      const quant = quantize(denorm, axis.step);
      setSlider(axis.key, quant);
    }

    function onUp() {
      setActiveIdx(null);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [activeIdx, setSlider]);

  function startDrag(i: number, e: React.PointerEvent<SVGElement>) {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setActiveIdx(i);
  }

  function bumpValue(i: number, dir: 1 | -1) {
    const axis = AXES[i];
    const current = sliders[axis.key] as number;
    const next = quantize(current + dir * axis.step, axis.step);
    const min = axis.key === "popularity_bias" || axis.key === "era_bias" ? -1 : 0;
    setSlider(axis.key, Math.max(min, Math.min(1, next)));
  }

  return (
    <div className="relative mx-auto w-full max-w-[260px] select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="block h-auto w-full touch-none"
        aria-label="Adjustable algorithm radar"
      >
        <title>Algorithm shape — drag a vertex to adjust</title>
        {RINGS.map((r) => (
          <path
            key={r}
            d={ringPath(r)}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={1}
            opacity={r === 1 ? 0.55 : 0.3}
          />
        ))}
        {AXES.map((ax) => {
          const [x, y] = point(ax.angle, 1);
          return (
            <line
              key={ax.key}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth={1}
              opacity={0.35}
            />
          );
        })}

        <motion.path
          d={shape}
          fill={c.soft}
          fillOpacity={0.55}
          stroke={c.deep}
          strokeWidth={1.5}
          strokeLinejoin="round"
          initial={false}
          animate={{ d: shape }}
          transition={{ type: "spring", stiffness: 240, damping: 30 }}
        />

        {values.map(({ axis, value }, i) => {
          const [x, y] = point(axis.angle, value);
          const isActive = activeIdx === i;
          const isHover = hoverIdx === i;
          const r = isActive ? 7 : isHover ? 5.5 : 4;
          return (
            <g key={axis.key}>
              <motion.circle
                cx={x}
                cy={y}
                r={r}
                fill="var(--color-card)"
                stroke={c.deep}
                strokeWidth={isActive ? 2.2 : 1.8}
                initial={false}
                animate={{ cx: x, cy: y, r }}
                transition={
                  isActive ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 30 }
                }
              />
              <circle
                cx={x}
                cy={y}
                r={14}
                fill="transparent"
                style={{ cursor: isActive ? "grabbing" : "grab", touchAction: "none" }}
                onPointerDown={(e) => startDrag(i, e)}
                onPointerEnter={() => setHoverIdx(i)}
                onPointerLeave={() => setHoverIdx(null)}
                tabIndex={0}
                role="slider"
                aria-label={`${axis.label} value`}
                aria-valuemin={axis.key === "popularity_bias" || axis.key === "era_bias" ? -1 : 0}
                aria-valuemax={1}
                aria-valuenow={Number((sliders[axis.key] as number).toFixed(2))}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                    e.preventDefault();
                    bumpValue(i, 1);
                  } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                    e.preventDefault();
                    bumpValue(i, -1);
                  }
                }}
              />
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0">
        {AXES.map((ax) => {
          const [x, y] = point(ax.angle, 1.18);
          return (
            <span
              key={ax.key}
              className="absolute -translate-x-1/2 -translate-y-1/2 font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]"
              style={{ left: `${(x / SIZE) * 100}%`, top: `${(y / SIZE) * 100}%` }}
            >
              {ax.label}
            </span>
          );
        })}
      </div>

      <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]/80">
        drag a vertex · or arrow keys when focused
      </p>
    </div>
  );
}
