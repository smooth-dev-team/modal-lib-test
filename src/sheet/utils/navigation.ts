"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { defaultPanelFor, isKnownModal } from "../validation";
import type { ModalId, PanelPath } from "../types";
import { registry } from "../registry";

const HISTORY_KEY_PREFIX = "sheet:";

type HistoryState = { stack: PanelPath[]; cursor: number };

function readHistory(modalId: ModalId): HistoryState | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem(HISTORY_KEY_PREFIX + modalId);
        if (!raw) return null;
        return JSON.parse(raw) as HistoryState;
    } catch {
        return null;
    }
}

function clearHistory(modalId: ModalId) {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.removeItem(HISTORY_KEY_PREFIX + modalId);
    } catch {}
}

export function panelDepth(p: PanelPath): number {
    // Prefer registry depth if known, else derive by segment count
    for (const m of Object.keys(registry) as ModalId[]) {
        const def = registry[m][p as PanelPath];
        if (def) return def.depth;
    }
    return p.split("/").filter(Boolean).length;
}

export function useSheetNavigation(modalId?: ModalId) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const currentModal: ModalId | null = useMemo(() => {
        const m = searchParams.get("m");
        return isKnownModal(m) ? (m as ModalId) : null;
    }, [searchParams]);

    const effectiveModal = modalId ?? currentModal;

    const makeUrl = useCallback(
        (m: ModalId | null, p: PanelPath | null) => {
            const sp = new URLSearchParams(searchParams.toString());
            if (m) {
                sp.set("m", m);
                sp.set("p", p ?? defaultPanelFor(m));
            } else {
                sp.delete("m");
                sp.delete("p");
            }
            const qs = sp.toString();
            return qs ? `${pathname}?${qs}` : pathname;
        },
        [pathname, searchParams]
    );

    const openSheet = useCallback(
        (m: ModalId, p?: PanelPath) => {
            router.push(makeUrl(m, p ?? defaultPanelFor(m)), { scroll: false });
        },
        [makeUrl, router]
    );

    const goPanel = useCallback(
        (p: PanelPath) => {
            const m = effectiveModal;
            if (!m) return;
            router.push(makeUrl(m, p), { scroll: false });
        },
        [effectiveModal, makeUrl, router]
    );

    const shouldReplaceForDirectLink = useCallback(() => {
        const m = effectiveModal;
        if (!m || typeof window === "undefined") return false;
        const h = readHistory(m);
        const noInternalHistory = !h || h.stack.length === 0;
        let sameOriginRef = false;
        try {
            const ref = document.referrer;
            sameOriginRef = !!ref && new URL(ref).origin === window.location.origin;
        } catch {
            sameOriginRef = false;
        }
        // If no internal history and referrer is not same-origin, treat as direct link
        return noInternalHistory && !sameOriginRef;
    }, [effectiveModal]);

    const closeSheet = useCallback(
        (opts?: { hard?: boolean }) => {
            const hard = !!opts?.hard;
            const m = effectiveModal;
            if (hard && m) {
                // Hard-close: clear history and replace to base URL
                clearHistory(m);
                router.replace(pathname, { scroll: false });
                return;
            }
            if (shouldReplaceForDirectLink()) {
                router.replace(pathname, { scroll: false });
                return;
            }
            router.back();
        },
        [effectiveModal, pathname, router, shouldReplaceForDirectLink]
    );

    const canGoBack = useCallback(() => {
        const m = effectiveModal;
        if (!m) return false;
        const h = readHistory(m);
        return !!h && h.cursor > 0;
    }, [effectiveModal]);

    const canGoForward = useCallback(() => {
        const m = effectiveModal;
        if (!m) return false;
        const h = readHistory(m);
        return !!h && h.cursor < h.stack.length - 1;
    }, [effectiveModal]);

    const goBack = useCallback(() => router.back(), [router]);
    const goForward = useCallback(() => window.history.forward(), []);

    return {
        openSheet,
        closeSheet,
        goPanel,
        canGoBack,
        canGoForward,
        goBack,
        goForward,
        panelDepth,
    };
}
