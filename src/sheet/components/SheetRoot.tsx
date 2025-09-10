"use client";

import { useEffect, useRef } from "react";
import { useSheetUrlState } from "../hooks/useSheetUrlState";
import { useSheetNavigation } from "../utils/navigation";
import { SheetPanelViewport } from "./SheetPanelViewport";
import { AnimatePresence, motion } from "motion/react";

export function SheetRoot() {
    const { modalId } = useSheetUrlState();
    const nav = useSheetNavigation(modalId ?? undefined);

    const sheetRef = useRef<HTMLDivElement | null>(null);
    const prevFocusedRef = useRef<HTMLElement | null>(null);

    // Esc to close (active only when sheet is open)
    useEffect(() => {
        if (!modalId) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") nav.closeSheet({ hard: true });
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [modalId, nav]);

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

    return (
        <AnimatePresence initial={false}>
            {modalId && (
                <motion.div
                    key='sheet-root'
                    aria-hidden={false}
                    style={{ position: "fixed", inset: 0, zIndex: 1010 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}>
                    {/* Overlay */}
                    <motion.div
                        onClick={() => nav.closeSheet({ hard: true })}
                        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                    />
                    {/* Sheet body */}
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
                            maxHeight: "86vh",
                            padding: 16,
                        }}
                        initial={{ y: 40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 40, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 34, mass: 0.8 }}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}>
                            <div style={{ fontWeight: 600 }}>Sheet</div>
                            <button onClick={() => nav.closeSheet({ hard: true })}>Close</button>
                        </div>
                        <div style={{ marginTop: 12 }}>
                            <SheetPanelViewport />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
