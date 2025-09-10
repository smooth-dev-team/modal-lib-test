"use client";

import { useMemo, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { resolveValidState, isKnownModal, defaultPanelFor } from "../validation";
import type { ModalId, PanelPath } from "../types";

type UrlState = {
    modalId: ModalId | null;
    panelPath: PanelPath | null;
    setModalPanel: (m: ModalId, p?: PanelPath) => void;
    replaceModalPanel: (m: ModalId | null, p?: PanelPath | null) => void;
};

export function useSheetUrlState(): UrlState {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const mParam = searchParams.get("m");
    const pParam = searchParams.get("p");

    const { modalId, panelPath } = useMemo(
        () => resolveValidState(mParam, pParam),
        [mParam, pParam]
    );

    const buildQuery = useCallback(
        (nextM: ModalId | null, nextP: PanelPath | null) => {
            const sp = new URLSearchParams(searchParams.toString());
            if (nextM) {
                sp.set("m", nextM);
                sp.set("p", nextP ?? defaultPanelFor(nextM));
            } else {
                sp.delete("m");
                sp.delete("p");
            }
            return `${pathname}?${sp.toString()}`;
        },
        [pathname, searchParams]
    );

    const setModalPanel = useCallback(
        (m: ModalId, p?: PanelPath) => {
            const url = buildQuery(m, p ?? defaultPanelFor(m));
            // App Router ignores "shallow"; we pass scroll: false per spec intent
            router.push(url, { scroll: false });
        },
        [buildQuery, router]
    );

    const replaceModalPanel = useCallback(
        (m: ModalId | null, p?: PanelPath | null) => {
            const url = buildQuery(m, (m && (p ?? defaultPanelFor(m))) || null);
            router.replace(url, { scroll: false });
        },
        [buildQuery, router]
    );

    return { modalId, panelPath, setModalPanel, replaceModalPanel };
}

export function sheetIsOpen(): boolean {
    if (typeof window === "undefined") return false;
    const sp = new URLSearchParams(window.location.search);
    const m = sp.get("m");
    return isKnownModal(m);
}
