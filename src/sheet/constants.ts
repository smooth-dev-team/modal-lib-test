// Centralized defaults for gestures, animations, and caching.
// Keep these aligned with docs/motion-docs guidance.

export const SHEET_GESTURE_THRESHOLD = {
    horizontalDistance: 80,
    horizontalVelocity: 0.35,
    verticalDistanceToClose: 120,
    verticalVelocityToClose: 0.5,
    directionLockPx: 10, // first N px to determine dominant axis
} as const;

export const SHEET_ANIMATION = {
    spring: { stiffness: 400, damping: 34 },
    overshootPx: 70,
} as const;

export const SHEET_CACHE = {
    keepAlivePanels: 5, // LRU upper bound for memoized panels
} as const;
