import { AnimatePresence, motion } from "motion/react";

import { useAppStore } from "../state/app";

export function ThemeToggle() {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      aria-pressed={isDark}
      className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)]/70 text-[color:var(--color-foreground)] backdrop-blur transition hover:bg-[color:var(--color-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ y: 14, opacity: 0, rotate: -30 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -14, opacity: 0, rotate: 30 }}
          transition={{ duration: 0.32, ease: [0.2, 0.7, 0.3, 1] }}
          className="text-sm leading-none"
          aria-hidden
        >
          {isDark ? "☾" : "☀"}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
