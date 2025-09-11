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
        if (kind === "forward") return 1; // slide left
        if (kind === "back") return -1; // slide right
        return 1; // default slide left
    }, [kind]);

    const slideVariants = useMemo(
        () => ({
            enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%" }),
            center: () => ({ x: 0 }),
            exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%" }),
        }),
        []
    );

    const currentKey = panelPath ?? "__none__";

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

    return (
        <div style={{ position: "relative", overflow: "hidden", width: "100%", height: "100%" }}>
            <AnimatePresence initial={false} custom={direction}>
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
                        Lorem ipsum dolor sit amet consectetur adipisicing elit. Odit, repudiandae
                        doloremque! Laboriosam necessitatibus ratione doloribus a ut quo! Magnam
                        odit facilis sequi exercitationem eligendi laudantium voluptates neque
                        voluptas expedita earum tempora velit porro, eaque assumenda animi omnis
                        explicabo perspiciatis. Et, repudiandae modi placeat quasi alias voluptatum
                        ipsa voluptatibus ex. Fugit accusamus eum quis accusantium vero omnis
                        possimus nesciunt laborum labore, fuga porro voluptas, aspernatur nihil
                        libero saepe provident voluptate numquam! Voluptatum perspiciatis similique
                        harum distinctio culpa sequi! Molestiae adipisci, quibusdam magni qui quos
                        nemo, in quia, aliquid ab alias tempore expedita veniam? Enim eaque vel
                        corrupti, blanditiis sed nobis tenetur.
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
