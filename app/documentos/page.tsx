"use client";

import { useState, useEffect, useCallback } from "react";
import { SOURCE_REGISTRY } from "@/lib/sourceRegistry";

interface Item {
    id: string;
    source: string;
    title: string;
    url: string;
    published: string;
    impacto: string | null;
    tema: string | null;
    tipo: string | null;
}

export default function DocumentosPage() {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterSource, setFilterSource] = useState("");

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            // Usamos el listado simple de items por ahora
            const res = await fetch("/api/items");
            const data = await res.json();
            if (Array.isArray(data)) {
                setItems(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    const filtered = items.filter(it => {
        const matchesSearch = it.title.toLowerCase().includes(search.toLowerCase());
        const matchesSource = !filterSource || it.source.toUpperCase() === filterSource.toUpperCase();
        return matchesSearch && matchesSource;
    });

    const formatDate = (d: string) => {
        return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(d));
    };

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>Base de Datos Jurídica</h1>
                    <p className="subtitle">{filtered.length} items encontrados</p>
                </div>
            </div>

            <div className="search-bar" style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                <input
                    placeholder="Buscar por título..."
                    style={{ flex: 1 }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <select
                    value={filterSource}
                    onChange={(e) => setFilterSource(e.target.value)}
                    style={{ width: 180, background: "var(--card-bg)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "0 10px" }}
                >
                    <option value="">Todas las fuentes</option>
                    {SOURCE_REGISTRY.map(s => <option key={s.name} value={s.name}>{s.label}</option>)}
                </select>
                <button className="btn btn-secondary" onClick={fetchItems}>🔄</button>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">📄</div>
                    <p>No se encontraron resultados para tu búsqueda.</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Fuente</th>
                                <th>Título</th>
                                <th>Publicación</th>
                                <th>Clasificación</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((it) => (
                                <tr key={it.id}>
                                    <td><span className="badge badge-nuevo">{it.source}</span></td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{it.title}</div>
                                        <a href={it.url} target="_blank" style={{ fontSize: 11, color: "var(--accent)" }}>Ver Fuente →</a>
                                    </td>
                                    <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatDate(it.published)}</td>
                                    <td>
                                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                            <span className={`badge badge-${it.impacto || "bajo"}`}>{it.impacto || "bajo"}</span>
                                            {it.tipo && <span className="badge" style={{ background: "rgba(255,255,255,0.05)" }}>{it.tipo}</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}
