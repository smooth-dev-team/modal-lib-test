"use client";

import { animate, motion, PanInfo, useMotionValue } from "motion/react";
import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { cachePanel, listCachedPanelKeys, getCachedPanel } from "../utils/panelCache";
import { useSheetUrlState } from "../hooks/useSheetUrlState";
import { useSheetNavigation } from "../utils/navigation";
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

    // Reset x when key changes
    useLayoutEffect(() => {
        animRef.current?.stop?.();
        animRef.current?.cancel?.();
        x.set(0);
        suppressResetsRef.current = false;
    }, [currentKey, x]);

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
            animTo(-w.get()).finished.then(() => nav.goForward());
        } else if ((cur >= DIST || v > VEL) && canDragRight && prevPath) {
            suppressResetsRef.current = true;
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
                {currentNode}
            </motion.div>

            {/* Prev peek */}
            {prevPath && (
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
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            background: "#e6f2ff",
                            padding: 12,
                            borderRight: "1px solid #c5e0ff",
                        }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#036" }}>
                            Back peek
                        </div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>{prevPath}</div>
                        <div style={{ marginTop: 6, fontSize: 10, color: "#369" }}>
                            {backPeekNode}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Next peek */}
            {nextPath && (
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
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            background: "#fff5e6",
                            padding: 12,
                            borderLeft: "1px solid #ffd699",
                        }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#853" }}>
                            Forward peek
                        </div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>{nextPath}</div>
                        <div style={{ marginTop: 6, fontSize: 10, color: "#a63" }}>
                            {forwardPeekNode}
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
