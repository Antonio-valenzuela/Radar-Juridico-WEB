export function getExpectedAdminToken() {
  const token = process.env.ADMIN_TOKEN?.trim();

  if (token) return token;

  if (process.env.NODE_ENV !== "production") {
    return "dev-admin-token";
  }

  return "";
}

export function requireAdmin(request: Request) {
  const expected = getExpectedAdminToken();
  const provided = request.headers.get("x-admin-token")?.trim();
  const isDev = process.env.NODE_ENV !== "production";
  const isDevToken = isDev && provided === "dev-admin-token";

  // Check public bypasses
  const isPublicDemo = process.env.ENABLE_PUBLIC_DEMO === "true";
  const isPublicAI = process.env.ENABLE_PUBLIC_AI === "true" || isPublicDemo;
  const isPublicSearch = process.env.ENABLE_PUBLIC_SEARCH === "true" || isPublicDemo;
  const isPublicDocs = process.env.ENABLE_PUBLIC_DOCUMENTS === "true" || isPublicDemo;

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  // Allow read-only (GET) to sources if public search or docs are enabled
  if (path.startsWith("/api/admin/sources") && method === "GET" && (isPublicSearch || isPublicDocs)) {
    return { ok: true as const };
  }

  // Allow IA / RAG / watchlist endpoints (GET and POST) if public AI is enabled
  const isAiEndpoint = path.startsWith("/api/legal-reports") || 
                       path.startsWith("/api/legal/radar") || 
                       path.startsWith("/api/ai/") || 
                       path.startsWith("/api/rag/") ||
                       path.startsWith("/api/watchlist");
                       
  if (isAiEndpoint && isPublicAI) {
    return { ok: true as const };
  }

  if (!expected || !provided || (provided !== expected && !isDevToken)) {
    return {
      ok: false as const,
      response: new Response(
        JSON.stringify({ ok: false, error: "Token de administrador no autorizado." }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    };
  }

  return { ok: true as const };
}

