import { prisma } from "@/lib/prisma";
import { normalizeLegalDisplayText } from "@/lib/text/normalizeLegalDisplayText";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Fetch real stats from the database
  const [itemCount, canonicalDocumentsCount, alertsCount, rulesCount] = await Promise.all([
    prisma.item.count().catch(() => 0),
    prisma.document.count().catch(() => 0),
    prisma.notification.count().catch(() => 0),
    prisma.alertRule.count().catch(() => 0),
  ]);
  const documentsCount = Math.max(itemCount, canonicalDocumentsCount);

  const recentDocuments = await prisma.document.findMany({
    take: 5,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      source: true,
      canonicalUrl: true,
      updatedAt: true,
      documentType: true,
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          publishedAt: true,
          sourceItem: {
            select: {
              id: true,
              title: true,
              url: true,
              source: true,
              published: true,
              impacto: true,
              tema: true,
            },
          },
          chunks: {
            take: 1,
            select: {
              _count: { select: { embeddings: true } },
            },
          },
        },
      },
    },
  }).catch(() => []);

  const fallbackItems = recentDocuments.length > 0 ? [] : await prisma.item.findMany({
    take: 5,
    orderBy: { published: "desc" },
    select: { id: true, title: true, url: true, published: true, impacto: true, source: true, tema: true },
  }).catch(() => []);

  const recentItems = recentDocuments.length > 0
    ? recentDocuments.map((doc) => {
        const version = doc.versions[0];
        const sourceItem = version?.sourceItem;
        const embeddingCount = version?.chunks[0]?._count.embeddings || 0;
        return {
          id: sourceItem?.id || doc.id,
          title: sourceItem?.title || doc.title,
          url: sourceItem?.url || doc.canonicalUrl || "#",
          source: sourceItem?.source || doc.source,
          published: sourceItem?.published || version?.publishedAt || doc.updatedAt,
          impacto: sourceItem?.impacto || null,
          tema: sourceItem?.tema || null,
          embeddingsStatus: embeddingCount > 0 ? "completo" : "pendiente",
        };
      })
    : fallbackItems.map((item) => ({
        ...item,
        embeddingsStatus: "pendiente",
      }));

  return (
    <>
      <div className="bg-gradient"></div>
      
      <header className="header">
        <Link href="/" className="logo">
          <div className="logo-icon"></div>
          Jurídico Radar
        </Link>
        <input type="checkbox" id="menu-toggle" className="menu-toggle" />
        <label htmlFor="menu-toggle" className="menu-icon">
          <span></span>
          <span></span>
          <span></span>
        </label>
        <nav className="nav-menu">
          <Link href="/">Dashboard</Link>
          <Link href="/legal-hub">Centro Jurídico</Link>
          <Link href="/search">Búsqueda</Link>
          <Link href="/rag">Consultor RAG</Link>
          <Link href="/digests">Resúmenes</Link>
          <Link href="/watchlists">Alertas</Link>
          <Link href="/items">Documentos</Link>
          <Link href="/ai">IA Legal</Link>
          <Link href="/metrics">Metrics</Link>
          <Link href="/admin/ingest/manual-url" style={{ border: '1px solid var(--accent)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--accent)', fontWeight: 'bold' }}>Agregar link jurídico</Link>
          <Link href="/admin/sources" style={{ border: '1px dashed var(--secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--secondary)' }}>⚙ Fuentes Admin</Link>
        </nav>
      </header>

      <main className="container">
        <section className="hero">
          <span className="badge">Inteligencia Regulatoria</span>
          <h1>Monitorea cambios legales con IA.</h1>
          <p className="subtitle">
            Plataforma avanzada de monitoreo regulatorio para México. Extrae, analiza y clasifica publicaciones del DOF, SIDOF, SCJN y más usando embeddings locales y RAG.
          </p>
          <div className="hero-buttons">
            <Link href="/search" className="btn-primary" style={{ textDecoration: 'none' }}>Búsqueda Avanzada</Link>
            <Link href="/legal-hub" className="btn-primary" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', boxShadow: 'none', textDecoration: 'none' }}>Centro Jurídico</Link>
            <Link href="/rag" className="btn-primary" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', boxShadow: 'none', textDecoration: 'none' }}>Preguntar a IA</Link>
            <Link href="/admin/ingest/manual-url" className="btn-primary" style={{ background: 'var(--accent)', color: 'white', textDecoration: 'none' }}>Agregar link jurídico</Link>
          </div>
        </section>

        <section className="grid">
          <div className="glass-card">
            <span className="stat-value">{documentsCount.toLocaleString()}</span>
            <span className="stat-label">Documentos Indexados</span>
          </div>
          <div className="glass-card">
            <span className="stat-value">{rulesCount.toLocaleString()}</span>
            <span className="stat-label">Reglas Activas</span>
          </div>
          <div className="glass-card">
            <span className="stat-value">{alertsCount.toLocaleString()}</span>
            <span className="stat-label">Alertas Generadas</span>
          </div>
        </section>

        <section className="glass-card" style={{ marginBottom: '4rem' }}>
          <h2>Últimos Documentos</h2>
          {recentItems.length === 0 ? (
            <p className="text-muted">Aún no hay documentos indexados. Agrega una URL jurídica o ejecuta una ingesta manual.</p>
          ) : (
            <ul className="alert-list">
              {recentItems.map(item => (
                <li key={item.id} className="alert-item">
                  <div>
                    <Link href={item.url || "#"} className="alert-title" target="_blank" rel="noopener noreferrer">
                      {normalizeLegalDisplayText(item.title)}
                    </Link>
                    <div className="alert-meta">
                      {item.source} • {item.tema || 'materia pendiente'} • {new Date(item.published || '').toLocaleDateString('es-MX')} • embeddings: {item.embeddingsStatus}
                    </div>
                  </div>
                  <div>
                    <span className={`badge alert-impact-${item.impacto?.toLowerCase() || 'low'}`} style={{ marginBottom: 0 }}>
                      {item.impacto || 'Bajo'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
