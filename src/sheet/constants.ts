// Centralized defaults for gestures, animations, and caching.
// Keep these aligned with docs/motion-docs guidance.

export const SHEET_GESTURE_THRESHOLD = {
    horizontalDistance: 80,
    horizontalVelocity: 0.35,
    verticalDistanceToClose: 120,
    verticalVelocityToClose: 0.5,
    directionLockPx: 10, // first N px to determine dominant axis
} as const;

// Animation presets. Switch mode to "spring" if you prefer spring-based motion.
export const SHEET_ANIMATION_MODE = "spring" as const; // "tween" | "spring"

export const SHEET_ANIMATION_PRESETS = {
    tween: {
        overshootPx: 70,
        open: { type: "tween", duration: 0.3, ease: [0, 0.502, 0, 0.9981] as const },
        close: { type: "tween", duration: 0.2, ease: [0.22, 1, 0.36, 1] as const },
        snapBack: { type: "tween", duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
    },
    spring: {
        overshootPx: 70,
        open: { type: "spring", stiffness: 520, damping: 40, mass: 0.1 } as const,
        close: { type: "spring", stiffness: 520, damping: 40 } as const,
        snapBack: { type: "spring", stiffness: 520, damping: 42 } as const,
    },
} as const;

export const SHEET_ANIMATION = SHEET_ANIMATION_PRESETS[SHEET_ANIMATION_MODE];

// Panel-to-panel transition animation presets (horizontal slide/fade)
export type PanelAnimationMode = "tween" | "spring";
export const PANEL_ANIMATION_MODE: PanelAnimationMode = "spring";

export const PANEL_ANIMATION_PRESETS = {
    tween: {
        // Slide timing/easing for programmatic transitions
        slideProgrammaticDuration: 0.22,
        slideEase: [0.32, 0.72, 0, 1] as const,
        // Distance-based durations (used for drag commit/snap)
        slideDynamic: {
            pxPerSecond: 1200,
            minDuration: 0.14,
            maxDuration: 0.26,
        },
        // Fade timing/easing for deep jumps
        fadeDuration: 0.18,
        fadeEase: [0.25, 0.1, 0.25, 1] as const,
    },
    spring: {
        // Slide spring. Pair with visualDuration to coordinate timing, or omit for purely physical.
        slide: { stiffness: 520, damping: 40, mass: 0.1 } as const,
        // Fade stays tween-based for predictability
        fadeDuration: 0.18,
        fadeEase: [0.25, 0.1, 0.25, 1] as const,
    },
} as const;

export const PANEL_ANIMATION = PANEL_ANIMATION_PRESETS[PANEL_ANIMATION_MODE];

export const SHEET_CACHE = {
    keepAlivePanels: 5, // LRU upper bound for memoized panels
} as const;
