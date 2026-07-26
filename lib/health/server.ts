import { createServer, type Server } from "node:http";

export type ReadinessResult = {
  ok: boolean;
  checks?: Record<string, unknown>;
};

type HealthServerOptions = {
  name: string;
  readiness: () => Promise<ReadinessResult>;
};

function sendJson(response: import("node:http").ServerResponse, status: number, body: object) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

export function createHealthServer(options: HealthServerOptions): Server {
  return createServer(async (request, response) => {
    const path = new URL(request.url || "/", "http://health.local").pathname;

    if (path === "/health/live") {
      sendJson(response, 200, {
        ok: true,
        service: options.name,
        checkedAt: new Date().toISOString(),
      });
      return;
    }

    if (path === "/health/ready") {
      try {
        const result = await options.readiness();
        sendJson(response, result.ok ? 200 : 503, {
          ...result,
          service: options.name,
          checkedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`[${options.name}] readiness check failed`, {
          kind: error instanceof Error ? error.name : typeof error,
        });
        sendJson(response, 503, {
          ok: false,
          service: options.name,
          checkedAt: new Date().toISOString(),
          error: "readiness_unavailable",
        });
      }
      return;
    }

    sendJson(response, 404, { ok: false, error: "not_found" });
  });
}

export function startHealthServer(options: HealthServerOptions & { port: number }): Server {
  const server = createHealthServer(options);
  server.listen(options.port, "0.0.0.0", () => {
    console.log(`[${options.name}] health server listening on ${options.port}`);
  });
  return server;
}

export async function closeHealthServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
