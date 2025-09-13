#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";

const ROOT = process.cwd();
const DEFAULT_BASE_DIR = path.join("src", "sheet", "panels");
const REGISTRY_OUT = path.join("src", "sheet", "registry.ts");
const CONFIG_PATH = path.join("src", "sheet", "panels.config.json");

async function fileExists(p) {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

async function readConfig() {
    const cfgAbs = path.join(ROOT, CONFIG_PATH);
    if (!(await fileExists(cfgAbs))) {
        return { baseDir: DEFAULT_BASE_DIR, defaults: {} };
    }
    const raw = await fs.readFile(cfgAbs, "utf8");
    const cfg = JSON.parse(raw);
    return { baseDir: cfg.baseDir || DEFAULT_BASE_DIR, defaults: cfg.defaults || {} };
}

async function listDirs(absDir) {
    const entries = await fs.readdir(absDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function walkIndexTsx(absDir) {
    const out = [];
    async function walk(current) {
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const ent of entries) {
            const abs = path.join(current, ent.name);
            if (ent.isDirectory()) {
                await walk(abs);
            } else if (ent.isFile() && ent.name === "index.tsx") {
                out.push(abs);
            }
        }
    }
    await walk(absDir);
    return out;
}

function toPanelPath(modalId, absIndexPath, baseAbs) {
    const relDir = path.relative(path.join(baseAbs, modalId), path.dirname(absIndexPath));
    const segs = relDir.split(path.sep).filter(Boolean);
    if (segs.length === 0) {
        // root-level index.tsx -> represent as empty path "" (modal root)
        return "";
    }
    return segs.join("/");
}

function depthFromPanelPath(panelPath) {
    const segs = panelPath.split("/").filter(Boolean);
    return Math.max(0, segs.length - 1);
}

async function main() {
    const { baseDir, defaults } = await readConfig();
    const baseAbs = path.join(ROOT, baseDir);
    if (!(await fileExists(baseAbs))) {
        console.error(`[gen] baseDir not found: ${baseAbs}`);
        process.exit(1);
    }
    const modalIds = await listDirs(baseAbs);
    const registry = {};
    const defaultPanelMap = {};

    for (const modalId of modalIds) {
        const modalAbs = path.join(baseAbs, modalId);
        const indexFiles = await walkIndexTsx(modalAbs);
        // Build entries with correct import path and de-duplicate by panelPath.
        const byPath = new Map();
        for (const file of indexFiles) {
            const relDir = path.relative(path.join(baseAbs, modalId), path.dirname(file));
            const isRoot = relDir === "";
            const p = toPanelPath(modalId, file, baseAbs);
            const importRel = isRoot ? `./panels/${modalId}` : `./panels/${modalId}/${p}`;
            const entry = { panelPath: p, importRel, depth: depthFromPanelPath(p), isRoot };
            if (byPath.has(p)) {
                const existing = byPath.get(p);
                // Prefer explicit subdir over root mapping
                if (existing.isRoot && !isRoot) {
                    byPath.set(p, entry);
                }
            } else {
                byPath.set(p, entry);
            }
        }
        const panels = Array.from(byPath.values()).sort((a, b) =>
            a.panelPath.localeCompare(b.panelPath)
        );
        registry[modalId] = panels;
        // default panel: prefer root ("") if present, else configured, else first
        const hasRoot = panels.some((p) => p.panelPath === "");
        if (hasRoot) {
            defaultPanelMap[modalId] = "";
        } else if (defaults[modalId]) {
            defaultPanelMap[modalId] = defaults[modalId];
        } else {
            defaultPanelMap[modalId] = panels[0]?.panelPath || "";
        }
    }

    const lines = [];
    lines.push("// AUTO-GENERATED FILE. DO NOT EDIT.");
    lines.push("// Run: pnpm gen:panels");
    lines.push('import type { PanelRegistry, ModalId, PanelPath } from "./types";');
    lines.push("");
    lines.push("export const DEFAULT_PANEL: Record<ModalId, PanelPath> = {);");
    // We'll fix this after building entries
    const defaultEntries = Object.entries(defaultPanelMap)
        .map(([m, p]) => `  ${JSON.stringify(m)}: ${JSON.stringify(p)},`)
        .join("\n");
    lines[lines.length - 1] =
        "export const DEFAULT_PANEL: Record<ModalId, PanelPath> = {\n" + defaultEntries + "\n};";
    lines.push("");
    lines.push("export const registry: PanelRegistry = {");
    for (const [modalId, panels] of Object.entries(registry)) {
        lines.push(`  ${JSON.stringify(modalId)}: {`);
        for (const p of panels) {
            lines.push(
                `    ${JSON.stringify(p.panelPath)}: { import: () => import(${JSON.stringify(
                    p.importRel
                )}), depth: ${p.depth} },`
            );
        }
        lines.push("  },");
    }
    lines.push("};");

    const outAbs = path.join(ROOT, REGISTRY_OUT);
    await fs.writeFile(outAbs, lines.join("\n") + "\n", "utf8");
    console.log(`[gen] Wrote registry: ${outAbs}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
