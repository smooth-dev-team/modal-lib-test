import type { ComponentType, ReactNode } from "react";
export type ModalId = "settings" | "dashboard"; // v1 modal ids

// Accepts kebab/slug segment(s) separated by '/'
export type PanelPath = string; // e.g. 'main' | 'profile' | 'profile/address'

export type PanelDef = {
    import: () => Promise<{ default: ComponentType<unknown> }>;
    depth: number;
    neighbors?: PanelPath[];
    guard?: () => boolean;
    fallback?: ReactNode;
};

export type PanelRegistry = Record<ModalId, Record<PanelPath, PanelDef>>;

export type SheetHistory = {
    stack: PanelPath[];
    cursor: number;
};
