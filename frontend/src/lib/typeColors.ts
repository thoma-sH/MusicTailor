import type { MediaType } from "./schemas";

export const TYPE_ACCENT: Record<MediaType, { soft: string; deep: string; name: string }> = {
  song: {
    soft: "var(--color-lavender)",
    deep: "var(--color-lavender-deep)",
    name: "lavender",
  },
  album: {
    soft: "var(--color-mint)",
    deep: "var(--color-mint-deep)",
    name: "mint",
  },
  artist: {
    soft: "var(--color-peach)",
    deep: "var(--color-peach-deep)",
    name: "peach",
  },
  playlist: {
    soft: "var(--color-sky)",
    deep: "var(--color-sky-deep)",
    name: "sky",
  },
};

export const TYPE_LABEL: Record<MediaType, string> = {
  song: "song",
  album: "album",
  artist: "artist",
  playlist: "playlist",
};

export const TYPE_LABEL_PLURAL: Record<MediaType, string> = {
  song: "songs",
  album: "albums",
  artist: "artists",
  playlist: "a playlist",
};

export const TYPE_ICON: Record<MediaType, string> = {
  song: "♪",
  album: "◉",
  artist: "✦",
  playlist: "≡",
};
