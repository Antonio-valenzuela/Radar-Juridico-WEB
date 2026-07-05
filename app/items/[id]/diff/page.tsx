import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { processItemNormaDiff } from "@/lib/normas/process";

export const dynamic = "force-dynamic";

type ChangeView = {
  articleId?: string;
  title?: string;
  changeType?: string;
  beforePreview?: string | null;
  afterPreview?: string | null;
};

export default async function ItemDiffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let item = await getItemWithDiff(id);

  if (item && item.normaVersions.length === 0) {
    await processItemNormaDiff(id);
    item = await getItemWithDiff(id);
  }

  if (!item) {
    return (
      <main className="document-page" style={{ textAlign: "center", paddingTop: 100 }}>
        <div className="document-card" style={{ maxWidth: 500, margin: "0 auto" }}>
          <h1 className="document-title" style={{ fontSize: 24, marginBottom: 16 }}>Item no encontrado</h1>
          <Link href="/" className="btn-doc-primary">Volver al Dashboard</Link>
        </div>
      </main>
    );
  }

  const version = item.normaVersions[0] || null;
  const diff = version?.diffsTo[0] || null;
  const changedArticles = Array.isArray(diff?.changedArticles)
    ? (diff.changedArticles as ChangeView[])
    : [];
  const bullets = Array.isArray(diff?.summaryBullets) ? diff.summaryBullets : [];

  return (
    <main className="document-page">
      <div className="bg-gradient" />
      <div style={{ maxWidth: 920, margin: "0 auto", display: "grid", gap: 16 }}>
        <nav className="document-nav">
          <Link href={`/items/${item.id}`} style={{ color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            &larr; Volver al Detalle
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>|</span>
          <Link href="/">Dashboard</Link>
          <Link href="/search">Búsqueda Avanzada</Link>
          <Link href="/watchlists">Alertas</Link>
          <Link href="/metrics">Métricas</Link>
        </nav>

        <header className="document-card">
          <h1 className="document-title" style={{ fontSize: 28, marginBottom: 8 }}>Diff de norma</h1>
          <p className="document-muted" style={{ margin: 0 }}>{item.title}</p>
          <div style={{ marginTop: 12 }}>
            <Link href={`/items/${item.id}/consultant`} className="btn-doc-primary" style={{ fontSize: '0.9rem', minHeight: 38 }}>
              Ver lectura de consultor
            </Link>
          </div>
        </header>

        {version?.norma ? (
          <section className="document-card" style={{ marginBottom: 0 }}>
            <div className="document-label" style={{ marginBottom: 4 }}>ORDENAMIENTO</div>
            <div className="document-value" style={{ fontSize: 18 }}>{version.norma.nombre}</div>
            <div className="document-muted" style={{ fontSize: 13, marginTop: 4 }}>
              {version.norma.sigla || "Sin sigla"} · {version.publishedAt.toISOString().slice(0, 10)}
            </div>
          </section>
        ) : null}

        {diff ? (
          <>
            <section className="document-card" style={{ marginBottom: 0 }}>
              <h2 className="document-section-title" style={{ fontSize: 18, marginBottom: 12 }}>Qué cambió</h2>
              <ul className="document-muted" style={{ paddingLeft: 18, lineHeight: 1.6 }}>
                {bullets.map((bullet) => (
                  <li key={String(bullet)}>{String(bullet)}</li>
                ))}
              </ul>
            </section>

            <section className="document-card" style={{ marginBottom: 0 }}>
              <h2 className="document-section-title" style={{ fontSize: 18, marginBottom: 16 }}>Artículos afectados: {changedArticles.length}</h2>
              <div style={{ display: "grid", gap: 16 }}>
                {changedArticles.map((change, index) => (
                  <article key={`${change.articleId}-${index}`} style={{ border: "1px solid var(--card-border)", borderRadius: 8, padding: 14, background: "rgba(255,255,255,0.02)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
                      <strong style={{ color: "#93c5fd", fontSize: "1.05rem" }}>{change.title || change.articleId}</strong>
                      <span className="document-badge" style={{ fontSize: 11, textTransform: "uppercase", background: change.changeType === "reforma" ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.15)", color: change.changeType === "reforma" ? "#f87171" : "#60a5fa", border: `1px solid ${change.changeType === "reforma" ? "rgba(239, 68, 68, 0.25)" : "rgba(59, 130, 246, 0.25)"}`, padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                        {change.changeType}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                      <div style={{ borderLeft: "2px solid rgba(239, 68, 68, 0.3)", paddingLeft: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#f87171", textTransform: "uppercase", marginBottom: 4 }}>Antes</div>
                        <p className="document-muted" style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>{change.beforePreview || "Sin texto previo"}</p>
                      </div>
                      <div style={{ borderLeft: "2px solid rgba(16, 185, 129, 0.3)", paddingLeft: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#34d399", textTransform: "uppercase", marginBottom: 4 }}>Después</div>
                        <p className="document-muted" style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>{change.afterPreview || "Sin texto posterior"}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="document-card" style={{ borderStyle: "dashed", textAlign: "center", padding: 24 }}>
            <p className="document-muted" style={{ margin: 0 }}>
              No hay diff disponible para este item. Puede faltar texto completo, PDF extraíble o una versión anterior comparable.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

async function getItemWithDiff(id: string) {
  return await prisma.item.findUnique({
    where: { id },
    include: {
      normaVersions: {
        include: {
          norma: true,
          diffsTo: true,
        },
      },
    },
  });
}
