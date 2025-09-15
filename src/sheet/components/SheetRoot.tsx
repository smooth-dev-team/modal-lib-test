"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useSheetUrlState } from "../hooks/useSheetUrlState";
import { useSheetNavigation } from "../utils/navigation";
import { SheetPanelViewport } from "./SheetPanelViewport";
import {
    AnimatePresence,
    motion,
    useMotionValue,
    useTransform,
    animate,
    PanInfo,
} from "motion/react";

export function SheetRoot() {
    const { modalId } = useSheetUrlState();
    const nav = useSheetNavigation(modalId ?? undefined);

    const sheetRef = useRef<HTMLDivElement | null>(null);
    const prevFocusedRef = useRef<HTMLElement | null>(null);
    const y = useMotionValue(480);
    const sheetHeightRef = useRef<number>(480);
    const backdrop = useTransform(y, (latest) => {
        const H = sheetHeightRef.current || 480;
        const t = Math.max(0, Math.min(1, 1 - latest / H));
        return 0.4 * t;
    });
    const pointerEvents = useTransform(backdrop, (b) => (b > 0.001 ? "auto" : "none"));

    // Esc to close (active only when sheet is open)
    const closeWithAnim = useCallback(() => {
        const target = sheetHeightRef.current || 480;
        return animate(y, target, {
            type: "tween",
            duration: 0.2,
            ease: [0.22, 1, 0.36, 1],
        }).finished.then(() => nav.closeSheet({ hard: true }));
    }, [nav, y]);

    useEffect(() => {
        if (!modalId) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") void closeWithAnim();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [modalId, closeWithAnim]);

    // Background scroll lock (active only when sheet is open)
    useEffect(() => {
        if (!modalId) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [modalId]);

    // Focus management: save previous focus, move focus into sheet, trap tab, and restore on close
    useEffect(() => {
        if (!modalId) return;
        const root = sheetRef.current;
        // save previously focused element
        prevFocusedRef.current = (document.activeElement as HTMLElement) || null;

        const FOCUSABLE =
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

        // focus first focusable inside sheet or the sheet container
        const focusables = root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
        const toFocus = focusables[0] ?? (root as HTMLElement);
        try {
            toFocus?.focus();
        } catch {}

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return;
            if (!root) return;
            const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
            if (nodes.length === 0) {
                e.preventDefault();
                return;
            }
            const idx = nodes.indexOf(document.activeElement as HTMLElement);
            if (e.shiftKey) {
                if (idx === 0 || document.activeElement === root) {
                    e.preventDefault();
                    nodes[nodes.length - 1].focus();
                }
            } else {
                if (idx === nodes.length - 1) {
                    e.preventDefault();
                    nodes[0].focus();
                }
            }
        };

        root?.addEventListener("keydown", onKeyDown as EventListener);
        return () => {
            root?.removeEventListener("keydown", onKeyDown as EventListener);
            // restore previous focus
            requestAnimationFrame(() => {
                try {
                    prevFocusedRef.current?.focus();
                } catch {}
            });
        };
    }, [modalId]);

    // Measure and mount animation
    useLayoutEffect(() => {
        if (!modalId) return;
        const el = sheetRef.current;
        const measure = () => {
            if (!el) return;
            const h = el.offsetHeight;
            if (h > 0) sheetHeightRef.current = h;
        };
        measure();
        y.set(sheetHeightRef.current);
        requestAnimationFrame(() => {
            animate(y, 0, { type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] });
        });
        let ro: ResizeObserver | undefined;
        if (typeof ResizeObserver !== "undefined" && el) {
            ro = new ResizeObserver(() => measure());
            ro.observe(el);
        }
        return () => {
            ro?.disconnect();
        };
    }, [modalId, y]);

    const onDrag = useCallback(
        (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
            const next = Math.max(0, y.get() + info.delta.y);
            y.set(next);
        },
        [y]
    );

    const onDragEnd = useCallback(() => {
        const current = y.get();
        const H = sheetHeightRef.current || 480;
        const threshold = Math.max(80, 0.25 * H);
        if (current >= threshold) {
            void closeWithAnim();
        } else {
            animate(y, 0, { type: "tween", duration: 0.18, ease: [0.22, 1, 0.36, 1] });
        }
    }, [y, closeWithAnim]);

    return (
        <AnimatePresence initial={false}>
            {modalId && (
                <motion.div
                    key='sheet-root'
                    aria-hidden={false}
                    style={{ position: "fixed", inset: 0, zIndex: 1010 }}>
                    {/* Overlay with animated opacity and pointer events */}
                    <motion.div
                        onClick={() => void closeWithAnim()}
                        style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(0,0,0,1)",
                            opacity: backdrop,
                            pointerEvents,
                        }}
                    />
                    {/* Sheet body with push-in/out and drag-to-close */}
                    <motion.div
                        role='dialog'
                        aria-modal='true'
                        aria-label='Sheet'
                        ref={sheetRef}
                        tabIndex={-1}
                        style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: "#fff",
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            padding: 16,
                            y,
                            paddingBottom: "env(safe-area-inset-bottom)",
                            touchAction: "none",
                            willChange: "transform",
                        }}
                        drag='y'
                        dragMomentum={false}
                        dragElastic={0}
                        dragListener
                        onDrag={onDrag}
                        onDragEnd={onDragEnd}
                        onClick={(e) => e.stopPropagation()}>
                        <div style={{ marginTop: 12, height: "93dvh" }}>
                            <SheetPanelViewport />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
