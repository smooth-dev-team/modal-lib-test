"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { defaultPanelFor, isKnownModal, normalizePanelFor } from "../validation";
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

// --- Utility helpers for panel path / history transitions
export function splitPanelPath(p: PanelPath): string[] {
    if (!p) return [];
    return p.split("/").filter(Boolean);
}

/**
 * Build the history stack for a jump to `p`.
 * Example: 'main/a/b' -> ['main', 'main/a', 'main/a/b']
 */
export function buildStackFromPath(p: PanelPath): PanelPath[] {
    const segs = splitPanelPath(p);
    const out: PanelPath[] = [];
    for (let i = 0; i < segs.length; i++) {
        out.push(segs.slice(0, i + 1).join("/"));
    }
    if (out.length === 0 && p === "") return [""];
    return out;
}

export type TransitionKind = "back" | "forward" | "fade" | "none";

/**
 * Determine transition direction between two panel paths following rules:
 * - If `next` is a prefix of `prev` (can be reached by popping segments from prev) => back
 * - Else if `prev` is a prefix of `next` (can be reached by popping segments from next) => forward
 * - Else => fade
 */
export function determineTransition(
    prev: PanelPath | null,
    next: PanelPath | null
): TransitionKind {
    if (prev == null || next == null) return "none";
    if (prev === next) return "none";
    const prevSeg = splitPanelPath(prev);
    const nextSeg = splitPanelPath(next);
    const nextIsPrefixOfPrev =
        nextSeg.length <= prevSeg.length &&
        prevSeg.slice(0, nextSeg.length).join("/") === nextSeg.join("/");
    if (nextIsPrefixOfPrev) return "back";
    const prevIsPrefixOfNext =
        prevSeg.length <= nextSeg.length &&
        nextSeg.slice(0, prevSeg.length).join("/") === prevSeg.join("/");
    if (prevIsPrefixOfNext) return "forward";
    return "fade";
}

export function describeTransition(prev: PanelPath | null, next: PanelPath | null): string {
    const kind = determineTransition(prev, next);
    return [
        `From: "${prev ?? "(null)"}"`,
        `To:   "${next ?? "(null)"}"`,
        `Transition kind: ${kind}`,
    ].join("\n");
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
        (m: ModalId | null, p: PanelPath | null | "/") => {
            const sp = new URLSearchParams(searchParams.toString());
            if (m) {
                sp.set("m", m);
                const normalized = normalizePanelFor(m, p as string | null);
                const toWrite = normalized ?? defaultPanelFor(m);
                sp.set("p", toWrite === "" ? "" : toWrite);
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

    // Jump: rebuild stack to the full path segments and move cursor to last
    const jumpTo = useCallback(
        (p: PanelPath | "/") => {
            const m = effectiveModal;
            if (!m) return;
            const norm = normalizePanelFor(m, p as string);
            if (!norm) return;
            const base = defaultPanelFor(m);
            const stack = buildStackFromPath(norm);
            // Ensure root "" stays at the bottom when default panel is empty
            if (base === "" && stack[0] !== "") {
                stack.unshift("");
            }
            const next: HistoryState = { stack, cursor: stack.length - 1 };
            try {
                sessionStorage.setItem(HISTORY_KEY_PREFIX + m, JSON.stringify(next));
            } catch {}
            router.push(makeUrl(m, norm), { scroll: false });
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

    // Step back/forward operate within the current stack by cursor movement
    const goBack = useCallback(() => {
        const m = effectiveModal;
        if (!m) return;
        const h = readHistory(m);
        if (!h || h.cursor <= 0) return;
        const nextCursor = h.cursor - 1;
        const target = h.stack[nextCursor];
        try {
            sessionStorage.setItem(
                HISTORY_KEY_PREFIX + m,
                JSON.stringify({ stack: h.stack, cursor: nextCursor })
            );
        } catch {}
        router.push(makeUrl(m, target), { scroll: false });
    }, [effectiveModal, makeUrl, router]);

    const goForward = useCallback(() => {
        const m = effectiveModal;
        if (!m) return;
        const h = readHistory(m);
        if (!h || h.cursor >= h.stack.length - 1) return;
        const nextCursor = h.cursor + 1;
        const target = h.stack[nextCursor];
        try {
            sessionStorage.setItem(
                HISTORY_KEY_PREFIX + m,
                JSON.stringify({ stack: h.stack, cursor: nextCursor })
            );
        } catch {}
        router.push(makeUrl(m, target), { scroll: false });
    }, [effectiveModal, makeUrl, router]);

    return {
        openSheet,
        closeSheet,
        goPanel: jumpTo,
        jumpTo,
        canGoBack,
        canGoForward,
        goBack,
        goForward,
        panelDepth,
        describeTransition,
        determineTransition,
    };
}
