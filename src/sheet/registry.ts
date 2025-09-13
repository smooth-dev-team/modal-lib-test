// AUTO-GENERATED FILE. DO NOT EDIT.
// Run: pnpm gen:panels
import type { PanelRegistry, ModalId, PanelPath } from "./types";

export const DEFAULT_PANEL: Record<ModalId, PanelPath> = {
  "dashboard": "",
  "settings": "",
};

export const registry: PanelRegistry = {
  "dashboard": {
    "": { import: () => import("./panels/dashboard"), depth: 0 },
  },
  "settings": {
    "": { import: () => import("./panels/settings"), depth: 0 },
    "a": { import: () => import("./panels/settings/a"), depth: 0 },
    "a/b": { import: () => import("./panels/settings/a/b"), depth: 1 },
    "a/c": { import: () => import("./panels/settings/a/c"), depth: 1 },
    "d": { import: () => import("./panels/settings/d"), depth: 0 },
  },
};
