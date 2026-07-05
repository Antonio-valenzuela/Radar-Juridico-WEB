import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOrCreateConsultantInsight } from "@/lib/consultant/generate";

export const dynamic = "force-dynamic";

function asList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
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

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="document-card" style={{ padding: 20, marginBottom: 0 }}>
      <h2 className="document-section-title" style={{ fontSize: 18, marginBottom: 12 }}>{title}</h2>
      <ul className="document-muted" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6, fontSize: "0.95rem" }}>
        {items.length ? items.map((item) => <li key={item} style={{ marginBottom: 6 }}>{item}</li>) : <li>Sin datos suficientes.</li>}
      </ul>
    </section>
  );
}

export default async function ConsultantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, insight] = await Promise.all([
    prisma.item.findUnique({ where: { id } }),
    getOrCreateConsultantInsight(id),
  ]);

  if (!item || !insight) {
    return (
      <main className="document-page" style={{ textAlign: "center", paddingTop: 100 }}>
        <div className="document-card" style={{ maxWidth: 500, margin: "0 auto" }}>
          <h1 className="document-title" style={{ fontSize: 24, marginBottom: 16 }}>Item no encontrado</h1>
          <Link href="/" className="btn-doc-primary">Volver al Dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="document-page">
      <div className="bg-gradient" />
      <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 16 }}>
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
          <div style={{ color: "var(--accent)", fontWeight: 900, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>CONSULTOR JURÍDICO</div>
          <h1 className="document-title" style={{ fontSize: 30, lineHeight: 1.15, marginBottom: 12 }}>Lectura ejecutiva del cambio</h1>
          <p className="document-muted" style={{ fontSize: 16, margin: 0 }}>{item.title}</p>
        </header>

        <section className="document-card">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <Badge tone="success">{item.source}</Badge>
            {item.impacto ? <Badge tone={item.impacto === "alto" ? "danger" : item.impacto === "medio" ? "info" : "success"}>{item.impacto}</Badge> : null}
            {item.tipo ? <Badge tone="info">{item.tipo}</Badge> : null}
            {item.tema ? <Badge>{item.tema}</Badge> : null}
          </div>
          <p style={{ fontSize: 18, lineHeight: 1.55, margin: 0, color: "var(--text-main)", fontWeight: 500 }}>{insight.executiveSummary}</p>
          <div style={{ marginTop: 16, color: "var(--text-muted)", fontSize: 13 }}>
            Generado con <span style={{ textTransform: 'capitalize' }}>{insight.provider}</span>/{insight.model}. Confianza: {(Number(insight.confidence) * 100).toFixed(0)}%. No sustituye revisión legal.
          </div>
        </section>

        <div style={{ display: "grid", gap: 16 }}>
          <Section title="Qué cambió" items={asList(insight.keyChanges)} />
          <Section title="A quién puede afectar" items={asList(insight.affectedParties)} />
          <Section title="Qué revisar ahora" items={asList(insight.actionItems)} />
          <Section title="Focos de riesgo" items={asList(insight.riskFlags)} />
          <Section title="Preguntas para el abogado" items={asList(insight.followUpQuestions)} />
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href={item.url} target="_blank" rel="noreferrer" className="btn-doc-primary">
            Abrir fuente oficial
          </a>
          <Link href={`/items/${item.id}/diff`} className="btn-doc-secondary">
            Ver artículos afectados
          </Link>
        </div>
      </div>
    </main>
  );
}
