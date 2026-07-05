// lib/alerts/evaluateAlerts.ts

import { prisma } from '@/lib/prisma';
import { sendAlertEmail } from '@/lib/email/nodemailer';

export async function evaluateAlertsForDocument(documentId: string): Promise<void> {
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!document) {
      console.warn(`[evaluateAlerts] Documento ${documentId} no encontrado para evaluar.`);
      return;
    }

    const latestVersion = document.versions[0];
    const textContent = latestVersion?.originalText || latestVersion?.rawText || '';

    // Unificar textos para evaluar palabras clave en minúsculas
    const documentText = `${document.title} ${document.summary || ''} ${textContent}`.toLowerCase();

    // Obtener todas las alertas activas de los usuarios
    const alerts = await prisma.userAlert.findMany({
      where: { isActive: true },
      include: { user: true },
    });

    console.log(`[evaluateAlerts] Evaluando ${alerts.length} alertas activas para el documento: ${document.title}`);

    for (const alert of alerts) {
      const keywords = alert.keywords || [];
      if (keywords.length === 0) continue;

      // Evaluar coincidencia
      const matchedKeywords = keywords.filter((kw) =>
        documentText.includes(kw.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        console.log(`[evaluateAlerts] Coincidencia encontrada para alerta ${alert.id} (usuario ${alert.userId}). Keywords:`, matchedKeywords);

        // 1. Crear notificación en base de datos
        await prisma.alertNotification.create({
          data: {
            alertId: alert.id,
            documentId: document.id,
            title: `Coincidencia en: ${document.title}`,
            summary: document.summary || 'Nueva actualización legal relevante.',
            relevance: 0.85, // score estático de relevancia
          },
        });

        // 2. Enviar email al correo del usuario
        if (alert.user.email) {
          const emailSent = await sendAlertEmail(alert.user.email, {
            title: document.title,
            summary: document.summary,
            keywords: matchedKeywords,
          });

          if (emailSent) {
            console.log(`[evaluateAlerts] Alerta enviada con éxito a: ${alert.user.email}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('[evaluateAlerts] Error evaluando alertas para el documento:', documentId, error);
  }
}

export async function evaluateAlertsForItem(itemId: string): Promise<{ matches: string[] }> {
  try {
    const version = await prisma.documentVersion.findFirst({
      where: { sourceItemId: itemId },
      select: { documentId: true }
    });

    if (version?.documentId) {
      await evaluateAlertsForDocument(version.documentId);
    }
  } catch (error) {
    console.error('[evaluateAlerts] Error in evaluateAlertsForItem:', itemId, error);
  }
  return { matches: [] };
}

