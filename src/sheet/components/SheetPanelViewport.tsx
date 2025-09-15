"use client";

import { animate, motion, PanInfo, useMotionValue } from "motion/react";
import { useEffect, useMemo, useRef, useState, useLayoutEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { getCachedPanel } from "../utils/panelCache";
import { useSheetUrlState } from "../hooks/useSheetUrlState";
import { useSheetNavigation, determineTransition } from "../utils/navigation";
import { useSheetHistory } from "../hooks/useSheetHistory";
import type {} from "../types";
import {
    SHEET_GESTURE_THRESHOLD,
    PANEL_ANIMATION_MODE,
    PANEL_ANIMATION_PRESETS,
} from "../constants";
import { registry } from "../registry";
import { usePanelLoader } from "../hooks/usePanelLoader";

export function SheetPanelViewport() {
    const { panelPath, modalId } = useSheetUrlState();
    const nav = useSheetNavigation(modalId ?? undefined);
    const {
        history: h,
        canGoBack: canBack,
        canGoForward: canFwd,
    } = useSheetHistory(modalId ?? undefined);
    // currentKey must distinguish null from "" (root panel)
    const currentKey = panelPath === null ? "__none__" : panelPath;

    // Incoming bridge: render cached peek content inside the push-in wrapper until the real panel is ready
    const [incomingBridgeNode, setIncomingBridgeNode] = useState<React.ReactNode | null>(null);
    // Current panel loader (suppresses fallback while bridge is active)
    const { currentNode, isCurrentNodeRealComp } = usePanelLoader(
        modalId ?? null,
        panelPath,
        !!incomingBridgeNode
    );

    // History-driven prev/next candidates (equivalent to Back/Forward buttons)
    const prevPath = useMemo(() => {
        if (!h) return null;
        return h.cursor > 0 ? h.stack[h.cursor - 1] : null;
    }, [h]);
    const nextPath = useMemo(() => {
        if (!h) return null;
        return h.cursor < h.stack.length - 1 ? h.stack[h.cursor + 1] : null;
    }, [h]);
    // Motion values and width measurement (SlideStack-like)
    const x = useMotionValue(0);
    const w = useMotionValue(0);
    const [width, setWidth] = useState(0);
    const containerRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const node = containerRef.current;
        if (!node) return;
        const measure = () => {
            const cw = Math.max(1, node.clientWidth || 0);
            setWidth(cw);
            w.set(cw);
        };
        const ro = new ResizeObserver(measure);
        ro.observe(node);
        measure();
        return () => ro.disconnect();
    }, [w]);

    // Peek positions
    const prevX = useMotionValue(0);
    const nextX = useMotionValue(0);
    useEffect(() => {
        const update = () => {
            const cx = x.get();
            const ww = w.get();
            prevX.set(cx - ww);
            nextX.set(cx + ww);
        };
        const sx = x.on("change", update);
        const sw = w.on("change", update);
        update();
        return () => {
            sx();
            sw();
        };
    }, [x, w, prevX, nextX]);

    // Animate helper
    const animRef = useRef<{
        stop?: () => void;
        cancel?: () => void;
        finished: Promise<void>;
    } | null>(null);
    const suppressResetsRef = useRef(false);
    const isAnimatingRef = useRef(false);
    const animTo = (t: number) => {
        animRef.current?.stop?.();
        animRef.current?.cancel?.();
        const d = Math.abs(x.get() - t);
        if (PANEL_ANIMATION_MODE === "spring") {
            const ctrl = animate(x, t, {
                type: "spring",
                ...PANEL_ANIMATION_PRESETS.spring.slide,
            });
            animRef.current = ctrl as unknown as {
                stop?: () => void;
                cancel?: () => void;
                finished: Promise<void>;
            };
            isAnimatingRef.current = true;
            ctrl.finished.finally(() => {
                isAnimatingRef.current = false;
            });
            return ctrl;
        }
        const { pxPerSecond, minDuration, maxDuration } =
            PANEL_ANIMATION_PRESETS.tween.slideDynamic;
        const dur = Math.min(Math.max(d / pxPerSecond, minDuration), maxDuration);
        const ctrl = animate(x, t, {
            type: "tween",
            duration: dur,
            ease: PANEL_ANIMATION_PRESETS.tween.slideEase,
        });
        animRef.current = ctrl as unknown as {
            stop?: () => void;
            cancel?: () => void;
            finished: Promise<void>;
        };
        isAnimatingRef.current = true;
        ctrl.finished.finally(() => {
            isAnimatingRef.current = false;
        });
        return ctrl;
    };

    // Programmatic transition (button-driven) animation state
    const prevPathRef = useRef<string | null>(null);
    const skipNextProgramAnimRef = useRef(false); // set by gesture commit to avoid double-animating
    const [outgoingNode, setOutgoingNode] = useState<React.ReactNode | null>(null);
    const progInX = useMotionValue(0);
    const progOutX = useMotionValue(0);
    const progInOpacity = useMotionValue(1);
    const progOutOpacity = useMotionValue(1);
    // (moved incomingBridgeNode above to avoid TDZ in currentNode memo)
    // Freeze peeks during bridge so peeks and center swap in perfect sync
    const [frozenPeeks, setFrozenPeeks] = useState<{
        prev: React.ReactNode | null;
        next: React.ReactNode | null;
    } | null>(null);
    const [useFrozenPeeks, setUseFrozenPeeks] = useState(false);
    // Suppress rendering of the previous current panel right after a gesture commit
    const [suppressCenterPrev, setSuppressCenterPrev] = useState(false);
    const commitTargetPathRef = useRef<string | null>(null);
    const frozenPrevPathRef = useRef<string | null>(null);
    const frozenNextPathRef = useRef<string | null>(null);
    // Track center render phase for logging
    const lastCenterKeyRef = useRef<string | null>(null);

    // Clear any leftover transient state (bridge/suppression/frozen peeks)
    const resetTransientState = useCallback(() => {
        setIncomingBridgeNode(null);
        setUseFrozenPeeks(false);
        setFrozenPeeks(null);
        setSuppressCenterPrev(false);
        commitTargetPathRef.current = null;
    }, []);

    // Reset x when key changes
    useLayoutEffect(() => {
        animRef.current?.stop?.();
        animRef.current?.cancel?.();
        x.set(0);
        suppressResetsRef.current = false;
    }, [currentKey, x]);

    // Start programmatic animation on panel change triggered by buttons
    useEffect(() => {
        const prev = prevPathRef.current;
        const next = panelPath ?? null;
        if (prev == null || next == null || prev === next) {
            prevPathRef.current = next;
            return;
        }
        // Skip when the change came from a gesture commit (we already animated)
        if (skipNextProgramAnimRef.current) {
            skipNextProgramAnimRef.current = false;
            prevPathRef.current = next;
            return;
        }
        // Ensure no lingering swipe transient state bleeds into programmatic transition
        resetTransientState();
        const kind = determineTransition(prev, next);
        const outNode = getCachedPanel(prev);
        if (kind === "forward" || kind === "back") {
            // Slide animation: incoming from ±w -> 0, outgoing to ∓w
            const ww = w.get();
            progInOpacity.set(1);
            progOutOpacity.set(1);
            progOutX.set(0);
            if (kind === "forward") {
                progInX.set(ww);
            } else {
                progInX.set(-ww);
            }
            setOutgoingNode(outNode ?? null);
            let inCtrl, outCtrl;
            if (PANEL_ANIMATION_MODE === "spring") {
                inCtrl = animate(progInX, 0, {
                    type: "spring",
                    ...PANEL_ANIMATION_PRESETS.spring.slide,
                });
                outCtrl = animate(progOutX, kind === "forward" ? -ww : ww, {
                    type: "spring",
                    ...PANEL_ANIMATION_PRESETS.spring.slide,
                });
            } else {
                inCtrl = animate(progInX, 0, {
                    type: "tween",
                    duration: PANEL_ANIMATION_PRESETS.tween.slideProgrammaticDuration,
                    ease: PANEL_ANIMATION_PRESETS.tween.slideEase,
                });
                outCtrl = animate(progOutX, kind === "forward" ? -ww : ww, {
                    type: "tween",
                    duration: PANEL_ANIMATION_PRESETS.tween.slideProgrammaticDuration,
                    ease: PANEL_ANIMATION_PRESETS.tween.slideEase,
                });
            }
            Promise.all([inCtrl.finished, outCtrl.finished]).finally(() => {
                setOutgoingNode(null);
                progInX.set(0);
                progOutX.set(0);
            });
        } else if (kind === "fade") {
            // Cross-fade: outgoing 1->0, incoming 0->1
            progInX.set(0);
            progOutX.set(0);
            progInOpacity.set(0);
            progOutOpacity.set(1);
            setOutgoingNode(outNode ?? null);
            const inCtrl = animate(progInOpacity, 1, {
                type: "tween",
                duration: PANEL_ANIMATION_PRESETS.tween.fadeDuration,
                ease: PANEL_ANIMATION_PRESETS.tween.fadeEase,
            });
            const outCtrl = animate(progOutOpacity, 0, {
                type: "tween",
                duration: PANEL_ANIMATION_PRESETS.tween.fadeDuration,
                ease: PANEL_ANIMATION_PRESETS.tween.fadeEase,
            });
            Promise.all([inCtrl.finished, outCtrl.finished]).finally(() => {
                setOutgoingNode(null);
                progInOpacity.set(1);
                progOutOpacity.set(1);
            });
        } else {
            setOutgoingNode(null);
        }
        prevPathRef.current = next;
    }, [panelPath, w, progInX, progOutX, progInOpacity, progOutOpacity, resetTransientState]);

    // Clamp when no candidate or out-of-range
    useLayoutEffect(() => {
        if (isAnimatingRef.current || suppressResetsRef.current) return;
        animRef.current?.stop?.();
        animRef.current?.cancel?.();
        x.set(0);
    }, [prevPath, nextPath, x]);

    useLayoutEffect(() => {
        const ww = w.get();
        const val = x.get();
        if (suppressResetsRef.current) return;
        if (prevPath == null && val > 0) x.set(0);
        if (nextPath == null && val < 0) x.set(0);
        if (Math.abs(val) > ww + 2) x.set(0);
    }, [prevPath, nextPath, w, x]);

    useLayoutEffect(() => {
        const unsub = x.on("change", (val) => {
            const ww = w.get();
            if (Math.abs(val) > ww + 2) x.set(0);
        });
        return unsub;
    }, [x, w]);

    // Debug helper
    const DEBUG = false;
    const debugRef = useRef(DEBUG);
    const debugLog = useCallback((...args: unknown[]) => {
        if (debugRef.current) console.log(...args);
    }, []);

    // Drag end commit
    const DIST = useMemo(() => Math.max(60, 0.22 * (width || 0)), [width]);
    const VEL = SHEET_GESTURE_THRESHOLD.horizontalVelocity;
    // Shared commit executor (forward/back)
    const commitSwipe = (
        direction: "forward" | "back",
        cur: number,
        ctx: { prevPath: string | null; nextPath: string | null }
    ) => {
        skipNextProgramAnimRef.current = true;
        const snapshot = (panelPath != null ? getCachedPanel(panelPath) : null) ?? currentNode;
        if (snapshot) {
            setOutgoingNode(snapshot);
            progOutOpacity.set(1);
            progOutX.set(cur);
        }
        const ww = w.get();
        const startX = direction === "forward" ? cur + ww : cur - ww;
        const targetPath = direction === "forward" ? ctx.nextPath! : ctx.prevPath!;
        const peekSnapshot = getCachedPanel(targetPath);
        flushSync(() => {
            commitTargetPathRef.current = targetPath;
            setSuppressCenterPrev(true);
            setFrozenPeeks({
                prev: ctx.prevPath != null ? (getCachedPanel(ctx.prevPath) ?? null) : null,
                next: ctx.nextPath != null ? (getCachedPanel(ctx.nextPath) ?? null) : null,
            });
            frozenPrevPathRef.current = ctx.prevPath;
            frozenNextPathRef.current = ctx.nextPath;
            setUseFrozenPeeks(true);
            setIncomingBridgeNode(peekSnapshot ?? null);
            progInX.set(startX);
        });
        if (PANEL_ANIMATION_MODE === "spring") {
            animate(progInX, 0, {
                type: "spring",
                ...PANEL_ANIMATION_PRESETS.spring.slide,
            }).finished.catch(() => {});
        } else {
            const { pxPerSecond, minDuration, maxDuration } =
                PANEL_ANIMATION_PRESETS.tween.slideDynamic;
            animate(progInX, 0, {
                type: "tween",
                duration: Math.min(
                    Math.max(Math.abs(startX) / pxPerSecond, minDuration),
                    maxDuration
                ),
                ease: PANEL_ANIMATION_PRESETS.tween.slideEase,
            }).finished.catch(() => {});
        }
        if (direction === "forward") nav.goForward();
        else nav.goBack();
        x.set(0);
        const outTarget = direction === "forward" ? -ww : ww;
        const outCtrl =
            PANEL_ANIMATION_MODE === "spring"
                ? animate(progOutX, outTarget, {
                      type: "spring",
                      ...PANEL_ANIMATION_PRESETS.spring.slide,
                  })
                : animate(progOutX, outTarget, {
                      type: "tween",
                      duration: Math.min(
                          Math.max(
                              Math.abs(direction === "forward" ? cur + ww : ww - cur) /
                                  PANEL_ANIMATION_PRESETS.tween.slideDynamic.pxPerSecond,
                              PANEL_ANIMATION_PRESETS.tween.slideDynamic.minDuration
                          ),
                          0.24
                      ),
                      ease: PANEL_ANIMATION_PRESETS.tween.slideEase,
                  });
        outCtrl.finished.finally(() => {
            setOutgoingNode(null);
            progOutX.set(0);
        });
    };
    const onDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        // Log swipe release timing and context
        debugLog("[SheetViewport] swipe released", {
            time: Date.now(),
            x: x.get(),
            velocityX: info.velocity.x,
            prevPath,
            nextPath,
            panelPath,
            canDragLeft,
            canDragRight,
        });
        const cur = x.get();
        const v = info.velocity.x;
        // Commit: forward (left swipe)
        if ((cur <= -DIST || v < -VEL) && canDragLeft && nextPath != null) {
            commitSwipe("forward", cur, { prevPath, nextPath });
        }
        // Commit: back (right swipe)
        else if ((cur >= DIST || v > VEL) && canDragRight && prevPath != null) {
            commitSwipe("back", cur, { prevPath, nextPath });
        } else {
            animTo(0).finished.then(() => x.set(0));
        }
    };

    // Swap bridge to real content only after URL reached the committed target and the real comp loaded
    useEffect(() => {
        if (!incomingBridgeNode) return;
        const target = commitTargetPathRef.current;
        if (!target) return;
        // Wait for URL to be the committed target
        if (panelPath !== target) return;
        // And ensure the real component for target is ready (not fallback)
        if (!isCurrentNodeRealComp) return;
        // Atomically: hide bridge and release frozen peeks so peeks/current switch together
        setIncomingBridgeNode(null);
        setUseFrozenPeeks(false);
        setFrozenPeeks(null);
        // Center can render again
        setSuppressCenterPrev(false);
        commitTargetPathRef.current = null;
    }, [incomingBridgeNode, isCurrentNodeRealComp, panelPath]);

    // If there's no bridge, lift suppression once the real next component is ready for the committed target path
    useEffect(() => {
        if (!suppressCenterPrev) return;
        if (!commitTargetPathRef.current) return;
        // When URL has switched to the committed path and its real component has loaded, allow center render
        if (panelPath === commitTargetPathRef.current && isCurrentNodeRealComp) {
            setSuppressCenterPrev(false);
            setUseFrozenPeeks(false);
            setFrozenPeeks(null);
            commitTargetPathRef.current = null;
        }
    }, [suppressCenterPrev, panelPath, isCurrentNodeRealComp]);

    const derivedBackPeekNode = prevPath != null ? getCachedPanel(prevPath) : null;
    const derivedForwardPeekNode = nextPath != null ? getCachedPanel(nextPath) : null;
    const backPeekNode = useFrozenPeeks && frozenPeeks ? frozenPeeks.prev : derivedBackPeekNode;
    const forwardPeekNode =
        useFrozenPeeks && frozenPeeks ? frozenPeeks.next : derivedForwardPeekNode;
    // Allow drag based solely on history availability; peek nodes are optional for visuals
    const canDragRight = !!canBack;
    const canDragLeft = !!canFwd;

    // Compose a key representing what the center is currently rendering (for logging)
    const centerRenderKey = useMemo(() => {
        if (incomingBridgeNode) {
            return `bridge:${commitTargetPathRef.current ?? "unknown"}`;
        }
        if (isCurrentNodeRealComp) {
            return `real:${panelPath ?? ""}`;
        }
        const def = modalId && panelPath != null ? registry[modalId]?.[panelPath] : undefined;
        if (def?.fallback) return `fallback:${panelPath ?? ""}`;
        return "empty";
    }, [incomingBridgeNode, isCurrentNodeRealComp, panelPath, modalId]);

    // Log when the center render phase changes
    useEffect(() => {
        if (lastCenterKeyRef.current !== centerRenderKey) {
            debugLog("[SheetViewport] center switched", {
                center: centerRenderKey,
                panelPath,
                time: Date.now(),
            });
            lastCenterKeyRef.current = centerRenderKey;
        }
    }, [centerRenderKey, panelPath, debugLog]);

    // Peek change logging keys
    const backPeekKey = useMemo(() => {
        const source = useFrozenPeeks ? "frozen" : "derived";
        const p = useFrozenPeeks ? frozenPrevPathRef.current : prevPath;
        return `${source}:${p ?? ""}`;
    }, [useFrozenPeeks, prevPath]);
    const forwardPeekKey = useMemo(() => {
        const source = useFrozenPeeks ? "frozen" : "derived";
        const p = useFrozenPeeks ? frozenNextPathRef.current : nextPath;
        return `${source}:${p ?? ""}`;
    }, [useFrozenPeeks, nextPath]);
    const lastBackPeekKeyRef = useRef<string | null>(null);
    const lastForwardPeekKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (lastBackPeekKeyRef.current !== backPeekKey) {
            debugLog("[SheetViewport] prev peek switched", {
                key: backPeekKey,
                time: Date.now(),
            });
            lastBackPeekKeyRef.current = backPeekKey;
        }
    }, [backPeekKey, debugLog]);
    useEffect(() => {
        if (lastForwardPeekKeyRef.current !== forwardPeekKey) {
            debugLog("[SheetViewport] next peek switched", {
                key: forwardPeekKey,
                time: Date.now(),
            });
            lastForwardPeekKeyRef.current = forwardPeekKey;
        }
    }, [forwardPeekKey, debugLog]);

    return (
        <div
            ref={containerRef}
            style={{ position: "relative", overflow: "hidden", width: "100%", height: "100%" }}>
            {/* Current panel (draggable) */}
            <motion.div
                style={{
                    position: "absolute",
                    inset: 0,
                    x,
                    touchAction: "none",
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                    transform: "translateZ(0)",
                }}
                drag='x'
                dragMomentum={false}
                dragElastic={0}
                dragDirectionLock
                dragConstraints={
                    width > 0
                        ? { left: canDragLeft ? -width : 0, right: canDragRight ? width : 0 }
                        : { left: 0, right: 0 }
                }
                onDragEnd={onDragEnd}>
                {/* Programmatic animation wrapper for the incoming (current) panel */}
                <motion.div
                    style={{
                        x: progInX,
                        opacity: progInOpacity,
                        width: "100%",
                        height: "100%",
                        position: "absolute",
                        inset: 0,
                        zIndex: 2,
                    }}>
                    {incomingBridgeNode !== null
                        ? incomingBridgeNode
                        : suppressCenterPrev
                          ? null
                          : currentNode}
                </motion.div>
            </motion.div>

            {/* Prev peek */}
            {backPeekNode && (
                <motion.div
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        x: prevX,
                        pointerEvents: "none",
                        willChange: "transform",
                        backfaceVisibility: "hidden",
                        transform: "translateZ(0)",
                        zIndex: 0,
                    }}>
                    {backPeekNode}
                </motion.div>
            )}

            {/* Next peek */}
            {forwardPeekNode && (
                <motion.div
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        x: nextX,
                        pointerEvents: "none",
                        willChange: "transform",
                        backfaceVisibility: "hidden",
                        transform: "translateZ(0)",
                        zIndex: 0,
                    }}>
                    {forwardPeekNode}
                </motion.div>
            )}

            {/* Outgoing overlay for programmatic transitions */}
            {outgoingNode && (
                <motion.div
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        x: progOutX,
                        opacity: progOutOpacity,
                        pointerEvents: "none",
                        willChange: "transform, opacity",
                        backfaceVisibility: "hidden",
                        transform: "translateZ(0)",
                        zIndex: 1,
                    }}>
                    {outgoingNode}
                </motion.div>
            )}
        </div>
    );
}
