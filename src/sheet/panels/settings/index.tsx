"use client";

import React, { useEffect, useState } from "react";

type Todo = {
    userId: number;
    id: number;
    title: string;
    completed: boolean;
};

export default function SettingsRoot() {
    const [data, setData] = useState<Todo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const ac = new AbortController();
        setLoading(true);
        setError(null);
        fetch("https://jsonplaceholder.typicode.com/todos/1", { signal: ac.signal })
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((json: Todo) => setData(json))
            .catch((e) => {
                if (e.name !== "AbortError") setError(String(e.message || e));
            })
            .finally(() => setLoading(false));
        return () => ac.abort();
    }, []);

    return (
        <div style={{ padding: 12, display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Settings (root)</div>

            {loading && (
                <div
                    style={{
                        padding: 12,
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        background: "#fafafa",
                    }}>
                    Loading sample data…
                </div>
            )}

            {error && (
                <div
                    style={{
                        padding: 12,
                        border: "1px solid #fecaca",
                        color: "#991b1b",
                        background: "#fef2f2",
                        borderRadius: 8,
                    }}>
                    Failed to load: {error}
                </div>
            )}

            {data && (
                <div
                    style={{
                        padding: 12,
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        background: "#fff",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    }}>
                    <div style={{ fontSize: 14, color: "#374151", marginBottom: 8 }}>
                        Fetched from jsonplaceholder.typicode.com/todos/1
                    </div>
                    <div style={{ display: "grid", gap: 4, fontSize: 14 }}>
                        <div>
                            <b>userId:</b> {data.userId}
                        </div>
                        <div>
                            <b>id:</b> {data.id}
                        </div>
                        <div>
                            <b>title:</b> {data.title}
                        </div>
                        <div>
                            <b>completed:</b> {String(data.completed)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
