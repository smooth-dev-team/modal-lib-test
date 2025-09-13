"use client";

import { animate, motion, PanInfo, useMotionValue } from "motion/react";
import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { cachePanel, listCachedPanelKeys, getCachedPanel } from "../utils/panelCache";
import { useSheetUrlState } from "../hooks/useSheetUrlState";
import { useSheetNavigation, determineTransition } from "../utils/navigation";
import { useSheetHistory } from "../hooks/useSheetHistory";
import type {} from "../types";
import { SHEET_GESTURE_THRESHOLD } from "../constants";

export function SheetPanelViewport() {
    const { panelPath, modalId } = useSheetUrlState();
    const nav = useSheetNavigation(modalId ?? undefined);
    const {
        history: h,
        canGoBack: canBack,
        canGoForward: canFwd,
    } = useSheetHistory(modalId ?? undefined);
    const currentKey = panelPath ?? "__none__";

    // Build current node and cache for peeks
    const currentNode = useMemo(
        () => (
            <div
                style={{
                    border: "1px dashed #ccc",
                    borderRadius: 8,
                    padding: 12,
                    background: "#fafafa",
                    position: "absolute",
                    inset: 0,
                }}>
                <div>(^ω^= ^ω^) おっおっおっおっ</div>
                <div style={{ fontSize: 12, color: "#666" }}>Panel</div>
                <div>(^ω^= ^ω^) おっおっおっおっ</div>
                <div style={{ marginTop: 4, fontWeight: 600 }}>{panelPath ?? "(null)"}</div>
            </div>
        ),
        [panelPath]
    );
    useEffect(() => {
        if (!panelPath) return;
        cachePanel(panelPath, currentNode);
    }, [panelPath, currentNode]);

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
        const dur = Math.min(Math.max(d / 1200, 0.18), 0.25);
        const ctrl = animate(x, t, { type: "tween", duration: dur, ease: [0.32, 0.72, 0, 1] });
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
        if (!prev || !next || prev === next) {
            prevPathRef.current = next;
            return;
        }
        // Skip when the change came from a gesture commit (we already animated)
        if (skipNextProgramAnimRef.current) {
            skipNextProgramAnimRef.current = false;
            prevPathRef.current = next;
            return;
        }
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
            const inCtrl = animate(progInX, 0, {
                type: "tween",
                duration: 0.22,
                ease: [0.32, 0.72, 0, 1],
            });
            const outCtrl = animate(progOutX, kind === "forward" ? -ww : ww, {
                type: "tween",
                duration: 0.22,
                ease: [0.32, 0.72, 0, 1],
            });
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
                duration: 0.18,
                ease: [0.25, 0.1, 0.25, 1],
            });
            const outCtrl = animate(progOutOpacity, 0, {
                type: "tween",
                duration: 0.18,
                ease: [0.25, 0.1, 0.25, 1],
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
    }, [panelPath, w, progInX, progOutX, progInOpacity, progOutOpacity]);

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
        if (!prevPath && val > 0) x.set(0);
        if (!nextPath && val < 0) x.set(0);
        if (Math.abs(val) > ww + 2) x.set(0);
    }, [prevPath, nextPath, w, x]);

    useLayoutEffect(() => {
        const unsub = x.on("change", (val) => {
            const ww = w.get();
            if (Math.abs(val) > ww + 2) x.set(0);
        });
        return unsub;
    }, [x, w]);

    // Drag end commit
    const DIST = useMemo(() => Math.max(60, 0.22 * (width || 0)), [width]);
    const VEL = SHEET_GESTURE_THRESHOLD.horizontalVelocity;
    const onDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const cur = x.get();
        const v = info.velocity.x;
        if ((cur <= -DIST || v < -VEL) && canDragLeft && nextPath) {
            suppressResetsRef.current = true;
            skipNextProgramAnimRef.current = true;
            animTo(-w.get()).finished.then(() => nav.goForward());
        } else if ((cur >= DIST || v > VEL) && canDragRight && prevPath) {
            suppressResetsRef.current = true;
            skipNextProgramAnimRef.current = true;
            animTo(w.get()).finished.then(() => nav.goBack());
        } else {
            animTo(0).finished.then(() => x.set(0));
        }
    };

    const backPeekNode = prevPath ? getCachedPanel(prevPath) : null;
    const forwardPeekNode = nextPath ? getCachedPanel(nextPath) : null;
    const canDragRight = !!(canBack && backPeekNode);
    const canDragLeft = !!(canFwd && forwardPeekNode);

    return (
        <div
            ref={containerRef}
            style={{ position: "relative", overflow: "hidden", width: "100%", height: "100%" }}>
            {/* Debug */}
            <div
                style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    zIndex: 30,
                    background: "#000a",
                    color: "#fff",
                    fontSize: 10,
                    padding: "4px 6px",
                    borderRadius: 4,
                    lineHeight: 1.4,
                }}>
                cache: {listCachedPanelKeys().join(",") || "(empty)"}
                <br />
                x:{Math.round(x.get())} w:{Math.round(w.get())}
                <br />
                back:{prevPath ?? "-"} fwd:{nextPath ?? "-"}
            </div>

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
                    }}>
                    {currentNode}
                </motion.div>
            </motion.div>

            {/* Prev peek */}
            {prevPath && backPeekNode && (
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
                    }}>
                    {backPeekNode}
                </motion.div>
            )}

            {/* Next peek */}
            {nextPath && forwardPeekNode && (
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
                    }}>
                    {outgoingNode}
                </motion.div>
            )}
        </div>
    );
}
