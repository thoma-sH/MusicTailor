import { useEffect, useRef, useState } from "react";

import { cn } from "../lib/utils";

type Props = {
  url: string | null;
  size?: "sm" | "md";
};

/**
 * Single shared <audio> at a time across the page would be ideal, but for v1
 * each card owns its own. Pressing play stops any other playing audio via a
 * window-scoped event to keep the UX sane.
 */
export function PreviewButton({ url, size = "md" }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    function onStop(e: Event) {
      const source = (e as CustomEvent).detail;
      if (source !== audioRef.current && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setPlaying(false);
      }
    }
    window.addEventListener("musictailor:stop-previews", onStop as EventListener);
    return () => window.removeEventListener("musictailor:stop-previews", onStop as EventListener);
  }, []);

  if (!url) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full text-[color:var(--color-muted-foreground)]",
          size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm",
        )}
        title="No preview available"
      >
        <span className="sr-only">No preview available</span>
        <span aria-hidden>—</span>
      </span>
    );
  }

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      window.dispatchEvent(new CustomEvent("musictailor:stop-previews", { detail: a }));
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      a.pause();
      a.currentTime = 0;
      setPlaying(false);
    }
  }

  return (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: 30s preview clips have no spoken content */}
      <audio ref={audioRef} src={url} preload="none" onEnded={() => setPlaying(false)} />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause preview" : "Play 30-second preview"}
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] text-[color:var(--color-foreground)] shadow-sm transition hover:scale-105 hover:shadow-md",
          size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm",
        )}
      >
        {playing ? "❚❚" : "▶"}
      </button>
    </>
  );
}
