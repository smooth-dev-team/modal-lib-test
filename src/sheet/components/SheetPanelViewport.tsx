"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { useSheetUrlState } from "../hooks/useSheetUrlState";
import { determineTransition } from "../utils/navigation";

export function SheetPanelViewport() {
    const { panelPath } = useSheetUrlState();
    console.log("SheetPanelViewport render", { panelPath });
    const prevRef = useRef<string | null>(null);

    const prev = prevRef.current;
    const next = panelPath ?? null;
    const kind = useMemo(() => determineTransition(prev, next), [prev, next]);

    useEffect(() => {
        prevRef.current = next;
    }, [next]);

    const currentKey = panelPath ?? "__none__";

    const motionProps = useMemo(() => {
        const spring = { type: "spring" as const, stiffness: 400, damping: 34 };
        if (kind === "forward") {
            // both move left: enter from x=+40 -> 0, exit 0 -> -40
            return {
                initial: { opacity: 1, x: 40 },
                animate: { opacity: 1, x: 0 },
                exit: { opacity: 1, x: -40 },
                transition: spring,
            };
        }
        if (kind === "back") {
            // both move right: enter from x=-40 -> 0, exit 0 -> +40
            return {
                initial: { opacity: 1, x: -40 },
                animate: { opacity: 1, x: 0 },
                exit: { opacity: 1, x: 40 },
                transition: spring,
            };
        }
        if (kind === "fade") {
            return {
                initial: { opacity: 0, x: 0 },
                animate: { opacity: 1, x: 0 },
                exit: { opacity: 0, x: 0 },
                transition: spring,
            };
        }
        // none
        return {
            initial: { opacity: 1, x: 0 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 1, x: 0 },
            transition: spring,
        };
    }, [kind]);

    return (
        <div>
            <AnimatePresence initial={false} mode='wait'>
                <motion.div
                    key={currentKey}
                    {...motionProps}
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
