import React, { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { registry } from "../registry";
import { cachePanel } from "../utils/panelCache";
import type { ModalId, PanelPath, PanelRegistry } from "../types";

export type Loaded = { key: PanelPath; Comp: ComponentType<unknown> } | null;

/**
 * Load current panel component via registry (CSR) and provide a render node.
 * - Suppresses fallback while a bridge is active to avoid flashes.
 * - Caches the real component once loaded for peeks.
 */
export function usePanelLoader(
    modalId: ModalId | null | undefined,
    panelPath: PanelPath | null,
    suppressFallback: boolean
) {
    const [loaded, setLoaded] = useState<Loaded>(null);

    useEffect(() => {
        let cancelled = false;
        setLoaded((prev) => (prev?.key === (panelPath ?? "") ? prev : null));
        if (!modalId || panelPath == null) return;
        const m: ModalId = modalId as ModalId;
        const p: PanelPath = panelPath as PanelPath;
        const def = (registry as PanelRegistry)[m]?.[p];
        if (!def) return;
        def.import()
            .then((mod: { default: ComponentType<unknown> }) => {
                if (!cancelled) setLoaded({ key: p, Comp: mod.default });
            })
            .catch(() => {
                if (!cancelled) setLoaded(null);
            });
        return () => {
            cancelled = true;
        };
    }, [modalId, panelPath]);

    const isCurrentNodeRealComp = useMemo(() => {
        return !!(loaded && panelPath != null && loaded.key === panelPath);
    }, [loaded, panelPath]);

    const currentNode = useMemo(() => {
        if (isCurrentNodeRealComp) {
            const C = (loaded as NonNullable<Loaded>).Comp;
            return React.createElement(C);
        }
        if (suppressFallback) return null;
        const def =
            modalId && panelPath != null
                ? (registry as PanelRegistry)[modalId as ModalId]?.[panelPath as PanelPath]
                : undefined;
        if (def?.fallback) return def.fallback as React.ReactNode;
        return null;
    }, [isCurrentNodeRealComp, loaded, modalId, panelPath, suppressFallback]);

    useEffect(() => {
        if (panelPath == null || !isCurrentNodeRealComp || !currentNode) return;
        cachePanel(panelPath, currentNode);
    }, [panelPath, isCurrentNodeRealComp, currentNode]);

    return { currentNode, isCurrentNodeRealComp, loaded } as const;
}
