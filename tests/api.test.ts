import { describe, expect, it, vi } from 'vitest';
import { ApiError, fetchMenu, parseMenuResponse, parseProduct, submitOrder } from '../src/lib/api';
import type { OrderPayload } from '../src/lib/types';

const okProduct = { id: 'margherita', name: 'Margherita', description: 'x', price: 8990, available: true };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('parseProduct', () => {
  it('acepta un producto bien formado', () => {
    expect(parseProduct(okProduct)).toEqual(okProduct);
  });

  it('rechaza filas malformadas sin lanzar', () => {
    expect(parseProduct(null)).toBeNull();
    expect(parseProduct({})).toBeNull();
    expect(parseProduct({ ...okProduct, id: '' })).toBeNull();
    expect(parseProduct({ ...okProduct, price: 'gratis' })).toBeNull();
    expect(parseProduct({ ...okProduct, price: 89.9 })).toBeNull(); // CLP: enteros
    expect(parseProduct({ ...okProduct, price: -1 })).toBeNull();
  });
});

describe('parseMenuResponse', () => {
  it('filtra malformados y no disponibles, conserva el resto', () => {
    const products = parseMenuResponse({
      ok: true,
      products: [okProduct, { ...okProduct, id: 'roto', price: NaN }, { ...okProduct, id: 'off', available: false }],
    });
    expect(products.map((p) => p.id)).toEqual(['margherita']);
  });

  it('lanza ApiError si el shape no es el esperado', () => {
    expect(() => parseMenuResponse({ ok: false })).toThrow(ApiError);
    expect(() => parseMenuResponse('html de login')).toThrow(ApiError);
    expect(() => parseMenuResponse(null)).toThrow(ApiError);
  });
});

describe('fetchMenu', () => {
  it('devuelve productos parseados', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ok: true, products: [okProduct] }));
    await expect(fetchMenu('https://x/exec', fetchFn)).resolves.toEqual([okProduct]);
  });

  it('HTTP != 2xx → ApiError http_error', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    await expect(fetchMenu('https://x/exec', fetchFn)).rejects.toMatchObject({ code: 'http_error' });
  });

  it('respuesta HTML (deploy sin acceso Anyone) → ApiError not_json', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('<html>login</html>', { status: 200 }));
    await expect(fetchMenu('https://x/exec', fetchFn)).rejects.toMatchObject({ code: 'not_json' });
  });

  it('caída de red → ApiError network', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(fetchMenu('https://x/exec', fetchFn)).rejects.toMatchObject({ code: 'network' });
  });

  it('timeout → ApiError timeout', async () => {
    const fetchFn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    await expect(fetchMenu('https://x/exec', fetchFn as unknown as typeof fetch, 20)).rejects.toMatchObject({
      code: 'timeout',
    });
  });
});

describe('submitOrder', () => {
  const payload: OrderPayload = {
    order_id: 'abc-123-def-456',
    name: 'Ana',
    email: 'ana@mail.com',
    items: [{ id: 'margherita', qty: 2 }],
    total: 17980,
    website: '',
  };

  it('postea como text/plain (sin preflight CORS) con body JSON', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ok: true, order_id: payload.order_id }));
    const result = await submitOrder('https://x/exec', payload, fetchFn);
    expect(result.ok).toBe(true);
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toContain('text/plain');
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it('propaga el rechazo del servidor sin lanzar (ok: false)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ok: false, error: 'invalid_email' }));
    await expect(submitOrder('https://x/exec', payload, fetchFn)).resolves.toEqual({ ok: false, error: 'invalid_email' });
  });

  it('respuesta sin shape conocido → ApiError bad_response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ sorpresa: true }));
    await expect(submitOrder('https://x/exec', payload, fetchFn)).rejects.toMatchObject({ code: 'bad_response' });
  });
});
