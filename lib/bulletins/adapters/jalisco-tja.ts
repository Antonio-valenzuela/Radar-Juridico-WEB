import https from 'https';
import * as Cheerio from 'cheerio';
import { normalizeExpediente } from '@/lib/utils/normalizeExpediente';
import type { BulletinParsedEntry } from '@/lib/bulletins/types';

export const TJA_JALISCO_URL = 'https://tjajal.gob.mx/boletines';
export const TJA_ADAPTER_VERSION = '1.0.0';

export type TjaQueryInput = {
  expedienteNumber: string;
  court?: string;      // Sala (e.g. "I-UNITARIA")
  startDate?: string;  // FAcu (YYYY-MM-DD)
  endDate?: string;    // FAcuerdo (YYYY-MM-DD)
};

export type TjaQueryResult = {
  status: 'FOUND' | 'NOT_FOUND' | 'SOURCE_OFFLINE' | 'CAPTCHA_REQUIRED' | 'RATE_LIMIT' | 'UNKNOWN';
  httpStatus: number;
  entries: BulletinParsedEntry[];
  rawHtml?: string;
  errorMessage?: string;
};

function httpGet(url: string): Promise<{ status: number; html: string; cookies: string[] }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const rawCookies = res.headers['set-cookie'] || [];
        resolve({ status: res.statusCode || 200, html: data, cookies: rawCookies });
      });
    });
    req.on('error', reject);
  });
}

function httpPost(url: string, body: string, cookieHeader: string): Promise<{ status: number; html: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'Cookie': cookieHeader,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode || 200, html: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Executes an official form search against Tribunal de Justicia Administrativa de Jalisco (TJA)
 */
export async function queryTjaJaliscoBulletin(input: TjaQueryInput): Promise<TjaQueryResult> {
  const normalizedCase = normalizeExpediente(input.expedienteNumber, 'TJA_JALISCO');
  const targetExpediente = normalizedCase || input.expedienteNumber;

  try {
    // 1. Initial GET to retrieve CSRF token & cookies
    const getRes = await httpGet(TJA_JALISCO_URL);

    if (getRes.status >= 400) {
      return {
        status: 'SOURCE_OFFLINE',
        httpStatus: getRes.status,
        entries: [],
        errorMessage: `TJA Jalisco initial page returned HTTP ${getRes.status}`,
      };
    }

    const $get = Cheerio.load(getRes.html);
    const csrfToken = $get('input[name="_csrfToken"]').first().val() || '';
    const cookieHeader = getRes.cookies.map(c => c.split(';')[0]).join('; ');

    // 2. Build form payload
    const body = new URLSearchParams();
    body.append('_csrfToken', String(csrfToken));
    body.append('FAcu', input.startDate || '');
    body.append('FAcuerdo', input.endDate || '');
    body.append('NExpediente', targetExpediente);
    body.append('Sala', input.court || '');
    body.append('Actor', '');
    body.append('Demandados', '');
    body.append('Terceros', '');

    // 3. POST query to official form
    const postRes = await httpPost(TJA_JALISCO_URL, body.toString(), cookieHeader);

    if (postRes.status >= 400) {
      return {
        status: 'SOURCE_OFFLINE',
        httpStatus: postRes.status,
        entries: [],
        errorMessage: `TJA Jalisco POST search returned HTTP ${postRes.status}`,
      };
    }

    const $post = Cheerio.load(postRes.html);

    // 4. Check for empty result indicator
    if (postRes.html.includes('No hay registros que coincidan con la búsqueda')) {
      return {
        status: 'NOT_FOUND',
        httpStatus: 200,
        entries: [],
        rawHtml: postRes.html.slice(0, 1000),
      };
    }

    // 5. Parse table rows across all tables
    const entries: BulletinParsedEntry[] = [];
    const trs = $post('table tr').get();

    for (const tr of trs) {
      const cols = $post(tr)
        .find('td, th')
        .map((_, td) => $post(td).text().trim().replace(/\s+/g, ' '))
        .get()
        .filter(Boolean);

      const expCol = cols.find(c => c.includes('/') && /\d+\/\d+/.test(c));

      if (expCol) {
        const agreementDateRaw = cols[0] || null;
        const publicationDateRaw = cols[1] || null;
        const expNum = expCol;
        const court = cols[cols.length - 1] || input.court || 'TJA Jalisco';

        entries.push({
          expedienteNumber: expNum,
          court: court,
          agreementDateRaw: agreementDateRaw,
          publicationDateRaw: publicationDateRaw,
          sourceUrl: TJA_JALISCO_URL,
          heading: `Acuerdo ${agreementDateRaw || ''} - Expediente ${expNum}`,
          extract: `Publicado en ${publicationDateRaw || ''} en Sala ${court}`,
          evidenceKind: 'official_bulletin_search',
        });
      }
    }

    if (entries.length === 0) {
      return {
        status: 'NOT_FOUND',
        httpStatus: 200,
        entries: [],
        rawHtml: postRes.html.slice(0, 1000),
      };
    }

    return {
      status: 'FOUND',
      httpStatus: 200,
      entries: entries,
      rawHtml: postRes.html.slice(0, 2000),
    };
  } catch (err: any) {
    return {
      status: 'SOURCE_OFFLINE',
      httpStatus: 0,
      entries: [],
      errorMessage: err?.message || 'Network error connecting to TJA Jalisco',
    };
  }
}
