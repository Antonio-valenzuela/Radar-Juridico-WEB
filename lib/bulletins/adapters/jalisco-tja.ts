import * as Cheerio from 'cheerio';
import * as https from 'https';

const TJA_JALISCO_URL = 'https://tjajal.gob.mx/boletines';

export interface BulletinAdapterInput {
  expedienteNumber: string;
  court?: string;
  year?: number;
}

export interface BulletinParsedEntry {
  expedienteNumber: string;
  court: string;
  agreementDateRaw: string | null;
  publicationDateRaw: string | null;
  sourceUrl: string;
  heading: string;
  extract: string;
  evidenceKind: string;
}

export interface BulletinAdapterResult {
  status: 'FOUND' | 'NOT_FOUND' | 'SOURCE_OFFLINE';
  httpStatus: number;
  entries: BulletinParsedEntry[];
  rawHtml?: string;
  errorMessage?: string;
}

/**
 * Helper to perform an HTTPS GET or POST request using Node's native `https` module.
 * This avoids fetch header sanitization issues when sending Cookie and form-encoded data.
 */
function makeHttpsRequest(
  url: string,
  method: 'GET' | 'POST' = 'GET',
  body?: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: Record<string, string[] | string | undefined>; html: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...headers,
      },
    };

    if (body) {
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body).toString(),
      };
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode || 200,
          headers: res.headers,
          html: data,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

/**
 * Official Bulletin Search Adapter for Tribunal de Justicia Administrativa del Estado de Jalisco (TJA Jalisco).
 * Form URL: https://tjajal.gob.mx/boletines
 */
export async function queryTjaJaliscoBulletin(
  input: BulletinAdapterInput
): Promise<BulletinAdapterResult> {
  try {
    // 1. Initial GET to obtain CakePHP session cookie and _csrfToken
    const getRes = await makeHttpsRequest(TJA_JALISCO_URL, 'GET');
    if (getRes.status >= 400) {
      return {
        status: 'SOURCE_OFFLINE',
        httpStatus: getRes.status,
        entries: [],
        errorMessage: `TJA Jalisco form returned HTTP ${getRes.status}`,
      };
    }

    const rawCookies = getRes.headers['set-cookie'] || [];
    const cookieHeader = Array.isArray(rawCookies)
      ? rawCookies.map((c) => c.split(';')[0]).join('; ')
      : '';

    const $get = Cheerio.load(getRes.html);
    const csrfToken = $get('input[name="_csrfToken"]').val() || '';

    // 2. Prepare Form Data
    const postData = new URLSearchParams({
      _csrfToken: csrfToken.toString(),
      FAcu: '',
      FAcuerdo: '',
      NExpediente: input.expedienteNumber,
      Sala: input.court || '',
    }).toString();

    // 3. POST submission to fetch bulletin search results
    const postRes = await makeHttpsRequest(TJA_JALISCO_URL, 'POST', postData, {
      Cookie: cookieHeader,
      Referer: TJA_JALISCO_URL,
      Origin: 'https://tjajal.gob.mx',
    });

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

      const expCol = cols.find((c) => c.includes('/') && /\d+\/\d+/.test(c));
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
