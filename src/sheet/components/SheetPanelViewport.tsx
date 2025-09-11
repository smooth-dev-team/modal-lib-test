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
    // prevRef を次レンダー用に更新（kind 計算後 / 変化検知前の値を保持）
    useEffect(() => {
        prevRef.current = next;
    }, [next]);

    const direction = useMemo(() => {
        if (kind === "forward") return 1; // slide left
        if (kind === "back") return -1; // slide right
        return 0; // fade
    }, [kind]);

    const currentKey = panelPath ?? "__none__";

    // 統一 variants （fade / slide を custom meta で分岐）
    type Meta = { mode: "fade" | "slide"; dir: number };
    const variants = {
        enter: ({ mode, dir }: Meta) =>
            mode === "fade" ? { opacity: 0, x: 0 } : { opacity: 1, x: dir > 0 ? "100%" : "-100%" },
        center: { opacity: 1, x: 0 },
        exit: ({ mode, dir }: Meta) =>
            mode === "fade" ? { opacity: 0, x: 0 } : { opacity: 1, x: dir > 0 ? "-100%" : "100%" },
    } as const;
    const meta: Meta = { mode: kind === "fade" ? "fade" : "slide", dir: direction };

    // Gesture: horizontal drag to back/forward, only confirmed on release
    const onDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
        const distance = info.offset.x;
        const velocity = info.velocity.x;
        const distThresh = 80;
        const velThresh = 0.35;
        if (distance > distThresh || velocity > velThresh) {
            if (nav.canGoBack()) nav.goBack();
            return;
        }
        if (distance < -distThresh || velocity < -velThresh) {
            if (nav.canGoForward()) nav.goForward();
        }
    };

    const transition = { type: "spring", stiffness: 400, damping: 34 } as const;

    // 単一ルート：AnimatePresence が exit 中は旧 DOM を保持するので結果的に 2 枚同時表示されるが、記述は 1 つで済む
    return (
        <div style={{ position: "relative", overflow: "hidden", width: "100%", height: "100%" }}>
            <AnimatePresence initial={false} custom={meta}>
                <motion.div
                    key={currentKey}
                    custom={meta}
                    variants={variants}
                    initial='enter'
                    animate='center'
                    exit='exit'
                    transition={transition}
                    drag='x'
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={1}
                    onDragEnd={onDragEnd}
                    style={{
                        border: "1px dashed #ccc",
                        borderRadius: 8,
                        padding: 12,
                        background: "#fafafa",
                        touchAction: "pan-y",
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        willChange: "transform",
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
