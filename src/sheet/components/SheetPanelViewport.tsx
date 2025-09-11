"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { useSheetUrlState } from "../hooks/useSheetUrlState";
import { determineTransition } from "../utils/navigation";
import { useSheetNavigation } from "../utils/navigation";

export function SheetPanelViewport() {
    const { panelPath, modalId } = useSheetUrlState();
    const nav = useSheetNavigation(modalId ?? undefined);
    const prevRef = useRef<string | null>(null);

    const prev = prevRef.current;
    const next = panelPath ?? null;
    const kind = useMemo(() => determineTransition(prev, next), [prev, next]);

    useEffect(() => {
        prevRef.current = next;
    }, [next]);

    const direction = useMemo(() => {
        if (kind === "forward") return 1; // move left
        if (kind === "back") return -1; // move right
        return 0; // fade/none
    }, [kind]);

    const slideVariants = useMemo(
        () => ({
            enter: (dir: number) => {
                if (dir === 0) return { opacity: 0, x: 0 };
                return { x: dir > 0 ? 60 : -60, opacity: 0 };
            },
            center: () => ({ x: 0, opacity: 1, zIndex: 1 }),
            exit: (dir: number) => {
                if (dir === 0) return { opacity: 0, x: 0 };
                return { x: dir > 0 ? -60 : 60, opacity: 0, zIndex: 0 };
            },
        }),
        []
    );

    const currentKey = panelPath ?? "__none__";

    // Gesture: horizontal drag to back/forward, only confirmed on release
    const onDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
        const distance = info.offset.x;
        const velocity = info.velocity.x;
        const distThresh = 80; // could externalize
        const velThresh = 0.35;
        // Swipe right => back
        if (distance > distThresh || velocity > velThresh) {
            if (nav.canGoBack()) nav.goBack();
            return;
        }
        // Swipe left => forward
        if (distance < -distThresh || velocity < -velThresh) {
            if (nav.canGoForward()) nav.goForward();
        }
    };

    const transition = { type: "spring", stiffness: 400, damping: 34 } as const;

    return (
        <div>
            <AnimatePresence initial={false} mode='wait' custom={direction}>
                <motion.div
                    key={currentKey}
                    custom={direction}
                    variants={slideVariants}
                    initial='enter'
                    animate='center'
                    exit='exit'
                    transition={transition}
                    drag='x'
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={onDragEnd}
                    style={{
                        border: "1px dashed #ccc",
                        borderRadius: 8,
                        padding: 12,
                        background: "#fafafa",
                        touchAction: "pan-y",
                    }}>
                    <div style={{ fontSize: 12, color: "#666" }}>Panel</div>
                    <div style={{ marginTop: 4, fontWeight: 600 }}>{panelPath ?? "(null)"}</div>
                    <div style={{ marginTop: 6, fontSize: 11, color: "#888" }}>
                        kind: {kind} dir:{direction}
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
