/**
 * Cliente del Web App de Apps Script.
 *
 * Gotcha de CORS: Apps Script no responde preflights OPTIONS, así que el POST
 * viaja con Content-Type text/plain (request "simple", sin preflight) y el
 * body es JSON stringificado. doPost hace JSON.parse del lado del servidor.
 */
import type { OrderPayload, Product, SubmitResult } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type FetchFn = typeof fetch;

/** Valida un producto crudo del JSON; null si está malformado (se filtra). */
export function parseProduct(raw: unknown): Product | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id.trim() : '';
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  const price = typeof r.price === 'number' ? r.price : NaN;
  if (!id || !name) return null;
  if (!Number.isInteger(price) || price < 0) return null;
  return {
    id,
    name,
    description: typeof r.description === 'string' ? r.description : '',
    price,
    available: r.available === true,
  };
}

/** Parsea la respuesta del doGet filtrando filas malformadas sin romper. */
export function parseMenuResponse(json: unknown): Product[] {
  if (typeof json !== 'object' || json === null) throw new ApiError('Respuesta inválida del menú', 'bad_response');
  const body = json as { ok?: unknown; products?: unknown };
  if (body.ok !== true || !Array.isArray(body.products)) {
    throw new ApiError('Respuesta inválida del menú', 'bad_response');
  }
  return body.products
    .map(parseProduct)
    .filter((p): p is Product => p !== null && p.available);
}

export async function fetchMenu(apiUrl: string, fetchFn: FetchFn = fetch, timeoutMs = 10_000): Promise<Product[]> {
  const res = await withTimeout((signal) => fetchFn(apiUrl, { signal }), timeoutMs);
  if (!res.ok) throw new ApiError(`El menú respondió HTTP ${res.status}`, 'http_error');
  return parseMenuResponse(await parseJson(res));
}

export async function submitOrder(
  apiUrl: string,
  payload: OrderPayload,
  fetchFn: FetchFn = fetch,
  timeoutMs = 20_000,
): Promise<SubmitResult> {
  const res = await withTimeout(
    (signal) =>
      fetchFn(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        signal,
      }),
    timeoutMs,
  );
  if (!res.ok) throw new ApiError(`La orden respondió HTTP ${res.status}`, 'http_error');
  const json = (await parseJson(res)) as SubmitResult;
  if (typeof json !== 'object' || json === null || typeof json.ok !== 'boolean') {
    throw new ApiError('Respuesta inválida al enviar la orden', 'bad_response');
  }
  return json;
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    // Apps Script devuelve HTML (página de login) si el deploy no es "Anyone".
    throw new ApiError('La respuesta no es JSON — ¿el Web App está deployado con acceso "Anyone"?', 'not_json');
  }
}

async function withTimeout(run: (signal: AbortSignal) => Promise<Response>, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (controller.signal.aborted) throw new ApiError('Tiempo de espera agotado', 'timeout');
    throw new ApiError('Error de red', 'network');
  } finally {
    clearTimeout(timer);
  }
}
