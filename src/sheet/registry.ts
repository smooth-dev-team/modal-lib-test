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
        // Sample tree panels for validation
        main: makePanel(0),
        "main/a": makePanel(1),
        "main/a/b": makePanel(2),
        "main/a/c": makePanel(2),
        "main/d": makePanel(1),
    },
    dashboard: {
        insights: makePanel(0),
    },
};
