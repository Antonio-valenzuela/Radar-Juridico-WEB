// worker/dashboardWorker.ts

import { WebSocketServer, WebSocket } from 'ws';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { assertRuntimeEnv } from '@/lib/config/env';
import { checkDatabase } from '@/lib/health/checks';
import { closeHealthServer, createHealthServer } from '@/lib/health/server';
import { getExpectedAdminToken } from '@/lib/security/adminAuth';

assertRuntimeEnv();
const PORT = process.env.WEBSOCKET_PORT || 3002;
const configuredMaxClients = Number(process.env.DASHBOARD_MAX_CLIENTS || 100);
const DASHBOARD_MAX_CLIENTS = Number.isFinite(configuredMaxClients) && configuredMaxClients > 0
  ? Math.floor(configuredMaxClients)
  : 100;
let shuttingDown = false;

interface Client {
  ws: WebSocket;
  id: string;
}

const clients: Client[] = [];

function tokenMatches(provided: string) {
  const expected = getExpectedAdminToken();
  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function hasValidOrigin(origin: string) {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || '').origin === origin;
  } catch {
    return false;
  }
}

function readProtocolToken(header: string | string[] | undefined) {
  const protocols = (Array.isArray(header) ? header.join(',') : header || '')
    .split(',')
    .map((value) => value.trim());
  const encoded = protocols.find((value) => value.startsWith('auth.'))?.slice(5);
  if (!encoded) return '';

  try {
    return Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

const healthServer = createHealthServer({
  name: 'dashboard-websocket',
  readiness: async () => {
    const db = await checkDatabase(prisma);
    return {
      ok: !shuttingDown && db.ok && wss.address() !== null,
      checks: { db, websocket: wss.address() !== null, clients: clients.length, shuttingDown },
    };
  },
});
const wss = new WebSocketServer({
  server: healthServer,
  verifyClient: (info, done) => {
    if (shuttingDown || clients.length >= DASHBOARD_MAX_CLIENTS) {
      done(false, 503, 'WebSocket capacity unavailable');
      return;
    }

    if (!hasValidOrigin(info.origin)) {
      done(false, 403, 'Origin not allowed');
      return;
    }

    const token = readProtocolToken(info.req.headers['sec-websocket-protocol']);
    if (!tokenMatches(token)) {
      done(false, 401, 'Unauthorized');
      return;
    }

    done(true);
  },
});

healthServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[Dashboard WebSocket] Servidor y healthchecks escuchando en el puerto ${PORT}`);
});

wss.on('connection', (ws: WebSocket) => {
  const clientId = Math.random().toString(36).substring(2);
  clients.push({ ws, id: clientId });

  console.log(`Client conectado al dashboard: ${clientId}`);

  // Enviar métricas inmediatas al conectar
  broadcastDashboardMetrics().catch(err => console.error('Error inicial de broadcast:', err));

  ws.on('close', () => {
    const idx = clients.findIndex((c) => c.id === clientId);
    if (idx !== -1) clients.splice(idx, 1);
    console.log(`Client desconectado del dashboard: ${clientId}`);
  });
});

async function broadcastDashboardMetrics() {
  if (clients.length === 0) return;

  try {
    const [
      totalProcessed,
      jobsPending,
      jobsFailed,
      avgProcessingTime,
      sourceStatus,
    ] = await Promise.all([
      prisma.ingestionJob.count({
        where: { status: 'COMPLETADO' },
      }).catch(() => 0),
      prisma.ingestionJob.count({
        where: { status: { in: ['PENDIENTE', 'DESCARGANDO', 'REINTENTANDO', 'EXTRAYENDO_TEXTO', 'GENERANDO_EMBEDDINGS', 'CLASIFICANDO_CON_IA'] } },
      }).catch(() => 0),
      prisma.ingestionJob.count({
        where: { status: 'FALLIDO' },
      }).catch(() => 0),
      calculateAvgProcessingTime(),
      getSourceStatus(),
    ]);

    const metrics = {
      timestamp: new Date().toISOString(),
      documentos_procesados: totalProcessed,
      jobs_pendientes: jobsPending,
      jobs_fallidos: jobsFailed,
      tiempo_promedio_procesamiento: avgProcessingTime,
      ultimo_procesamiento: new Date().toISOString(),
      workers_activos: clients.length,
      estado_fuentes: sourceStatus,
    };

    const payload = JSON.stringify(metrics);
    clients.forEach(({ ws }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  } catch (err) {
    console.error('Error calculando métricas del dashboard:', err);
  }
}

async function calculateAvgProcessingTime(): Promise<number> {
  try {
    const completed = await prisma.ingestionJob.findMany({
      where: { status: 'COMPLETADO' },
      select: { createdAt: true, completedAt: true },
      take: 100,
    });

    if (completed.length === 0) return 0;

    const totalTime = completed.reduce((sum, job) => {
      if (!job.completedAt) return sum;
      return sum + (job.completedAt.getTime() - job.createdAt.getTime());
    }, 0);

    // Retorna promedio en segundos
    const avgMs = totalTime / completed.length;
    return Math.round((avgMs / 1000) * 100) / 100;
  } catch {
    return 0;
  }
}

async function getSourceStatus(): Promise<Record<string, boolean>> {
  const sources = ['DOF', 'SCJN', 'SJF'];
  const status: Record<string, boolean> = {};

  try {
    for (const source of sources) {
      const lastJob = await prisma.ingestionJob.findFirst({
        where: { source },
        orderBy: { createdAt: 'desc' },
      });
      status[source] = lastJob ? lastJob.status === 'COMPLETADO' : true;
    }
  } catch {
    sources.forEach(s => { status[s] = true; });
  }

  return status;
}

// Broadcast cada 5 segundos
const broadcastInterval = setInterval(broadcastDashboardMetrics, 5000);

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Dashboard WebSocket] ${signal} recibido; cerrando servidor`);
  clearInterval(broadcastInterval);
  for (const { ws } of clients) ws.close(1001, 'server shutdown');
  await new Promise<void>((resolve) => wss.close(() => resolve()));
  await closeHealthServer(healthServer);
  await prisma.$disconnect();
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void shutdown(signal).then(() => process.exit(0));
  });
}
