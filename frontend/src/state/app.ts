import { create } from "zustand";

import { loadPresets, newPreset, savePresets } from "../lib/presets";
import {
  defaultSliders,
  type MediaType,
  type Preset,
  type SearchHit,
  type Sliders,
} from "../lib/schemas";

export type Theme = "light" | "dark";

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("musictailor:theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export type AppState = {
  inputType: MediaType;
  outputType: MediaType;
  seed: SearchHit | null;
  sliders: Sliders;
  presets: Preset[];
  /** Pretty names for artist filter chips. Decorative — backend takes ids only. */
  artistNames: Record<string, string>;
  theme: Theme;

  setInputType: (t: MediaType) => void;
  setOutputType: (t: MediaType) => void;
  setSeed: (hit: SearchHit | null) => void;
  setSlider: <K extends keyof Sliders>(key: K, value: Sliders[K]) => void;
  setSliders: (sliders: Sliders) => void;
  resetSliders: () => void;
  applyPreset: (presetId: string) => void;
  saveCurrentAsPreset: (name: string) => void;
  deletePreset: (presetId: string) => void;
  setPresets: (presets: Preset[]) => void;
  rememberArtistName: (id: string, name: string) => void;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  inputType: "song",
  outputType: "song",
  seed: null,
  sliders: defaultSliders(),
  presets: loadPresets(),
  artistNames: {},
  theme: initialTheme(),

  setInputType: (t) => set({ inputType: t, seed: null }),
  setOutputType: (t) => set({ outputType: t }),
  setSeed: (hit) => set({ seed: hit }),
  setSlider: (key, value) => set((s) => ({ sliders: { ...s.sliders, [key]: value } })),
  setSliders: (sliders) => set({ sliders }),
  resetSliders: () => set({ sliders: defaultSliders() }),

  applyPreset: (presetId) => {
    const preset = get().presets.find((p) => p.id === presetId);
    if (preset) set({ sliders: preset.sliders });
  },

  saveCurrentAsPreset: (name) => {
    const preset = newPreset(name, get().sliders);
    const next = [preset, ...get().presets];
    savePresets(next);
    set({ presets: next });
  },

  deletePreset: (presetId) => {
    const next = get().presets.filter((p) => p.id !== presetId);
    savePresets(next);
    set({ presets: next });
  },

  setPresets: (presets) => {
    savePresets(presets);
    set({ presets });
  },

  rememberArtistName: (id, name) => set((s) => ({ artistNames: { ...s.artistNames, [id]: name } })),

  setTheme: (theme) => {
    try {
      window.localStorage.setItem("musictailor:theme", theme);
    } catch {
      // Storage unavailable; theme still updates in memory.
    }
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    get().setTheme(next);
  },
}));
