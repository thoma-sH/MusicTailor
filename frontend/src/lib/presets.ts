import { type Preset, presetSchema, type Sliders } from "./schemas";

const STORAGE_KEY = "musictailor:presets:v1";

export function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Preset[] = [];
    for (const p of parsed) {
      const res = presetSchema.safeParse(p);
      if (res.success) out.push(res.data);
    }
    return out;
  } catch {
    return [];
  }
}

export function savePresets(presets: Preset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // localStorage may be unavailable (Safari private mode, quota exceeded).
    // Silently no-op — the in-memory state in zustand still works.
  }
}

export function newPreset(name: string, sliders: Sliders): Preset {
  return {
    id: cryptoId(),
    name,
    sliders,
    created_at: Date.now(),
  };
}

export function exportJson(presets: Preset[]): string {
  return JSON.stringify(presets, null, 2);
}

export function importJson(blob: string): Preset[] {
  try {
    const parsed = JSON.parse(blob);
    if (!Array.isArray(parsed)) return [];
    const out: Preset[] = [];
    for (const p of parsed) {
      const res = presetSchema.safeParse(p);
      if (res.success) out.push(res.data);
    }
    return out;
  } catch {
    return [];
  }
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}
