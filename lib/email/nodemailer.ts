// lib/email/nodemailer.ts

import nodemailer from 'nodemailer';

interface EmailAlertParams {
  title: string;
  summary: string | null;
  keywords: string[];
}

export async function sendAlertEmail(to: string, params: EmailAlertParams): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.FROM_EMAIL || 'alerts@juridico-radar.com';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #4f46e5; margin-top: 0;">⚖️ Alerta de Coincidencia Legal - Jurídico Radar</h2>
      <p style="color: #475569; font-size: 16px;">Hemos detectado una nueva publicación de tu interés:</p>
      
      <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #4f46e5; border-radius: 4px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1e293b;">${params.title}</h3>
        <p style="color: #334155; font-size: 14px; line-height: 1.5;">${params.summary || 'Sin resumen disponible.'}</p>
      </div>

      <p style="color: #64748b; font-size: 12px; margin-bottom: 5px;"><strong>Palabras clave coincidentes:</strong> ${params.keywords.join(', ')}</p>
      <p style="color: #64748b; font-size: 12px;">Para gestionar tus watchlists y alertas, inicia sesión en la consola de Jurídico Radar.</p>
    </div>
  `;

  if (!smtpHost || !smtpUser || !smtpPass) {
    // Modo Mock en consola para desarrollo
    console.log(JSON.stringify({
      event: "email.send_mock",
      to,
      subject: `Alerta: Coincidencia en ${params.title.slice(0, 40)}...`,
      keywords: params.keywords
    }));
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true para 465, false para otros puertos
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const info = await transporter.sendMail({
      from: `"Jurídico Radar" <${fromEmail}>`,
      to,
      subject: `[Alerta] Coincidencia Legal: ${params.title}`,
      html: htmlContent,
    });

    console.log(JSON.stringify({ event: "email.send_success", messageId: info.messageId, to }));
    return true;
  } catch (error: any) {
    console.error('Error enviando correo SMTP con nodemailer:', error);
    return false;
  }
}
