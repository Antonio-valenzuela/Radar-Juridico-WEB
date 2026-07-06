"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  buildJurisprudenceQuery,
  buildJurisprudenceSearchHref,
  JURISPRUDENCE_SEARCH_FIELDS,
} from "@/lib/legalOperations";

const EMPTY_VALUES = Object.fromEntries(
  JURISPRUDENCE_SEARCH_FIELDS.map((field) => [field.id, ""])
) as Record<string, string>;

export default function JurisprudenciaPage() {
  const [values, setValues] = useState<Record<string, string>>({ ...EMPTY_VALUES });

  const query = useMemo(() => buildJurisprudenceQuery(values), [values]);
  const searchHref = useMemo(() => buildJurisprudenceSearchHref(values), [values]);

  function updateField(id: string, value: string) {
    setValues((current) => ({ ...current, [id]: value }));
  }

  function clearFields() {
    setValues({ ...EMPTY_VALUES });
  }

  return (
    <>
      <div className="bg-gradient"></div>
      <main className="container legal-hub-shell">
        <nav className="document-nav">
          <Link href="/legal-hub">Volver al Centro Jurídico</Link>
          <Link href="/legal-hub/leyes-vigentes">Leyes vigentes</Link>
          <Link href="/search">Búsqueda avanzada</Link>
        </nav>

        <section className="legal-hub-hero">
          <span className="badge">Jurisprudencia SCJN</span>
          <h1>Búsqueda guiada en Semanario Judicial de la Federación.</h1>
          <p className="subtitle">
            Captura registroDigital, materia, órgano emisor, época, tipoCriterio, fecha y tema para
            localizar tesis, jurisprudencias y precedentes recientes.
          </p>
        </section>

        <section className="glass-card legal-form-panel">
          <div className="legal-form-grid">
            {JURISPRUDENCE_SEARCH_FIELDS.map((field) => (
              <label key={field.id}>
                {field.label}
                <input
                  value={values[field.id] || ""}
                  onChange={(event) => updateField(field.id, event.target.value)}
                  placeholder={field.placeholder}
                />
              </label>
            ))}
          </div>

          <div className="legal-actions-row">
            <Link href={searchHref} className="btn-doc-primary">
              Buscar criterios
            </Link>
            <a
              href="https://sjf2.scjn.gob.mx"
              target="_blank"
              rel="noreferrer"
              className="btn-doc-secondary"
            >
              Abrir SJF oficial
            </a>
            <button type="button" className="btn-doc-secondary" onClick={clearFields}>
              Limpiar
            </button>
          </div>
        </section>

        <section className="legal-hub-grid">
          <article className="glass-card legal-hub-card">
            <span className="document-label">Campos clave</span>
            <h2 className="legal-hub-card-title">Qué debe revisar el abogado</h2>
            <ul className="legal-alert-list">
              <li>Registro digital y rubro exacto del criterio.</li>
              <li>Órgano emisor: Pleno, Sala o Tribunal Colegiado.</li>
              <li>Tipo de criterio: jurisprudencia, tesis aislada o precedente.</li>
              <li>Época, materia, fecha de publicación y contradicción relacionada.</li>
            </ul>
          </article>

          <article className="glass-card legal-hub-card">
            <span className="document-label">Resultado esperado</span>
            <h2 className="legal-hub-card-title">Formato de revisión</h2>
            <p className="document-muted">
              Al abrir la búsqueda, confirma rubro, fuente, materia, relevancia, resumen del criterio,
              liga oficial y si modifica una estrategia civil, familiar, mercantil o de amparo.
            </p>
            <p className="document-muted legal-warning">
              Advertencia de verificación: antes de citar un criterio, valida el registro digital, rubro
              y texto completo directamente en la fuente oficial SCJN/SJF.
            </p>
            <div className="legal-meta-block">
              <strong>Consulta armada:</strong>
              <br />
              {query || "Agrega filtros para formar una consulta precisa."}
            </div>
          </article>
        </section>
      </main>
    </>
  );
}
