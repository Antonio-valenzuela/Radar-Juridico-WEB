import { NextResponse } from "next/server";
import { expandLegalSearch } from "@/lib/search/legalExpansion";
import { searchOfficialSources } from "@/lib/search/officialFederatedSearch";
import { hybridSearch } from "@/lib/search/hybridSearch";

const LOCAL_RESULT_THRESHOLD = 5;

type LegalRadarRequest = {
  query?: string;
  matter?: string;
  authority?: string;
  impactLevel?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isInvalidDate(value?: string) {
  if (!value) return false;
  return Number.isNaN(new Date(value).getTime());
}

function validateBody(body: LegalRadarRequest) {
  const errors: string[] = [];
  const query = normalizeString(body.query);

  if (!query) errors.push("query es requerida");
  if (query.length > 500) errors.push("query excede 500 caracteres");
  if (isInvalidDate(body.dateFrom)) errors.push("dateFrom invalida");
  if (isInvalidDate(body.dateTo)) errors.push("dateTo invalida");

  return errors;
}

export async function POST(req: Request) {
  try {
    let body: LegalRadarRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_request", details: ["Body JSON invalido"] }, { status: 400 });
    }

    const validationErrors = validateBody(body);
    if (validationErrors.length > 0) {
      return NextResponse.json({ ok: false, error: "invalid_request", details: validationErrors }, { status: 400 });
    }

    const query = normalizeString(body.query);
    const matter = normalizeString(body.matter);
    const authority = normalizeString(body.authority);
    const impactLevel = normalizeString(body.impactLevel);
    const dateFrom = normalizeString(body.dateFrom);
    const dateTo = normalizeString(body.dateTo);
    const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 50);

    const aiExpansion = await expandLegalSearch({
      query,
      matter,
      authority,
      impactLevel,
      dateFrom,
      dateTo,
    });

    const expandedTerms = aiExpansion.expanded.expandedSearch.alternativeTerms;
    const expandedQuery = [query, ...expandedTerms].filter(Boolean).join(" ");

    const localResults = await hybridSearch({
      query: expandedQuery,
      limit,
      filters: {
        materia: matter ? [matter] : undefined,
        impacto: impactLevel || undefined,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
      },
    });

    let externalResults: Awaited<ReturnType<typeof searchOfficialSources>>["results"] = [];
    let externalWarnings: string[] = [];
    const sourcesConsulted =
      localResults.length < LOCAL_RESULT_THRESHOLD
        ? aiExpansion.expanded.expandedSearch.officialSources
        : [];

    if (sourcesConsulted.length > 0) {
      const federated = await searchOfficialSources(sourcesConsulted, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 10,
      });
      externalResults = federated.results;
      externalWarnings = federated.warnings;
    }

    return NextResponse.json({
      ok: true,
      query,
      expandedQuery: aiExpansion.expanded,
      localResults,
      externalResults,
      sourcesConsulted,
      provider: aiExpansion.provider,
      model: aiExpansion.model,
      warnings: [...aiExpansion.expanded.warnings, ...externalWarnings],
      debug: {
        localResultsFound: localResults.length,
        externalSearchExecuted: externalResults.length > 0,
        externalResultsFound: externalResults.reduce((sum, entry) => sum + entry.results.length, 0),
        aiAvailable: aiExpansion.provider !== "local" || !aiExpansion.fallback,
        aiFallback: aiExpansion.fallback,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("API /api/search/legal-radar error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
