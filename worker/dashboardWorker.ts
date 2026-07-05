// worker/dashboardWorker.ts

import { WebSocketServer, WebSocket } from 'ws';
import { prisma } from '@/lib/prisma';

const PORT = process.env.WEBSOCKET_PORT || 3002;
const wss = new WebSocketServer({ port: Number(PORT) });

interface Client {
  ws: WebSocket;
  id: string;
}

const clients: Client[] = [];

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
setInterval(broadcastDashboardMetrics, 5000);

console.log(`[Dashboard WebSocket] Servidor escuchando en el puerto ${PORT}`);
