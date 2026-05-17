import { create } from "zustand";

import { loadPresets, newPreset, savePresets } from "../lib/presets";
import {
  defaultSliders,
  type MediaType,
  type Preset,
  type SearchHit,
  type Sliders,
} from "../lib/schemas";

export type AppState = {
  inputType: MediaType;
  outputType: MediaType;
  seed: SearchHit | null;
  sliders: Sliders;
  presets: Preset[];
  /** Pretty names for artist filter chips. Decorative — backend takes ids only. */
  artistNames: Record<string, string>;

  setInputType: (t: MediaType) => void;
  setOutputType: (t: MediaType) => void;
  setSeed: (hit: SearchHit | null) => void;
  setSlider: <K extends keyof Sliders>(key: K, value: Sliders[K]) => void;
  resetSliders: () => void;
  applyPreset: (presetId: string) => void;
  saveCurrentAsPreset: (name: string) => void;
  deletePreset: (presetId: string) => void;
  setPresets: (presets: Preset[]) => void;
  rememberArtistName: (id: string, name: string) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  inputType: "song",
  outputType: "song",
  seed: null,
  sliders: defaultSliders(),
  presets: loadPresets(),
  artistNames: {},

  setInputType: (t) => set({ inputType: t, seed: null }),
  setOutputType: (t) => set({ outputType: t }),
  setSeed: (hit) => set({ seed: hit }),
  setSlider: (key, value) => set((s) => ({ sliders: { ...s.sliders, [key]: value } })),
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
}));
