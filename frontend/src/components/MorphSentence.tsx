import { AnimatePresence, motion } from "motion/react";

import type { MediaType } from "../lib/schemas";
import { TYPE_ACCENT, TYPE_LABEL, TYPE_LABEL_PLURAL } from "../lib/typeColors";

type Props = {
  inputType: MediaType;
  outputType: MediaType;
};

export function MorphSentence({ inputType, outputType }: Props) {
  return (
    <h1
      className="text-balance font-display text-[clamp(2.4rem,7.5vw,5.6rem)] font-light leading-[0.95] tracking-tight"
      aria-label={`Find me ${TYPE_LABEL_PLURAL[outputType]} like this ${TYPE_LABEL[inputType]}`}
    >
      <span className="block text-[color:var(--color-muted-foreground)]">Find me</span>
      <span className="mr-3 inline-block align-baseline">
        <Pill word={TYPE_LABEL_PLURAL[outputType]} type={outputType} keyId={`out-${outputType}`} />
      </span>
      <span className="text-[color:var(--color-muted-foreground)]">like this</span>{" "}
      <Pill word={TYPE_LABEL[inputType]} type={inputType} keyId={`in-${inputType}`} />
      <span className="text-[color:var(--color-muted-foreground)]">.</span>
    </h1>
  );
}

function Pill({ word, type, keyId }: { word: string; type: MediaType; keyId: string }) {
  return (
    <span className="relative inline-block overflow-visible align-baseline">
      <AnimatePresence mode="wait">
        <motion.span
          key={keyId}
          initial={{ y: "0.5em", opacity: 0, filter: "blur(8px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0)" }}
          exit={{ y: "-0.5em", opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.45, ease: [0.2, 0.7, 0.3, 1] }}
          className="relative inline-block rounded-[0.45em] px-[0.25em] italic"
          style={{
            backgroundImage: `linear-gradient(120deg, ${TYPE_ACCENT[type].soft}, color-mix(in oklch, ${TYPE_ACCENT[type].soft} 60%, white))`,
          }}
        >
          {word}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
