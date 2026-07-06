'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Item {
  id: string;
  title: string;
  url: string | null;
  published: Date | null;
  source: string;
  tipo: string | null;
  tema: string | null;
  impacto: string | null;
  summary: string | null;
  createdAt: Date;
}

export default function DocumentsCatalog({ initialItems }: { initialItems: Item[] }) {
  const [items] = useState<Item[]>(initialItems);
  const [search, setSearch] = useState('');
  const [matterFilter, setMatterFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Extract unique sources and types for filters
  const uniqueSources = Array.from(new Set(items.map(i => i.source).filter(Boolean))) as string[];
  const uniqueTypes = Array.from(new Set(items.map(i => i.tipo).filter(Boolean))) as string[];

  // Filter items
  const filtered = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || 
                          (item.summary || '').toLowerCase().includes(search.toLowerCase());
    const matchesMatter = !matterFilter || item.tema === matterFilter;
    const matchesSource = !sourceFilter || item.source === sourceFilter;
    const matchesType = !typeFilter || item.tipo === typeFilter;
    
    // Status mock filter: Vigente for LEY/CODIGO, otherwise No verificado/Pendiente
    const itemStatus = ['LEY', 'CODIGO'].includes((item.tipo || '').toUpperCase()) ? 'vigente' : 'noverificado';
    const matchesStatus = !statusFilter || itemStatus === statusFilter;

    return matchesSearch && matchesMatter && matchesSource && matchesType && matchesStatus;
  });

  const handleCopyUrl = (url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    alert('Enlace oficial copiado al portapapeles.');
  };

  const selectStyle = {
    padding: '0.5rem',
    borderRadius: '6px',
    border: '1px solid var(--card-border)',
    background: '#0f172a',
    color: 'white',
    fontSize: '0.9rem',
    flex: 1,
    minWidth: '150px'
  };

  return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-block', marginBottom: '1rem' }}>
          &larr; Volver al Dashboard
        </Link>
        <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 700 }}>Catálogo de Documentos</h1>
        <p className="subtitle" style={{ marginLeft: 0, marginTop: '0.5rem', marginBottom: 0 }}>
          Biblioteca compartida de demostración pública. Consulta y analiza fuentes legales oficiales.
        </p>
      </header>

      {/* Filter Toolbar */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Buscar por título o contenido..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...selectStyle, flex: 2, padding: '0.6rem 1rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select value={matterFilter} onChange={e => setMatterFilter(e.target.value)} style={selectStyle}>
            <option value="">Cualquier materia</option>
            <option value="constitucional">Constitucional</option>
            <option value="civil">Civil</option>
            <option value="familiar">Familiar</option>
            <option value="mercantil">Mercantil</option>
            <option value="aduanal">Aduanal</option>
            <option value="fiscal">Fiscal</option>
            <option value="laboral">Laboral</option>
            <option value="amparo">Amparo</option>
            <option value="comercio_exterior">Comercio exterior</option>
            <option value="administrativo">Administrativo</option>
          </select>

          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={selectStyle}>
            <option value="">Cualquier fuente</option>
            {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selectStyle}>
            <option value="">Cualquier tipo</option>
            {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="">Cualquier vigencia</option>
            <option value="vigente">Vigente</option>
            <option value="noverificado">No verificado automáticamente</option>
          </select>
        </div>
      </div>

      {/* Documents Grid / Table */}
      {filtered.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No se encontraron documentos con los filtros seleccionados.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map(item => {
            const isVigente = ['LEY', 'CODIGO'].includes((item.tipo || '').toUpperCase());
            const displayStatus = isVigente ? 'Vigente' : 'No verificado';
            
            return (
              <div key={item.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', transition: 'transform 0.2s', cursor: 'default' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <Link href={`/items/${item.id}`} style={{ textDecoration: 'none' }}>
                      <h3 style={{ color: 'var(--accent)', margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 600 }}>
                        {item.title}
                      </h3>
                    </Link>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                      {item.summary ? item.summary.substring(0, 200) + (item.summary.length > 200 ? '...' : '') : 'Sin resumen disponible'}
                    </p>
                  </div>
                  
                  {/* Status Badge */}
                  <span style={{ 
                    fontSize: '0.8rem', 
                    padding: '0.25rem 0.6rem', 
                    borderRadius: '12px', 
                    fontWeight: 600,
                    background: isVigente ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: isVigente ? '#10b981' : '#f59e0b',
                    whiteSpace: 'nowrap'
                  }}>
                    {displayStatus}
                  </span>
                </div>

                {/* Metadata Row */}
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                  <span>🏛️ <strong>Fuente:</strong> {item.source}</span>
                  <span>📚 <strong>Materia:</strong> {item.tema || 'General'}</span>
                  <span>📄 <strong>Tipo:</strong> {item.tipo || 'Documento'}</span>
                  <span>📅 <strong>Fecha de carga:</strong> {new Date(item.createdAt).toLocaleDateString('es-MX')}</span>
                  <span>🔄 <strong>Estado indexación:</strong> Indexado</span>
                  <span>📝 <strong>Última reforma:</strong> No verificado automáticamente</span>
                </div>

                {/* Actions Toolbar */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <Link href={`/items/${item.id}`} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', textDecoration: 'none' }}>
                    Ver documento
                  </Link>

                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: '#334155', color: 'white', textDecoration: 'none', borderRadius: '8px' }}>
                      Abrir fuente oficial
                    </a>
                  )}

                  <Link href={`/rag?q=${encodeURIComponent(item.title)}`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: 'white', textDecoration: 'none', borderRadius: '8px' }}>
                    Preguntar a IA
                  </Link>

                  {item.url && (
                    <button type="button" onClick={() => handleCopyUrl(item.url!)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--card-border)', color: '#cbd5e1', cursor: 'pointer', borderRadius: '8px' }}>
                      Copiar URL
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
