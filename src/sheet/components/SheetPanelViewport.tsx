"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";
import { useSheetUrlState } from "../hooks/useSheetUrlState";

export function SheetPanelViewport() {
    const { panelPath } = useSheetUrlState();
    const prevRef = useRef<string | null>(null);

    const currentKey = panelPath ?? "__none__";
    prevRef.current = currentKey;

    return (
        <div>
            <AnimatePresence initial={false} mode='wait'>
                <motion.div
                    key={currentKey}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                    style={{
                        border: "1px dashed #ccc",
                        borderRadius: 8,
                        padding: 12,
                        background: "#fafafa",
                    }}>
                    <div style={{ fontSize: 12, color: "#666" }}>Panel</div>
                    <div style={{ marginTop: 4, fontWeight: 600 }}>{panelPath ?? "(null)"}</div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
