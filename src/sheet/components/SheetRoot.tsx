"use client";

import { useEffect } from "react";
import { useSheetUrlState } from "../hooks/useSheetUrlState";
import { useSheetNavigation } from "../utils/navigation";
import { SheetPanelViewport } from "./SheetPanelViewport";
import { AnimatePresence, motion } from "motion/react";

export function SheetRoot() {
    const { modalId } = useSheetUrlState();
    const nav = useSheetNavigation(modalId ?? undefined);

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
