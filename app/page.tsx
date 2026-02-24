import { prisma } from "@/lib/prisma";
import { SOURCE_REGISTRY } from "@/lib/sourceRegistry";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getStats() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  try {
    const totalItems = await prisma.item.count();
    const todayNew = await prisma.item.count({ where: { createdAt: { gte: todayStart } } });
    const weekNew = await prisma.item.count({ where: { createdAt: { gte: weekStart } } });

    const recentItems = await prisma.item.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const lastRun = await prisma.ingestRun.findFirst({
      orderBy: { startedAt: "desc" },
    });

    return {
      activeSources: SOURCE_REGISTRY.filter(s => s.enabled).length,
      totalItems,
      todayNew,
      weekNew,
      recentItems,
      lastRun,
      dbOk: true,
    };
  } catch (e) {
    console.error("Dashboard stats error:", e);
    return {
      activeSources: 0,
      totalItems: 0,
      todayNew: 0,
      weekNew: 0,
      recentItems: [],
      lastRun: null,
      dbOk: false,
    };
  }
}

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">Estado actual del monitoreo jurídico</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/api/ingest/all?token=secreto123" className="btn btn-secondary btn-sm" target="_blank">
            API Test: Ingestar Todo
          </Link>
        </div>
      </div>

      {!stats.dbOk && (
        <div className="card" style={{ borderColor: "var(--danger)", background: "rgba(239, 68, 68, 0.08)" }}>
          <strong>❌ Error de conexión con la base de datos</strong>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
            No se pudieron cargar las estadísticas. Revisa si la base de datos está corriendo y si las migraciones fueron aplicadas.
          </p>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Fuentes Activas</div>
          <div className="value accent">{stats.activeSources}</div>
        </div>
        <div className="stat-card">
          <div className="label">Items Totales</div>
          <div className="value">{stats.totalItems}</div>
        </div>
        <div className="stat-card">
          <div className="label">Nuevos Hoy</div>
          <div className="value success">{stats.todayNew}</div>
        </div>
        <div className="stat-card">
          <div className="label">Última Ingesta</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginTop: 8 }}>
            {stats.lastRun ? formatDate(stats.lastRun.startedAt) : "Sin registros"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {stats.lastRun?.status === "completed" ? "✅ Éxito" : stats.lastRun?.status === "running" ? "⏳ En curso" : "⚠️ Error"}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Últimos Items Detectados</h2>
          <Link href="/documentos" className="btn btn-secondary btn-sm">
            Ver todos →
          </Link>
        </div>

        {stats.recentItems.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📡</div>
            <p>No se han detectado items todavía. Ejecuta una ingesta manual para comenzar.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fuente</th>
                <th>Título</th>
                <th>Fecha Pub</th>
                <th>Impacto</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentItems.map((item) => (
                <tr key={item.id}>
                  <td><span className="badge badge-nuevo">{item.source}</span></td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{item.title.length > 80 ? item.title.slice(0, 80) + "..." : item.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.url.slice(0, 50)}...</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{formatDate(item.published)}</td>
                  <td>
                    <span className={`badge badge-${item.impacto || "bajo"}`}>
                      {item.impacto || "bajo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <Link href="/fuentes" className="stat-card" style={{ textDecoration: "none", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔗</div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Gestionar Fuentes</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Control de APIs y scrapers</div>
        </Link>
        <Link href="/documentos" className="stat-card" style={{ textDecoration: "none", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Explorar Items</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Búsqueda y filtrado avanzado</div>
        </Link>
        <Link href="/reformas" className="stat-card" style={{ textDecoration: "none", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚖️</div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Historial de Cambios</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Detección automática de reformas</div>
        </Link>
      </div>
    </>
  );
}