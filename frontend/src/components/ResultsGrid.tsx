import { AnimatePresence, motion } from "motion/react";

import type { MediaType, RecommendItem } from "../lib/schemas";
import { TYPE_ACCENT } from "../lib/typeColors";
import { PreviewButton } from "./PreviewButton";

type Props = {
  items: RecommendItem[];
  outputType: MediaType;
  loading: boolean;
};

export function ResultsGrid({ items, outputType, loading }: Props) {
  if (loading && items.length === 0) {
    return <SkeletonGrid outputType={outputType} />;
  }

  if (items.length === 0) return null;

  if (outputType === "playlist") {
    const pl = items[0];
    if (!pl) return null;
    return <PlaylistResult playlist={pl} />;
  }

  const cols =
    outputType === "artist"
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <motion.ul
      layout
      className={`grid gap-4 ${cols}`}
      role="list"
      aria-label={`${outputType} recommendations`}
    >
      <AnimatePresence initial={false}>
        {items.map((item, i) => (
          <motion.li
            key={`${item.type}-${item.id}`}
            layout
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.04 }}
          >
            <Card item={item} />
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}

function Card({ item }: { item: RecommendItem }) {
  const accent = TYPE_ACCENT[item.type];
  const isArtist = item.type === "artist";
  return (
    <article
      className="lift relative isolate flex h-full flex-col overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4"
      style={{ ["--accent" as string]: accent.deep }}
    >
      <div className="relative mb-3 overflow-hidden rounded-2xl">
        {item.image ? (
          <img
            src={item.image}
            alt=""
            loading="lazy"
            className={
              isArtist
                ? "aspect-square w-full rounded-full object-cover"
                : "aspect-square w-full object-cover"
            }
          />
        ) : (
          <div aria-hidden className="aspect-square w-full" style={{ background: accent.soft }} />
        )}
        {item.preview_url !== null && (
          <div className="absolute right-3 bottom-3">
            <PreviewButton url={item.preview_url} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-base font-medium leading-tight">{item.name}</h3>
          <span
            className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
            style={{ background: accent.soft }}
          >
            {item.popularity}
          </span>
        </div>
        {!isArtist && (
          <p className="mt-0.5 truncate text-sm text-[color:var(--color-muted-foreground)]">
            {item.artist_name}
          </p>
        )}
        <p className="mt-2 line-clamp-2 text-xs italic text-[color:var(--color-muted-foreground)]/80">
          {item.why}
        </p>
      </div>
      {item.open_url && (
        <a
          href={item.open_url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-foreground)] underline-offset-2 hover:underline"
        >
          Open ↗
        </a>
      )}
    </article>
  );
}

function PlaylistResult({ playlist }: { playlist: RecommendItem }) {
  const accent = TYPE_ACCENT.playlist;
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-sm"
      style={{ ["--accent" as string]: accent.deep }}
    >
      <header
        className="flex flex-col gap-4 p-6 md:flex-row md:items-end"
        style={{
          background: `linear-gradient(140deg, ${accent.soft} 0%, transparent 70%)`,
        }}
      >
        <div className="h-32 w-32 shrink-0 overflow-hidden rounded-2xl shadow-md md:h-40 md:w-40">
          {playlist.image ? (
            <img src={playlist.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div aria-hidden className="h-full w-full" style={{ background: accent.soft }} />
          )}
        </div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-widest text-[color:var(--color-muted-foreground)]">
            Generated playlist
          </div>
          <h2 className="mt-1 font-display text-3xl">{playlist.name}</h2>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            {playlist.tracks?.length ?? 0} tracks · {playlist.why}
          </p>
        </div>
      </header>
      <ol className="divide-y divide-[color:var(--color-border)]">
        {(playlist.tracks ?? []).map((t, i) => (
          <motion.li
            key={t.id}
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: Math.min(i, 12) * 0.025 }}
            className="flex items-center gap-3 px-4 py-3 hover:bg-[color:var(--color-muted)] md:px-6"
          >
            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-[color:var(--color-muted-foreground)]">
              {i + 1}
            </span>
            {t.image ? (
              <img src={t.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
            ) : (
              <div
                aria-hidden
                className="h-10 w-10 shrink-0 rounded-lg"
                style={{ background: accent.soft }}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{t.name}</div>
              <div className="truncate text-xs text-[color:var(--color-muted-foreground)]">
                {t.artist_name}
              </div>
            </div>
            <PreviewButton url={t.preview_url} size="sm" />
          </motion.li>
        ))}
      </ol>
    </motion.article>
  );
}

function SkeletonGrid({ outputType }: { outputType: MediaType }) {
  const count = outputType === "playlist" ? 1 : 6;
  const cols =
    outputType === "artist"
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
      : outputType === "playlist"
        ? "grid-cols-1"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid gap-4 ${cols}`} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders are static
          key={i}
          className="rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4"
        >
          <div className="aspect-square w-full overflow-hidden rounded-2xl bg-[color:var(--color-muted)]">
            <div className="shimmer h-full w-full" />
          </div>
          <div className="mt-3 h-3 w-2/3 rounded bg-[color:var(--color-muted)]" />
          <div className="mt-2 h-3 w-1/2 rounded bg-[color:var(--color-muted)]" />
        </div>
      ))}
    </div>
  );
}
