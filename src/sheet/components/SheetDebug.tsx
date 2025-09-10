"use client";

import { useSheetUrlState } from "../hooks/useSheetUrlState";
import { useSheetNavigation } from "../utils/navigation";
import { useSheetHistory } from "../hooks/useSheetHistory";

export function SheetDebug() {
    const { modalId, panelPath, setModalPanel, replaceModalPanel } = useSheetUrlState();
    const nav = useSheetNavigation(modalId ?? undefined);
    const hist = useSheetHistory(modalId ?? undefined);

    return (
        <div
            style={{
                padding: 16,
                border: "1px solid #ddd",
                borderRadius: 8,
                background: "#fff",
                position: "fixed",
                left: 24,
                top: 24,
                zIndex: 1100,
            }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Sheet Debug</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setModalPanel("settings", "main")}>
                    Open settings/main (push)
                </button>
                <button onClick={() => nav.goPanel("profile")} disabled={!modalId}>
                    Go profile (push)
                </button>
                <button onClick={() => nav.goPanel("profile/address")} disabled={!modalId}>
                    Go address (push)
                </button>
                <button onClick={() => nav.closeSheet()} disabled={!modalId}>
                    Close (back or replace)
                </button>
                <button onClick={() => nav.closeSheet({ hard: true })} disabled={!modalId}>
                    Hard Close (replace + clear history)
                </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>
                m: <b>{modalId ?? "(null)"}</b> / p: <b>{panelPath ?? "(null)"}</b> | canBack:{" "}
                {String(nav.canGoBack())} | canFwd: {String(nav.canGoForward())}
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button onClick={() => nav.goBack()} disabled={!nav.canGoBack()}>
                    Back
                </button>
                <button onClick={() => nav.goForward()} disabled={!nav.canGoForward()}>
                    Forward
                </button>
                <button onClick={() => replaceModalPanel(null)} disabled={!modalId}>
                    Replace → base URL (keep history)
                </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12 }}>
                history: {JSON.stringify(hist.history)}
            </div>
        </div>
    );
}
