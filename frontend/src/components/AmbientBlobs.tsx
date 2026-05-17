import { motion } from "motion/react";

import type { MediaType } from "../lib/schemas";
import { TYPE_ACCENT } from "../lib/typeColors";

type Props = {
  inputType: MediaType;
  outputType: MediaType;
};

export function AmbientBlobs({ inputType, outputType }: Props) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <motion.div
        className="blob blob-a"
        style={{
          left: "-12vw",
          top: "-10vh",
          width: "62vw",
          height: "62vw",
          background: TYPE_ACCENT[inputType].soft,
        }}
        animate={{ opacity: [0.55, 0.7, 0.55] }}
        transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      <motion.div
        className="blob blob-b"
        style={{
          right: "-14vw",
          top: "20vh",
          width: "54vw",
          height: "54vw",
          background: TYPE_ACCENT[outputType].soft,
        }}
        animate={{ opacity: [0.5, 0.65, 0.5] }}
        transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
    </div>
  );
}
