import { SHEET_CACHE } from "../constants";

type Entry = React.ReactNode;

class PanelCacheLRU {
    private map = new Map<string, Entry>();
    constructor(private limit: number) {}
    get(key: string) {
        const v = this.map.get(key);
        if (v !== undefined) {
            this.map.delete(key); // refresh recency
            this.map.set(key, v);
        }
        return v;
    }
    set(key: string, value: Entry) {
        if (this.map.has(key)) this.map.delete(key);
        this.map.set(key, value);
        if (this.map.size > this.limit) {
            const oldest = this.map.keys().next().value;
            if (oldest !== undefined) this.map.delete(oldest);
        }
    }
    has(key: string) {
        return this.map.has(key);
    }
    keys(): string[] {
        return Array.from(this.map.keys());
    }
}

const singleton = new PanelCacheLRU(SHEET_CACHE.keepAlivePanels);

export function cachePanel(path: string, node: React.ReactNode) {
    singleton.set(path, node);
}
export function getCachedPanel(path: string) {
    return singleton.get(path);
}
export function hasCachedPanel(path: string) {
    return singleton.has(path);
}
export function listCachedPanelKeys(): string[] {
    return singleton.keys();
}
