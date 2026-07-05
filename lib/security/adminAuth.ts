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

  if (!expected || !provided || (provided !== expected && !isDevToken)) {
    return {
      ok: false as const,
      response: new Response(
        JSON.stringify({ ok: false, error: "unauthorized" }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    };
  }

  return { ok: true as const };
}
