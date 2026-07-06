"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  buildCaseSourceUrl,
  CASE_ALERT_RULES,
  CASE_SOURCE_OPTIONS,
  CASE_TRACKING_FIELDS,
  formatCaseSearchParameters,
  getCaseAlertState,
} from "@/lib/legalOperations";

const STORAGE_KEY = "juridico_tracked_cases";

type CaseFormValues = {
  jurisdiction: string;
  court: string;
  caseNumber: string;
  matter: string;
  actor: string;
  defendant: string;
  source: string;
};

type CaseActuation = {
  id: string;
  date: string;
  title: string;
  note: string;
};

type TrackedCase = CaseFormValues & {
  id: string;
  createdAt: string;
  lastReviewAt: string;
  actuations: CaseActuation[];
};

const EMPTY_CASE_FORM: CaseFormValues = {
  jurisdiction: "",
  court: "",
  caseNumber: "",
  matter: "",
  actor: "",
  defendant: "",
  source: CASE_SOURCE_OPTIONS[0]?.id || "",
};

const EMPTY_ACTUATION = {
  date: "",
  title: "",
  note: "",
};

export default function ExpedientesPage() {
  const [formValues, setFormValues] = useState<CaseFormValues>({ ...EMPTY_CASE_FORM });
  const [cases, setCases] = useState<TrackedCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [actuation, setActuation] = useState({ ...EMPTY_ACTUATION });

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      try {
        const parsed = JSON.parse(stored) as TrackedCase[];
        const storedCases = Array.isArray(parsed) ? parsed : [];
        setCases(storedCases);
        setSelectedCaseId(storedCases[0]?.id || "");
      } catch {
        setCases([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCase = useMemo(
    () => cases.find((item) => item.id === selectedCaseId) || cases[0] || null,
    [cases, selectedCaseId]
  );

  const sourceById = useMemo(
    () => new Map(CASE_SOURCE_OPTIONS.map((source) => [source.id, source])),
    []
  );

  function persist(nextCases: TrackedCase[]) {
    setCases(nextCases);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCases));
  }

  function updateField(id: keyof CaseFormValues, value: string) {
    setFormValues((current) => ({ ...current, [id]: value }));
  }

  function saveCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formValues.caseNumber.trim() || !formValues.court.trim()) return;

    const now = new Date().toISOString();
    const nextCase: TrackedCase = {
      ...formValues,
      id: `expediente-${Date.now()}`,
      createdAt: now,
      lastReviewAt: now,
      actuations: [],
    };
    const nextCases = [nextCase, ...cases];
    persist(nextCases);
    setSelectedCaseId(nextCase.id);
    setFormValues({ ...EMPTY_CASE_FORM });
  }

  function registerActuation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCase || !actuation.title.trim()) return;

    const nextActuation: CaseActuation = {
      id: `actuacion-${Date.now()}`,
      date: actuation.date || new Date().toISOString().slice(0, 10),
      title: actuation.title,
      note: actuation.note,
    };

    const nextCases = cases.map((item) =>
      item.id === selectedCase.id
        ? {
            ...item,
            lastReviewAt: new Date().toISOString(),
            actuations: [nextActuation, ...item.actuations],
          }
        : item
    );
    persist(nextCases);
    setActuation({ ...EMPTY_ACTUATION });
  }

  return (
    <>
      <div className="bg-gradient"></div>
      <main className="container legal-hub-shell">
        <nav className="document-nav">
          <Link href="/legal-hub">Volver al Centro Jurídico</Link>
          <Link href="/legal-hub/jurisprudencia">Jurisprudencia</Link>
          <Link href="/admin/sources">Fuentes oficiales</Link>
        </nav>

        <section className="legal-hub-hero">
          <span className="badge">Expedientes y actuaciones</span>
          <h1>Seguimiento de SISE, CJF y boletines estatales.</h1>
          <p className="subtitle">
            Guarda jurisdicción, juzgado, expediente, actor, demandado y fuente oficial para revisar
            actuaciones sin perder contexto.
          </p>
        </section>

        <section className="glass-card legal-form-panel">
          <span className="document-label">Alta de expediente</span>
          <form onSubmit={saveCase}>
            <div className="legal-form-grid">
              {CASE_TRACKING_FIELDS.map((field) => (
                <label key={field.id}>
                  {field.label}
                  {field.id === "source" ? (
                    <select
                      value={formValues.source}
                      onChange={(event) => updateField("source", event.target.value)}
                    >
                      {CASE_SOURCE_OPTIONS.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={formValues[field.id as keyof CaseFormValues]}
                      onChange={(event) => updateField(field.id as keyof CaseFormValues, event.target.value)}
                      placeholder={field.placeholder}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="legal-actions-row">
              <button type="submit" className="btn-doc-primary">
                Guardar expediente
              </button>
            </div>
          </form>
        </section>

        <section className="legal-hub-grid">
          <article className="glass-card legal-hub-card">
            <span className="document-label">Fuente oficial</span>
            <h2 className="legal-hub-card-title">Abrir portal autorizado</h2>
            <p className="document-muted">
              No intenta brincar login, captcha ni restricciones del portal. La app guarda datos de búsqueda
              y abre la fuente oficial para consulta manual o con sesión autorizada.
            </p>
            <div className="legal-hub-tags">
              {CASE_SOURCE_OPTIONS.map((source) => (
                <a
                  key={source.id}
                  href={source.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="legal-hub-chip"
                >
                  {source.label}
                </a>
              ))}
            </div>
          </article>

          <article className="glass-card legal-hub-card">
            <span className="document-label">Reglas de alerta</span>
            <h2 className="legal-hub-card-title">Qué se debe revisar</h2>
            <ul className="legal-alert-list">
              {CASE_ALERT_RULES.map((rule) => (
                <li key={rule.id}>
                  <strong>{rule.label}:</strong> {rule.description}
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="glass-card legal-form-panel">
          <span className="document-label">Registrar actuación</span>
          <form onSubmit={registerActuation}>
            <div className="legal-form-grid">
              <label>
                Expediente
                <select
                  value={selectedCase?.id || ""}
                  onChange={(event) => setSelectedCaseId(event.target.value)}
                >
                  {cases.length === 0 ? <option value="">Sin expedientes guardados</option> : null}
                  {cases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.caseNumber} - {item.court}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fecha
                <input
                  type="date"
                  value={actuation.date}
                  onChange={(event) => setActuation((current) => ({ ...current, date: event.target.value }))}
                />
              </label>
              <label>
                Actuación
                <input
                  value={actuation.title}
                  onChange={(event) => setActuation((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Acuerdo, notificación, requerimiento..."
                />
              </label>
              <label className="legal-wide-card">
                Nota
                <textarea
                  value={actuation.note}
                  onChange={(event) => setActuation((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Resumen, plazo o siguiente acción."
                />
              </label>
            </div>
            <div className="legal-actions-row">
              <button type="submit" className="btn-doc-primary" disabled={!selectedCase}>
                Registrar actuación
              </button>
            </div>
          </form>
        </section>

        <section className="legal-hub-grid">
          {cases.length === 0 ? (
            <article className="glass-card legal-hub-card">
              <span className="document-label">Sin registros</span>
              <h2 className="legal-hub-card-title">Aún no hay expedientes guardados</h2>
              <p className="document-muted">
                Captura expediente, juzgado, actor y demandado para crear la primera ficha de seguimiento.
              </p>
            </article>
          ) : (
            cases.map((item) => {
              const source = sourceById.get(item.source) || CASE_SOURCE_OPTIONS[0];
              const sourceHref = buildCaseSourceUrl(source, item);
              const searchParameters = formatCaseSearchParameters(item);
              const alertState = getCaseAlertState({
                actuationCount: item.actuations.length,
                lastReviewAt: item.lastReviewAt,
              });
              const alertClass =
                alertState.level === "attention"
                  ? "status-requiere_navegador"
                  : alertState.level === "review"
                    ? "status-busqueda"
                    : "status-listo";
              return (
                <article key={item.id} className="glass-card legal-hub-card">
                  <div>
                    <span className="document-label">{item.matter || "Materia pendiente"}</span>
                    <h2 className="legal-hub-card-title">{item.caseNumber}</h2>
                    <p className="document-muted">
                      {item.court} · {item.jurisdiction || source.jurisdiction}
                    </p>
                  </div>
                  <div className="legal-meta-block">
                    <strong>Actor:</strong> {item.actor || "Pendiente"}
                    <br />
                    <strong>Demandado:</strong> {item.defendant || "Pendiente"}
                    <br />
                    <strong>Fuente:</strong> {source.label}
                    <br />
                    <strong>Última revisión:</strong> {new Date(item.lastReviewAt).toLocaleString("es-MX")}
                  </div>
                  <p className={`legal-hub-status ${alertClass}`}>{alertState.label}</p>
                  <p className="document-muted">{alertState.description}</p>
                  <div className="legal-meta-block">
                    <strong>Parámetros para fuente oficial:</strong>
                    <br />
                    {searchParameters || "Agrega expediente, juzgado o materia para abrir la consulta con parámetros."}
                  </div>
                  <div className="document-actions">
                    <a href={sourceHref} target="_blank" rel="noreferrer" className="btn-doc-primary">
                      Abrir fuente con parámetros
                    </a>
                    <button
                      type="button"
                      className="btn-doc-secondary"
                      onClick={() => setSelectedCaseId(item.id)}
                    >
                      Seleccionar
                    </button>
                  </div>
                  {item.actuations.length > 0 ? (
                    <ul className="legal-alert-list">
                      {item.actuations.slice(0, 3).map((entry) => (
                        <li key={entry.id}>
                          <strong>{entry.date}:</strong> {entry.title}
                          {entry.note ? <span> · {entry.note}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="document-muted">Sin actuaciones registradas.</p>
                  )}
                </article>
              );
            })
          )}
        </section>
      </main>
    </>
  );
}
