import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DEFAULT_MONITORED_DOCUMENTS } from "@/lib/monitoring/monitoredDocuments";

export const dynamic = "force-dynamic";

type PageDocument = {
  id: string;
  title: string;
  shortCode: string | null;
  matter: string | null;
  jurisdiction: string;
  officialUrl: string | null;
  monitoringStatus: string | null;
  changeSummary: string | null;
  lastCheckedAt: Date | null;
  lastModified: Date | null;
  lastError: string | null;
};

type PageChange = {
  id: string;
  changeDescription: string;
  sourceUrl: string | null;
  detectedAt: Date;
  priority: string;
  reviewStatus: string;
  matter: string | null;
  jurisdiction: string | null;
  documentVersion: {
    document: {
      title: string;
      shortCode: string | null;
      officialUrl: string | null;
    };
  };
};

function statusInfo(status: string | null) {
  switch (status) {
    case "changed":
      return { label: "Cambio detectado", className: "monitor-status monitor-status-change" };
    case "unchanged":
      return { label: "Sin cambios", className: "monitor-status monitor-status-ok" };
    case "active":
      return { label: "Activo", className: "monitor-status monitor-status-ok" };
    case "blocked":
      return { label: "Acceso restringido", className: "monitor-status monitor-status-review" };
    case "error":
      return { label: "Requiere revision", className: "monitor-status monitor-status-review" };
    default:
      return { label: "Pendiente de registrar", className: "monitor-status monitor-status-pending" };
  }
}

function formatDate(date: Date | null) {
  if (!date) return "Pendiente";
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

async function loadDocuments(): Promise<PageDocument[]> {
  try {
    const documents = await prisma.document.findMany({
      where: {
        officialUrl: { not: null },
        shortCode: { not: null },
      },
      orderBy: [{ monitoringStatus: "asc" }, { shortCode: "asc" }],
      take: 60,
      select: {
        id: true,
        title: true,
        shortCode: true,
        matter: true,
        jurisdiction: true,
        officialUrl: true,
        monitoringStatus: true,
        changeSummary: true,
        lastCheckedAt: true,
        lastModified: true,
        lastError: true,
      },
    });

    if (documents.length > 0) return documents;
  } catch {
    return DEFAULT_MONITORED_DOCUMENTS.map((document) => ({
      id: document.shortCode,
      title: document.title,
      shortCode: document.shortCode,
      matter: document.matter,
      jurisdiction: document.jurisdiction,
      officialUrl: document.officialUrl,
      monitoringStatus: null,
      changeSummary: "Documento base preparado para monitoreo.",
      lastCheckedAt: null,
      lastModified: null,
      lastError: null,
    }));
  }

  return DEFAULT_MONITORED_DOCUMENTS.map((document) => ({
    id: document.shortCode,
    title: document.title,
    shortCode: document.shortCode,
    matter: document.matter,
    jurisdiction: document.jurisdiction,
    officialUrl: document.officialUrl,
    monitoringStatus: null,
    changeSummary: "Documento base preparado para monitoreo.",
    lastCheckedAt: null,
    lastModified: null,
    lastError: null,
  }));
}

async function loadChanges(): Promise<PageChange[]> {
  try {
    return await prisma.documentChange.findMany({
      orderBy: { detectedAt: "desc" },
      take: 8,
      select: {
        id: true,
        changeDescription: true,
        sourceUrl: true,
        detectedAt: true,
        priority: true,
        reviewStatus: true,
        matter: true,
        jurisdiction: true,
        documentVersion: {
          select: {
            document: {
              select: {
                title: true,
                shortCode: true,
                officialUrl: true,
              },
            },
          },
        },
      },
    });
  } catch {
    return [];
  }
}

export default async function MonitoringPage() {
  const [documents, changes] = await Promise.all([loadDocuments(), loadChanges()]);
  const changedCount = documents.filter((document) => document.monitoringStatus === "changed").length;
  const reviewCount = documents.filter((document) => ["error", "blocked"].includes(document.monitoringStatus || "")).length;
  const readyCount = documents.filter((document) => ["active", "unchanged"].includes(document.monitoringStatus || "")).length;

  return (
    <>
      <div className="bg-gradient"></div>

      <header className="header">
        <Link href="/" className="logo">
          <div className="logo-icon"></div>
          Jurídico Radar
        </Link>
        <input type="checkbox" id="monitor-menu-toggle" className="menu-toggle" />
        <label htmlFor="monitor-menu-toggle" className="menu-icon" aria-label="Abrir menu">
          <span></span>
          <span></span>
          <span></span>
        </label>
        <nav className="nav-menu">
          <Link href="/">Dashboard</Link>
          <Link href="/search">Búsqueda</Link>
          <Link href="/documents">Documentos</Link>
          <Link href="/monitoreo">Monitoreo</Link>
          <Link href="/watchlists">Alertas</Link>
          <Link href="/legal-hub">Centro Jurídico</Link>
        </nav>
      </header>

      <main className="container monitoring-shell">
        <section className="monitoring-hero">
          <span className="badge">Monitoreo legal</span>
          <h1>Monitoreo de cambios legales</h1>
          <p className="subtitle">
            Revisión de leyes clave contra fuentes oficiales. Los cambios detectados se muestran como señales
            de trabajo y siempre requieren validación profesional antes de usarse en un asunto.
          </p>
        </section>

        <section className="monitoring-summary">
          <div className="glass-card monitoring-stat">
            <span className="stat-value">{documents.length}</span>
            <span className="stat-label">Documentos vigilados</span>
          </div>
          <div className="glass-card monitoring-stat">
            <span className="stat-value">{readyCount}</span>
            <span className="stat-label">Activos o sin cambios</span>
          </div>
          <div className="glass-card monitoring-stat">
            <span className="stat-value">{changedCount}</span>
            <span className="stat-label">Cambios detectados</span>
          </div>
          <div className="glass-card monitoring-stat">
            <span className="stat-value">{reviewCount}</span>
            <span className="stat-label">Requieren revisión</span>
          </div>
        </section>

        <section className="glass-card monitoring-panel">
          <div className="monitoring-panel-heading">
            <div>
              <span className="document-label">Fuente oficial</span>
              <h2>Documentos monitoreados</h2>
            </div>
            <p className="document-muted">
              La revision automatica no sustituye la consulta directa de la fuente oficial.
            </p>
          </div>

          <div className="monitoring-table" role="table" aria-label="Documentos monitoreados">
            <div className="monitoring-row monitoring-row-head" role="row">
              <span>Documento</span>
              <span>Materia</span>
              <span>Estado</span>
              <span>Última revisión</span>
              <span>Fuente oficial</span>
            </div>
            {documents.map((document) => {
              const status = statusInfo(document.monitoringStatus);
              return (
                <article className="monitoring-row" role="row" key={document.id}>
                  <div>
                    <strong>{document.title}</strong>
                    <small>{document.shortCode || "Sin clave"} · {document.jurisdiction}</small>
                  </div>
                  <span>{document.matter || "Materia pendiente"}</span>
                  <span className={status.className}>{status.label}</span>
                  <span>{formatDate(document.lastCheckedAt)}</span>
                  <span>
                    {document.officialUrl ? (
                      <a href={document.officialUrl} target="_blank" rel="noreferrer">Abrir</a>
                    ) : (
                      "Pendiente"
                    )}
                  </span>
                  <p className="monitoring-row-note">
                    {document.lastError || document.changeSummary || "Sin observaciones registradas."}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="glass-card monitoring-panel">
          <div className="monitoring-panel-heading">
            <div>
              <span className="document-label">Cambios recientes</span>
              <h2>Cambios recientes</h2>
            </div>
            <p className="document-muted">Requiere revision profesional antes de promover, contestar o asesorar.</p>
          </div>

          {changes.length === 0 ? (
            <div className="monitoring-empty">
              No hay cambios indexados para el periodo consultado.
            </div>
          ) : (
            <div className="monitoring-change-list">
              {changes.map((change) => (
                <article key={change.id} className="monitoring-change">
                  <div>
                    <span className="monitor-status monitor-status-change">Cambio detectado</span>
                    <h3>{change.documentVersion.document.title}</h3>
                    <p>{change.changeDescription}</p>
                    <small>
                      {change.matter || "materia pendiente"} · {formatDate(change.detectedAt)} · Requiere revision profesional
                    </small>
                  </div>
                  <a
                    href={change.sourceUrl || change.documentVersion.document.officialUrl || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-doc-secondary"
                  >
                    Abrir fuente oficial
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
