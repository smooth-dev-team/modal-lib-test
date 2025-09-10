"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ModalId, PanelPath, SheetHistory } from "../types";
import { isKnownModal, defaultPanelFor } from "../validation";

const KEY = (m: ModalId) => `sheet:${m}`;

function read(modalId: ModalId): SheetHistory | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem(KEY(modalId));
        return raw ? (JSON.parse(raw) as SheetHistory) : null;
    } catch {
        return null;
    }
}

function write(modalId: ModalId, h: SheetHistory) {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(KEY(modalId), JSON.stringify(h));
    } catch {}
}

function reset(modalId: ModalId, currentP: PanelPath): SheetHistory {
    const next: SheetHistory = { stack: [currentP], cursor: 0 };
    write(modalId, next);
    return next;
}

export function useSheetHistory(modalId?: ModalId) {
    const sp = useSearchParams();
    const mParam = sp.get("m");
    const pParam = sp.get("p");

    const activeModal: ModalId | null = useMemo(
        () => (isKnownModal(mParam) ? (mParam as ModalId) : null),
        [mParam]
    );

    const effectiveModal = modalId ?? activeModal;
    const effectivePanel: PanelPath | null = useMemo(() => {
        if (!effectiveModal) return null;
        return (pParam as PanelPath) || defaultPanelFor(effectiveModal);
    }, [effectiveModal, pParam]);

    const popStateFlag = useRef(false);
    const prevPanelRef = useRef<PanelPath | null>(null);
    const [state, setState] = useState<SheetHistory | null>(null);

    // Initialize or update on modal/panel changes
    useEffect(() => {
        if (!effectiveModal || !effectivePanel) return;
        const current = read(effectiveModal);
        // First-time or after reload: reset to only current panel
        if (!current) {
            setState(reset(effectiveModal, effectivePanel));
            prevPanelRef.current = effectivePanel;
            return;
        }

        // If this change was caused by a popstate, sync cursor to existing entry
        if (popStateFlag.current) {
            popStateFlag.current = false;
            const i = current.stack.indexOf(effectivePanel);
            if (i >= 0) {
                const next = { stack: current.stack, cursor: i };
                write(effectiveModal, next);
                setState(next);
                prevPanelRef.current = effectivePanel;
                return;
            }
            // Not found -> treat like push (rare, but keeps UI coherent)
        }

        // Push semantics: append new panel, truncate forward
        if (prevPanelRef.current !== effectivePanel) {
            const base = current.stack.slice(0, Math.max(0, current.cursor + 1));
            const newStack = [...base, effectivePanel];
            const next = { stack: newStack, cursor: newStack.length - 1 };
            write(effectiveModal, next);
            setState(next);
            prevPanelRef.current = effectivePanel;
        }
    }, [effectiveModal, effectivePanel]);

    // Listen for back/forward (popstate)
    useEffect(() => {
        const onPop = () => {
            popStateFlag.current = true;
        };
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);

    const canGoBack = useMemo(() => !!state && state.cursor > 0, [state]);
    const canGoForward = useMemo(() => !!state && state.cursor < state.stack.length - 1, [state]);

    const clear = useCallback(() => {
        if (!effectiveModal || !effectivePanel) return;
        setState(reset(effectiveModal, effectivePanel));
    }, [effectiveModal, effectivePanel]);

    return {
        history: state,
        canGoBack,
        canGoForward,
        clear,
    };
}
