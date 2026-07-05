import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const items = await prisma.item.findMany({
    include: { aiEnrichment: true },
    take: 50,
    orderBy: { published: "desc" },
  });

  return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-block', marginBottom: '1rem' }}>
            &larr; Volver al Dashboard
          </Link>
          <h1 style={{ margin: 0 }}>Documentos</h1>
          <p className="subtitle" style={{ marginLeft: 0, marginTop: '0.5rem', marginBottom: 0 }}>
            Explora los últimos documentos oficiales ingeridos por la plataforma.
          </p>
        </div>
        <div>
          <Link href="/admin/ingest/manual-url" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Agregar link jurídico
          </Link>
        </div>
      </header>
      
      {items.length === 0 ? (
        <div className="glass-card">
          <p className="text-muted">No hay documentos cargados todavía.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {items.map((item) => (
            <div key={item.id} className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <Link href={`/items/${item.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
                  <h3 style={{ color: 'var(--accent)', margin: 0 }}>{item.title}</h3>
                </Link>
              </div>
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {item.summary ? item.summary.substring(0, 250) + (item.summary.length > 250 ? '...' : '') : 'Sin resumen disponible'}
              </p>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap', alignItems: 'center' }}>
                <span>📅 {item.published ? new Date(item.published).toLocaleDateString('es-MX') : 'Sin fecha'}</span>
                <span>🏛️ {item.source}</span>
                <span>📚 Materia: {item.tema || 'Sin tema'}</span>
                {item.impacto && (
                  <span style={{ color: item.impacto === 'alto' ? '#ef4444' : item.impacto === 'medio' ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                    ⚠️ {item.impacto}
                  </span>
                )}
                {item.aiEnrichment && (
                  <>
                    <span style={{ borderLeft: '1px solid var(--card-border)', height: '12px', margin: '0 4px' }} />
                    <span style={{ color: '#60a5fa', fontWeight: 600 }}>🤖 {item.aiEnrichment.matter}</span>
                    {item.aiEnrichment.authority && (
                      <span style={{ background: '#1e293b', color: '#34d399', padding: '1px 5px', borderRadius: '4px', fontSize: '0.75rem' }}>
                        {item.aiEnrichment.authority}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
