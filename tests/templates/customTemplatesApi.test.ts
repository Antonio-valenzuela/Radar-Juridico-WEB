import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as POST_analyzeUpload } from '@/app/api/templates/analyze-upload/route';
import { requireAdmin } from '@/lib/security/adminAuth';

describe('Custom Templates API & Utilities', () => {
  let origEnv: string | undefined;

  beforeEach(() => {
    origEnv = process.env.ENABLE_PUBLIC_AI;
    process.env.ENABLE_PUBLIC_AI = 'true';
  });

  afterEach(() => {
    process.env.ENABLE_PUBLIC_AI = origEnv;
  });

  describe('Analyze Upload Endpoint (Server-Side)', () => {
    it('returns 400 when no file is uploaded', async () => {
      const formData = new FormData();
      const req = new NextRequest('http://localhost/api/templates/analyze-upload', {
        method: 'POST',
        body: formData,
      });

      const res = await POST_analyzeUpload(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toContain('No se recibió ningún archivo');
    });

    it('rejects files larger than 15MB with status 413', async () => {
      const formData = new FormData();
      const bigBuffer = new Uint8Array(15 * 1024 * 1024 + 100);
      const largeFile = new File([bigBuffer], 'giant.pdf', { type: 'application/pdf' });
      formData.append('file', largeFile);

      const req = new NextRequest('http://localhost/api/templates/analyze-upload', {
        method: 'POST',
        body: formData,
      });

      const res = await POST_analyzeUpload(req);
      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toContain('15 MB');
    });

    it('rejects unsupported file formats (.rtf) with status 415', async () => {
      const formData = new FormData();
      const rtfFile = new File(['{\\rtf1\\ansi Test}'], 'documento.rtf', { type: 'application/rtf' });
      formData.append('file', rtfFile);

      const req = new NextRequest('http://localhost/api/templates/analyze-upload', {
        method: 'POST',
        body: formData,
      });

      const res = await POST_analyzeUpload(req);
      expect(res.status).toBe(415);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.unsupported).toBe(true);
    });

    it('extracts plain text from .txt files successfully', async () => {
      const formData = new FormData();
      const txtContent = `DEMANDA DE AMPARO INDIRECTO
C. JUEZ DE DISTRITO EN TURNO EN MATERIA ADMINISTRATIVA
QUEJOSO: Juan Pérez
ASUNTO: Se promueve juicio de amparo contra actos de autoridad.
FUNDAMENTO: Artículo 107 y 108 de la Ley de Amparo.
CONSIDERANDO: Que se violan derechos humanos.
POR TANTO, A USTED C. JUEZ RESUELVE CONFORME A DERECHO.`;
      const txtFile = new File([txtContent], 'machote.txt', { type: 'text/plain' });
      formData.append('file', txtFile);

      const req = new NextRequest('http://localhost/api/templates/analyze-upload', {
        method: 'POST',
        body: formData,
      });

      const res = await POST_analyzeUpload(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.extractedText).toContain('DEMANDA DE AMPARO INDIRECTO');
      expect(json.classification.es_juridico).toBe(true);
    });

    it('accepts scanned PDFs with needsOcr=true and es_juridico=true', async () => {
      const formData = new FormData();
      // Dummy minimal PDF header that pdf-parse cannot extract > 50 chars from
      const pdfHeader = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 595 842]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF';
      const pdfFile = new File([pdfHeader], 'escaneado.pdf', { type: 'application/pdf' });
      formData.append('file', pdfFile);

      const req = new NextRequest('http://localhost/api/templates/analyze-upload', {
        method: 'POST',
        body: formData,
      });

      const res = await POST_analyzeUpload(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.needsOcr).toBe(true);
      expect(json.classification.es_juridico).toBe(true);
      expect(json.classification.tipo_documento).toContain('PDF escaneado');
    });
  });

  describe('Auth Bypass Configuration', () => {
    it('allows public AI endpoints when ENABLE_PUBLIC_AI=true', () => {
      const aiFillReq = new Request('http://localhost/api/templates/ai-fill', { method: 'POST' });
      const aiAssistReq = new Request('http://localhost/api/templates/ai-assist', { method: 'POST' });

      const fillAuth = requireAdmin(aiFillReq);
      const assistAuth = requireAdmin(aiAssistReq);

      expect(fillAuth.ok).toBe(true);
      expect(assistAuth.ok).toBe(true);
    });
  });
});
