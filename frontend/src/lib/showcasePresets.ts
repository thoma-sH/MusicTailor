import type { MediaType, Sliders } from "./schemas";

export type ShowcasePreset = {
  id: string;
  name: string;
  subtitle: string;
  sliders: Sliders;
  demo: {
    seedId: string;
    seedName: string;
    seedImage: string;
    inputType: MediaType;
    outputType: MediaType;
  };
};

function img(seed: string, color: string): string {
  return `https://placehold.co/400x400/${color}/3a2b5c?text=${encodeURIComponent(seed)}&font=playfair`;
}

const baseSliders: Sliders = {
  popularity_bias: 0,
  diversity: 0.5,
  discovery_radius: 0.7,
  era_bias: 0,
  tags_include: [],
  tags_exclude: [],
  artists_include: [],
  artists_exclude: [],
  seed_weight_curve: "linear",
};

export const SHOWCASE_PRESETS: ShowcasePreset[] = [
  {
    id: "familiar-adventurous",
    name: "Familiar, adventurous",
    subtitle: "well-known names, just off the obvious path",
    sliders: { ...baseSliders, popularity_bias: 0.3, discovery_radius: 0.55, diversity: 0.55 },
    demo: {
      seedId: "a-radiohead",
      seedName: "Radiohead",
      seedImage: img("Radiohead", "e8b6c9"),
      inputType: "artist",
      outputType: "song",
    },
  },
  {
    id: "pure-underground",
    name: "Pure underground",
    subtitle: "the smaller, the better",
    sliders: {
      ...baseSliders,
      popularity_bias: -0.7,
      discovery_radius: 0.92,
      diversity: 0.7,
    },
    demo: {
      seedId: "a-tycho",
      seedName: "Tycho",
      seedImage: img("Tycho", "9fd6c5"),
      inputType: "artist",
      outputType: "song",
    },
  },
  {
    id: "tonal-twins",
    name: "Tonal twins",
    subtitle: "as close to the source as you can get",
    sliders: {
      ...baseSliders,
      discovery_radius: 0.18,
      diversity: 0.1,
      popularity_bias: 0,
    },
    demo: {
      seedId: "a-bonobo",
      seedName: "Bonobo",
      seedImage: img("Bonobo", "9fd6c5"),
      inputType: "artist",
      outputType: "song",
    },
  },
  {
    id: "decade-rewind",
    name: "Decade rewind",
    subtitle: "lean into older releases",
    sliders: {
      ...baseSliders,
      era_bias: -0.65,
      discovery_radius: 0.65,
      diversity: 0.6,
      popularity_bias: 0.1,
    },
    demo: {
      seedId: "a-arcade",
      seedName: "Arcade Fire",
      seedImage: img("Arcade+Fire", "c9b6e8"),
      inputType: "artist",
      outputType: "song",
    },
  },
];
