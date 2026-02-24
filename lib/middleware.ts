/**
 * lib/middleware.ts
 * API error handling and auth middleware.
 */

import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "./validation";

type RouteHandler = (
    req: NextRequest,
    context?: any
) => Promise<NextResponse>;

/**
 * Wrap an API route handler with global error handling.
 */
export function withErrorHandler(handler: RouteHandler): RouteHandler {
    return async (req, context) => {
        try {
            return await handler(req, context);
        } catch (error: any) {
            console.error(`[API ERROR] ${req.method} ${req.url}:`, error);

            const status = error.status || 500;
            const body: ApiResponse = {
                ok: false,
                error: error.message || "Error interno del servidor",
            };

            return NextResponse.json(body, { status });
        }
    };
}

/**
 * Wrap an API route handler with admin auth check.
 */
export function withAdminAuth(handler: RouteHandler): RouteHandler {
    return async (req, context) => {
        const token =
            req.headers.get("x-admin-token") ||
            new URL(req.url).searchParams.get("token");

        const expected = process.env.ADMIN_TOKEN;

        if (!expected || token !== expected) {
            return NextResponse.json(
                { ok: false, error: "No autorizado" } as ApiResponse,
                { status: 401 }
            );
        }

        return handler(req, context);
    };
}
