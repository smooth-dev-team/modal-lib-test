"use client";

import { useSheetUrlState } from "../hooks/useSheetUrlState";
import { useSheetNavigation, describeTransition } from "../utils/navigation";
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
                <button onClick={() => setModalPanel("settings", "/")}>
                    Open settings (root) (push)
                </button>
                <button onClick={() => setModalPanel("dashboard", "/")}>
                    Open settings (root) (push)
                </button>
                <button onClick={() => setModalPanel("test", "/")}>
                    Open settings (root) (push)
                </button>
                <button onClick={() => nav.goPanel("/a")} disabled={!modalId}>
                    Go a (push)
                </button>
                <button onClick={() => nav.goPanel("/a/b")} disabled={!modalId}>
                    Go a/b (push)
                </button>
                <button onClick={() => nav.goPanel("/a/c")} disabled={!modalId}>
                    Go a/c (push)
                </button>
                <button onClick={() => nav.goPanel("/d")} disabled={!modalId}>
                    Go d (push)
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
            {panelPath && (
                <div
                    style={{
                        marginTop: 8,
                        fontSize: 12,
                        whiteSpace: "pre-wrap",
                        background: "#f6f8fa",
                        padding: 8,
                        borderRadius: 6,
                    }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        Sample transitions (root/a/b/c/d tree)
                    </div>
                    <div>{describeTransition(panelPath, "a")}</div>
                    <hr />
                    <div>{describeTransition(panelPath, "a/b")}</div>
                    <hr />
                    <div>{describeTransition("a/b", "d")}</div>
                    <hr />
                    <div>{describeTransition("a/b", "")}</div>
                </div>
            )}
        </div>
    );
}
