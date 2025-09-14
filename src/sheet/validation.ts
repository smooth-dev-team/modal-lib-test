import { registry, DEFAULT_PANEL } from "./registry";
import type { ModalId, PanelPath } from "./types";

export const PANEL_PATH_REGEX = /^[a-z0-9\-\/]+$/;

export function isKnownModal(m: string | null): m is ModalId {
    if (!m) return false;
    return (Object.keys(registry) as ModalId[]).includes(m as ModalId);
}

export function isValidPanelString(p: string | null): p is PanelPath {
    if (p === null || p === undefined) return false;
    if (p === "") return true; // empty path allowed (modal root)
    return PANEL_PATH_REGEX.test(p);
}

export function isKnownPanel(m: ModalId, p: string | null): p is PanelPath {
    if (p === null || p === undefined) return false;
    return !!registry[m]?.[p as PanelPath];
}

export function defaultPanelFor(m: ModalId): PanelPath {
    return DEFAULT_PANEL[m];
}

export function sanitizePanelPath(raw: string | null): PanelPath | null {
    return isValidPanelString(raw) ? (raw as PanelPath) : null;
}

// Normalize incoming URL panel param with modal context:
// - Leading '/' is stripped ("/a/b" -> "a/b")
// - Root '/' maps to the modal's default panel
// - Invalid strings become null
export function normalizePanelFor(m: ModalId, raw: string | null): PanelPath | null {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (s === "") return null;
    if (s === "/") return defaultPanelFor(m);
    const noLead = s.startsWith("/") ? s.slice(1) : s;
    return isValidPanelString(noLead) ? (noLead as PanelPath) : null;
}

export function resolveValidState(
    mParam: string | null,
    pParam: string | null
): { modalId: ModalId | null; panelPath: PanelPath | null } {
    if (!isKnownModal(mParam)) return { modalId: null, panelPath: null };
    const modalId = mParam as ModalId;
    const panelFromUrl = normalizePanelFor(modalId, pParam);
    if (panelFromUrl && isKnownPanel(modalId, panelFromUrl)) {
        return { modalId, panelPath: panelFromUrl };
    }
    // Fallback to default panel when p is unknown/invalid
    return { modalId, panelPath: defaultPanelFor(modalId) };
}
