import type { Transition, Variants } from "framer-motion";

// Quick, restrained motion shared by the onboarding screens. MotionConfig in
// AppLayout turns transforms off for people who prefer reduced motion.
export const EASE = [0.22, 1, 0.36, 1] as const;
export const quick: Transition = { duration: 0.2, ease: EASE };

/** Content of one step replacing another. */
export const stepSwap: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12, ease: EASE } },
};

/** Parent that reveals its children one after another. */
export const stagger = (delay = 0.05): Variants => ({
  initial: {},
  animate: { transition: { staggerChildren: delay, delayChildren: 0.04 } },
});

export const rise: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
};

/** Inline messages such as validation errors and notices. */
export const notice: Variants = {
  initial: { opacity: 0, height: 0, y: -4 },
  animate: { opacity: 1, height: "auto", y: 0, transition: { duration: 0.18, ease: EASE } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.12, ease: EASE } },
};
