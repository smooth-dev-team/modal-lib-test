import type { ComponentType } from "react";
import type { PanelRegistry, PanelDef, ModalId, PanelPath } from "./types";

// Placeholder typed component for early scaffolding; replace with real dynamic imports.
const Placeholder: ComponentType<unknown> = () => null;

const makePanel = (depth: number): PanelDef => ({
    import: async () => ({ default: Placeholder }),
    depth,
    neighbors: [],
    guard: () => true,
    fallback: null,
});

export const DEFAULT_PANEL: Record<ModalId, PanelPath> = {
    settings: "main",
    dashboard: "insights",
};

export const registry: PanelRegistry = {
    settings: {
        main: makePanel(0),
        profile: makePanel(1),
        "profile/address": makePanel(2),
    },
    dashboard: {
        insights: makePanel(0),
    },
};
