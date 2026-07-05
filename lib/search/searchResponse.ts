export type SearchSourceStatus = "completed" | "timed_out" | "failed";

export type SearchSourceState = {
  source: string;
  status: SearchSourceStatus;
  resultsCount: number;
  durationMs?: number;
  warning?: string;
};

export type SearchStateInput = {
  resultCount: number;
  sources: SearchSourceState[];
};

export function deriveSearchState(input: SearchStateInput) {
  const timedOut = input.sources.some((source) => source.status === "timed_out");
  const failed = input.sources.some((source) => source.status === "failed");
  const partial = input.resultCount > 0 && (timedOut || failed);
  const empty = input.resultCount === 0 && !timedOut && !failed;

  let message = "Búsqueda completada.";
  if (partial) {
    message = "Respuesta parcial: se muestran resultados disponibles, pero una o más fuentes no terminaron.";
  } else if (timedOut) {
    message = "La búsqueda agotó el tiempo de espera antes de confirmar resultados. Intenta de nuevo o amplía el timeout.";
  } else if (failed) {
    message = "No se pudo completar la búsqueda en todas las fuentes.";
  } else if (empty) {
    message = "No se encontraron resultados reales para esos filtros.";
  }

  return {
    partial,
    timedOut,
    failed,
    empty,
    message,
    sources: input.sources,
  };
}
