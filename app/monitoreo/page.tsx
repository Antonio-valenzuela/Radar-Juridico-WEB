import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DEFAULT_MONITORED_DOCUMENTS } from "@/lib/monitoring/monitoredDocuments";
import {
  legalChangesHref,
  matchNormaDiffInsight,
  type NormaDiffCandidate,
} from "@/lib/monitoring/normaCoverage";

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

async function loadNormaDiffCandidates(): Promise<NormaDiffCandidate[]> {
  try {
    const diffs = await prisma.normaDiff.findMany({
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        id: true,
        summaryBullets: true,
        createdAt: true,
        toVersion: {
          select: {
            norma: {
              select: {
                id: true,
                nombre: true,
                sigla: true,
                aliases: true,
              },
            },
          },
        },
      },
    });

    return diffs.map((diff) => ({
      diffId: diff.id,
      normaId: diff.toVersion.norma.id,
      nombre: diff.toVersion.norma.nombre,
      sigla: diff.toVersion.norma.sigla,
      aliases: diff.toVersion.norma.aliases,
      summaryBullets: diff.summaryBullets,
      createdAt: diff.createdAt,
    }));
  } catch {
    return [];
  }
}

export default async function MonitoringPage() {
  const [documents, changes, normaDiffCandidates] = await Promise.all([
    loadDocuments(),
    loadChanges(),
    loadNormaDiffCandidates(),
  ]);
  const changedCount = documents.filter((document) => document.monitoringStatus === "changed").length;
  const reviewCount = documents.filter((document) => ["error", "blocked"].includes(document.monitoringStatus || "")).length;
  const readyCount = documents.filter((document) => ["active", "unchanged"].includes(document.monitoringStatus || "")).length;

  return (
    <>
      <div className="bg-gradient"></div>

      <main className="container monitoring-shell">
        <section className="monitoring-hero">
          <span className="badge">Vigilancia documental</span>
          <h1>Estado de documentos y fuentes oficiales</h1>
          <p className="subtitle">
            Esta vista detecta cambios por hash del documento completo. Cuando existe un NormaDiff relacionado,
            también muestra su resumen por artículo y enlaza al desglose detallado.
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
              const insight = matchNormaDiffInsight(document, normaDiffCandidates);
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
                  <div className="monitoring-row-note">
                    {insight ? (
                      <>
                        <strong>Detalle por artículo disponible.</strong>{" "}
                        {insight.summaryBullets[0] || "NormaDiff registrado para esta norma."}{" "}
                        <Link href={legalChangesHref(insight)}>Ver último desglose</Link>
                      </>
                    ) : (
                      <>
                        <strong>Nivel documento completo.</strong>{" "}
                        {document.lastError || document.changeSummary || "Sin observaciones registradas."}
                      </>
                    )}
                  </div>
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
              {changes.map((change) => {
                const document = change.documentVersion.document;
                const insight = matchNormaDiffInsight(document, normaDiffCandidates);
                const officialUrl = change.sourceUrl || document.officialUrl;

                return (
                  <article key={change.id} className="monitoring-change">
                    <div>
                      <span className="monitor-status monitor-status-change">
                        {insight
                          ? "Desglose por artículo disponible"
                          : "Cambio detectado — sin desglose por artículo disponible"}
                      </span>
                      <h3>{document.title}</h3>
                      {insight ? (
                        insight.summaryBullets.length > 0 ? (
                          <ul>
                            {insight.summaryBullets.map((bullet, index) => (
                              <li key={`${insight.diffId}-${index}`}>{bullet}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>NormaDiff registrado; consulta el detalle de los artículos modificados.</p>
                        )
                      ) : (
                        <p>{change.changeDescription}</p>
                      )}
                      <small>
                        {change.matter || "materia pendiente"} · {formatDate(change.detectedAt)} · Requiere revision profesional
                      </small>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      {insight && (
                        <Link href={legalChangesHref(insight)} className="btn-doc-secondary">
                          Ver cambios por artículo
                        </Link>
                      )}
                      {officialUrl && (
                        <a
                          href={officialUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-doc-secondary"
                        >
                          Abrir fuente oficial
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
