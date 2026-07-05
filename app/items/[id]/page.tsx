import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EnrichButton from "@/app/components/EnrichButton";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function Badge({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "danger" | "info" | "success" | "warning" | "indigo" }) {
  const colors = {
    neutral: ["rgba(148, 163, 184, 0.15)", "#cbd5e1", "rgba(148, 163, 184, 0.25)"],
    danger: ["rgba(239, 68, 68, 0.15)", "#f87171", "rgba(239, 68, 68, 0.25)"],
    info: ["rgba(59, 130, 246, 0.15)", "#60a5fa", "rgba(59, 130, 246, 0.25)"],
    success: ["rgba(16, 185, 129, 0.15)", "#34d399", "rgba(16, 185, 129, 0.25)"],
    warning: ["rgba(245, 158, 11, 0.15)", "#fbbf24", "rgba(245, 158, 11, 0.25)"],
    indigo: ["rgba(99, 102, 241, 0.15)", "#a5b4fc", "rgba(99, 102, 241, 0.25)"],
  }[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 30,
        borderRadius: 6,
        border: `1px solid ${colors[2]}`,
        background: colors[0],
        color: colors[1],
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      aiEnrichment: true,
      normaVersions: {
        include: {
          norma: true,
          diffsTo: true,
        },
        take: 1,
      },
      consultantInsights: {
        orderBy: { generatedAt: "desc" },
        take: 1,
      },
      documentVersions: {
        include: {
          document: true,
          chunks: { take: 3, orderBy: { chunkIndex: "asc" } },
        },
        take: 1,
      },
    },
  });

  if (!item) notFound();

  const diff = item.normaVersions[0]?.diffsTo[0] || null;
  const documentVersion = item.documentVersions[0] || null;

  return (
    <main className="document-page">
      <div className="bg-gradient" />
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gap: 16 }}>
        <nav className="document-nav">
          <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            &larr; Volver al Dashboard
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>|</span>
          <Link href="/">Dashboard</Link>
          <Link href="/search">Búsqueda Avanzada</Link>
          <Link href="/watchlists">Alertas</Link>
          <Link href="/metrics">Métricas</Link>
        </nav>

        <header className="document-card">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <Badge tone="success">{item.source}</Badge>
            {item.impacto ? <Badge tone={item.impacto === "alto" ? "danger" : item.impacto === "medio" ? "info" : "success"}>{item.impacto}</Badge> : null}
            {item.tipo ? <Badge tone="info">{item.tipo}</Badge> : null}
            {item.tema ? <Badge>{item.tema}</Badge> : null}
          </div>
          <h1 className="document-title">{item.title}</h1>
          <p className="document-muted" style={{ fontSize: 16, marginTop: 12, marginBottom: 12 }}>
            {item.summary || "Sin resumen disponible. Abre la fuente oficial para revisar el texto completo."}
          </p>
          <div style={{ color: "#93c5fd", fontWeight: 800, fontSize: 14 }}>Publicado: {formatDate(item.published)}</div>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <InfoCard label="Categoría" value={item.category || "sin clasificar"} />
          <InfoCard label="Keywords" value={item.keywordsHit || "sin coincidencias"} />
          <InfoCard label="Entidades detectadas" value={Array.isArray((item as any).entities) && (item as any).entities.length ? (item as any).entities.join(', ') : "Ninguna"} />
          <InfoCard label="Sectores afectados" value={Array.isArray((item as any).affectedSectors) && (item as any).affectedSectors.length ? (item as any).affectedSectors.join(', ') : "Ninguno"} />
        </section>

        {/* Sección de Análisis IA */}
        <section className="document-card">
          <h2 className="document-section-title">Análisis IA</h2>
          {item.aiEnrichment ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <strong className="document-label" style={{ display: "block" }}>Resumen Ejecutivo</strong>
                <p className="document-muted" style={{ margin: "4px 0 0" }}>{item.aiEnrichment.executiveSummary || "No disponible"}</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div>
                  <strong className="document-label" style={{ display: "block" }}>Materia Detectada</strong>
                  <div style={{ marginTop: 4, fontWeight: 700, color: "#60a5fa" }}>{item.aiEnrichment.matter}</div>
                </div>
                <div>
                  <strong className="document-label" style={{ display: "block" }}>Autoridad</strong>
                  <div style={{ marginTop: 4, fontWeight: 700, color: "#34d399" }}>{item.aiEnrichment.authority || "No identificada"}</div>
                </div>
                <div>
                  <strong className="document-label" style={{ display: "block" }}>Nivel de Impacto</strong>
                  <div style={{ marginTop: 4, fontWeight: 700, color: item.aiEnrichment.impactLevel === "high" ? "#f87171" : item.aiEnrichment.impactLevel === "medium" ? "#fbbf24" : "#34d399" }}>
                    {item.aiEnrichment.impactLevel}
                  </div>
                </div>
                <div>
                  <strong className="document-label" style={{ display: "block" }}>Confianza y Proveedor</strong>
                  <div style={{ marginTop: 4, fontSize: 14, color: "#cbd5e1" }}>
                    {(item.aiEnrichment.confidence * 100).toFixed(0)}% via <span style={{ textTransform: 'capitalize' }}>{item.aiEnrichment.provider}</span>
                  </div>
                </div>
              </div>

              <div>
                <strong className="document-label" style={{ display: "block" }}>Explicación del impacto</strong>
                <p className="document-muted" style={{ margin: "4px 0 0" }}>{item.aiEnrichment.explanation || "No disponible"}</p>
              </div>

              {Array.isArray(item.aiEnrichment.entities) && (item.aiEnrichment.entities as string[]).length > 0 && (
                <div>
                  <strong className="document-label" style={{ display: "block", marginBottom: 6 }}>Entidades Mencionadas</strong>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(item.aiEnrichment.entities as string[]).map((e: string) => (
                      <span key={e} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "4px 10px", borderRadius: 6, fontSize: 12, color: "#cbd5e1" }}>{e}</span>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(item.aiEnrichment.affectedSectors) && (item.aiEnrichment.affectedSectors as string[]).length > 0 && (
                <div>
                  <strong className="document-label" style={{ display: "block", marginBottom: 6 }}>Sectores Afectados</strong>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(item.aiEnrichment.affectedSectors as string[]).map((s: string) => (
                      <span key={s} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "4px 10px", borderRadius: 6, fontSize: 12, color: "#cbd5e1" }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(item.aiEnrichment.keywords) && (item.aiEnrichment.keywords as string[]).length > 0 && (
                <div>
                  <strong className="document-label" style={{ display: "block", marginBottom: 6 }}>Palabras Clave (Keywords)</strong>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(item.aiEnrichment.keywords as string[]).map((k: string) => (
                      <span key={k} style={{ background: "rgba(236,72,153,0.12)", border: "1px solid rgba(236,72,153,0.25)", padding: "4px 10px", borderRadius: 6, fontSize: 12, color: "#f472b6" }}>{k}</span>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(item.aiEnrichment.relatedTopics) && (item.aiEnrichment.relatedTopics as string[]).length > 0 && (
                <div>
                  <strong className="document-label" style={{ display: "block" }}>Temas Relacionados</strong>
                  <div style={{ marginTop: 4, color: "#cbd5e1", fontSize: 14 }}>{(item.aiEnrichment.relatedTopics as string[]).join(", ")}</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
              <p style={{ margin: 0, color: "var(--text-muted)" }}>Sin análisis IA todavía</p>
              <EnrichButton itemId={item.id} />
            </div>
          )}
        </section>

        {documentVersion ? (
          <section className="document-card">
            <h2 className="document-section-title">Documento Canónico</h2>
            <p className="document-muted" style={{ marginBottom: '1.25rem' }}>{documentVersion.document.title}</p>
            <div style={{ display: "grid", gap: 8 }}>
              {documentVersion.chunks.map((chunk) => (
                <div key={chunk.id} style={{ border: "1px solid var(--card-border)", borderRadius: 8, padding: 12, background: "rgba(255,255,255,0.02)" }}>
                  <strong style={{ color: "#93c5fd" }}>{chunk.sectionPath || `Chunk ${chunk.chunkIndex + 1}`}</strong>
                  <p style={{ margin: "6px 0 0", color: "var(--text-main)", fontSize: "0.95rem" }}>{chunk.text}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="document-card">
          <h2 className="document-section-title">Acciones</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <a href={item.url} target="_blank" rel="noreferrer" className="btn-doc-primary">Abrir fuente oficial</a>
            <Link href={`/rag?item=${item.id}`} className="btn-doc-primary">Preguntar con RAG</Link>
            <Link href={`/items/${item.id}/consultant`} className="btn-doc-secondary">Ver consultor</Link>
            <Link href={`/items/${item.id}/diff`} className="btn-doc-secondary">Ver diff</Link>
            
            {/* Quick API actions for admins via basic forms or links for now */}
            <form action={`/api/admin/reindex-document?id=${item.id}`} method="POST" style={{ display: "inline-block" }}>
              <input type="hidden" name="x-admin-token" value="dev-admin-token" />
              <button type="submit" className="btn-doc-secondary">Reindexar</button>
            </form>
            <form action="/api/admin/evaluate-alerts" method="POST" style={{ display: "inline-block" }}>
              <input type="hidden" name="x-admin-token" value="dev-admin-token" />
              <button type="submit" className="btn-doc-secondary">Evaluar alertas</button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="document-card" style={{ padding: 16, marginBottom: 0 }}>
      <div className="document-label">{label}</div>
      <div className="document-value" style={{ marginTop: 6, fontSize: 16 }}>{value}</div>
    </div>
  );
}
