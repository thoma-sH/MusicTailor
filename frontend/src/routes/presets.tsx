import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useRef } from "react";

import { exportJson, importJson } from "../lib/presets";
import { useAppStore } from "../state/app";

export const Route = createFileRoute("/presets")({
  component: PresetsPage,
});

function PresetsPage() {
  const presets = useAppStore((s) => s.presets);
  const deletePreset = useAppStore((s) => s.deletePreset);
  const setPresets = useAppStore((s) => s.setPresets);
  const fileRef = useRef<HTMLInputElement>(null);

  function download() {
    const blob = new Blob([exportJson(presets)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "musictailor-presets.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const incoming = importJson(String(reader.result ?? ""));
      if (incoming.length === 0) {
        window.alert("No valid presets in that file.");
        return;
      }
      setPresets([...incoming, ...presets]);
    };
    reader.readAsText(file);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:px-10 md:py-16">
      <header className="space-y-2">
        <h1 className="font-display text-4xl tracking-tight">Your presets</h1>
        <p className="text-[color:var(--color-muted-foreground)]">
          Saved algorithm configurations. Apply any of them from the slider panel on the home page.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={download}
          className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-4 py-2 text-sm transition hover:border-[color:var(--color-ring)]"
        >
          Export all as JSON
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-4 py-2 text-sm transition hover:border-[color:var(--color-ring)]"
        >
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-8 space-y-3">
        {presets.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-card)]/40 px-5 py-12 text-center text-sm text-[color:var(--color-muted-foreground)]">
            No presets yet. Tune the sliders on the home page and hit "Save preset".
          </div>
        )}
        {presets.map((p) => (
          <motion.article
            key={p.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-5 py-4"
          >
            <div className="min-w-0 flex-1">
              <div className="text-base font-medium">{p.name}</div>
              <div className="mt-1 flex flex-wrap gap-1 text-[10px] uppercase tracking-widest text-[color:var(--color-muted-foreground)]">
                <Stat label="pop" value={p.sliders.popularity_bias} />
                <Stat label="div" value={p.sliders.diversity} />
                <Stat label="rad" value={p.sliders.discovery_radius} />
                <Stat label="era" value={p.sliders.era_bias} />
                {p.sliders.tags_include.length > 0 && (
                  <span>+ {p.sliders.tags_include.join(", ")}</span>
                )}
                {p.sliders.tags_exclude.length > 0 && (
                  <span>− {p.sliders.tags_exclude.join(", ")}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => deletePreset(p.id)}
              className="rounded-full px-3 py-1.5 text-xs text-[color:var(--color-muted-foreground)] underline-offset-4 hover:text-[color:var(--color-foreground)] hover:underline"
            >
              Delete
            </button>
          </motion.article>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span>
      {label} {value.toFixed(2)}
    </span>
  );
}
