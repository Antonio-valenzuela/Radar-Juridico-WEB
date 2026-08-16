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
    <div className="container page-content">
      <header className="page-header">
        <div>
          <Link href="/" className="back-link">
            &larr; Volver al Dashboard
          </Link>
          <h1 style={{ margin: 0 }}>Documentos</h1>
          <p className="subtitle" style={{ marginLeft: 0, marginTop: 'var(--space-2)', marginBottom: 0 }}>
            Explora los últimos documentos oficiales ingeridos por la plataforma.
          </p>
        </div>
        <div>
          <Link href="/admin/ingest/manual-url" className="jr-button-primary">
            Agregar link jurídico
          </Link>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="card">
          <p className="text-muted">No hay documentos cargados todavía.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {items.map((item) => (
            <div key={item.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
                <Link href={`/items/${item.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
                  <h3 style={{ color: 'var(--accent)', margin: 0 }}>{item.title}</h3>
                </Link>
              </div>
              <p className="text-muted" style={{ marginTop: 'var(--space-2)', fontSize: '0.9rem' }}>
                {item.summary ? item.summary.substring(0, 250) + (item.summary.length > 250 ? '...' : '') : 'Sin resumen disponible'}
              </p>
              <div className="item-meta">
                <span>📅 {item.published ? new Date(item.published).toLocaleDateString('es-MX') : 'Sin fecha'}</span>
                <span>🏛️ {item.source}</span>
                <span>📚 Materia: {Array.isArray(item.tema) && item.tema.length > 0 ? item.tema.join(', ') : 'Sin tema'}</span>
                {item.impacto && (
                  <span className={`impact-${item.impacto.toLowerCase()}`}>
                    ⚠️ {item.impacto}
                  </span>
                )}
                {item.aiEnrichment && (
                  <>
                    <span className="meta-divider" aria-hidden="true" />
                    <span className="tag-ai">🤖 {item.aiEnrichment.matter}</span>
                    {item.aiEnrichment.authority && (
                      <span className="tag-authority">
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
