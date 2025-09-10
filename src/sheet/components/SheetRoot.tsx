"use client";

import { useEffect } from "react";
import { useSheetUrlState } from "../hooks/useSheetUrlState";
import { useSheetNavigation } from "../utils/navigation";

export function SheetRoot() {
    const { modalId } = useSheetUrlState();
    const nav = useSheetNavigation(modalId ?? undefined);

    // Basic Esc to close
    useEffect(() => {
        if (!modalId) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") nav.closeSheet({ hard: true });
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [modalId, nav]);

    if (!modalId) return null;

    return (
        <div aria-hidden={false} style={{ position: "fixed", inset: 0, zIndex: 1010 }}>
            {/* Overlay */}
            <div
                onClick={() => nav.closeSheet({ hard: true })}
                style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }}
            />
            {/* Sheet body */}
            <div
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
                }}>
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
                    {/* Panel viewport placeholder; will be replaced with Motion */}
                    <PanelViewportPlaceholder />
                </div>
            </div>
        </div>
    );
}

function PanelViewportPlaceholder() {
    const { panelPath } = useSheetUrlState();
    return (
        <div style={{ padding: 12, border: "1px dashed #ccc", borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: "#666" }}>Panel content placeholder</div>
            <div style={{ marginTop: 4 }}>panel: {panelPath ?? "(null)"}</div>
        </div>
    );
}
