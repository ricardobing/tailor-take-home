/**
 * Testea EXACTAMENTE el archivo que corre en producción (apps-script/logic.gs):
 * se carga como texto y se evalúa en un sandbox CommonJS mínimo. El guard de
 * module.exports al final de logic.gs expone las funciones puras.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface GsExports {
  LIMITS: { NAME_MAX: number; ITEMS_MAX: number; QTY_MAX: number };
  parseMenuRow(row: unknown[]): { id: string; name: string; price: number; available: boolean } | null;
  validateOrderPayload(payload: unknown): { ok: boolean; error?: string; order?: { items: Array<{ id: string; qty: number }>; totalClient: number } };
  priceOrder(
    items: Array<{ id: string; qty: number }>,
    menu: Array<{ id: string; name: string; price: number; available: boolean }>,
  ): { ok: boolean; error?: string; totalServer?: number; lines?: Array<{ subtotal: number }> };
}

function loadLogicGs(): GsExports {
  const code = readFileSync(fileURLToPath(new URL('../apps-script/logic.gs', import.meta.url)), 'utf8');
  const module = { exports: {} };
  new Function('module', 'exports', code)(module, module.exports);
  return module.exports as GsExports;
}

const { parseMenuRow, validateOrderPayload, priceOrder } = loadLogicGs();

const menu = [
  { id: 'margherita', name: 'Margherita', description: '', price: 8990, available: true },
  { id: 'calzone', name: 'Calzone', description: '', price: 11490, available: false },
];

const validPayload = {
  order_id: 'abc-123-def-456',
  name: 'Ana',
  email: 'ana@mail.com',
  items: [{ id: 'margherita', qty: 2 }],
  total: 17980,
  website: '',
};

describe('parseMenuRow', () => {
  it('parsea una fila válida (available como boolean o "TRUE" de la hoja)', () => {
    expect(parseMenuRow(['margherita', 'Margherita', 'desc', 8990, true])).toMatchObject({ id: 'margherita', price: 8990, available: true });
    expect(parseMenuRow(['margherita', 'Margherita', 'desc', 8990, 'TRUE'])?.available).toBe(true);
    expect(parseMenuRow(['margherita', 'Margherita', 'desc', 8990, 'no'])?.available).toBe(false);
  });

  it('rechaza filas sin id/nombre o con precio no entero/negativo', () => {
    expect(parseMenuRow(['', 'X', '', 100, true])).toBeNull();
    expect(parseMenuRow(['x', '', '', 100, true])).toBeNull();
    expect(parseMenuRow(['x', 'X', '', 'caro', true])).toBeNull();
    expect(parseMenuRow(['x', 'X', '', 99.9, true])).toBeNull();
    expect(parseMenuRow(['x', 'X', '', -5, true])).toBeNull();
  });
});

describe('validateOrderPayload', () => {
  it('acepta un payload válido y normaliza items', () => {
    const result = validateOrderPayload(validPayload);
    expect(result.ok).toBe(true);
    expect(result.order?.items).toEqual([{ id: 'margherita', qty: 2 }]);
  });

  it('honeypot lleno → rechazo silencioso', () => {
    expect(validateOrderPayload({ ...validPayload, website: 'http://spam' })).toEqual({ ok: false, error: 'rejected' });
  });

  it('rechaza order_id ausente o con formato raro', () => {
    for (const bad of [undefined, '', 'corto', 'con espacios aqui!!', 'x'.repeat(65)]) {
      expect(validateOrderPayload({ ...validPayload, order_id: bad }).ok).toBe(false);
    }
  });

  it('rechaza nombre/email inválidos', () => {
    expect(validateOrderPayload({ ...validPayload, name: '' }).error).toBe('invalid_name');
    expect(validateOrderPayload({ ...validPayload, name: 'x'.repeat(121) }).error).toBe('invalid_name');
    expect(validateOrderPayload({ ...validPayload, email: 'nope' }).error).toBe('invalid_email');
  });

  it('rechaza items vacíos, duplicados o con qty inválida', () => {
    expect(validateOrderPayload({ ...validPayload, items: [] }).error).toBe('invalid_items');
    expect(validateOrderPayload({ ...validPayload, items: [{ id: 'a', qty: 1 }, { id: 'a', qty: 2 }] }).error).toBe('invalid_items');
    for (const qty of [0, -1, 1.5, 100, 'dos']) {
      expect(validateOrderPayload({ ...validPayload, items: [{ id: 'a', qty }] }).error).toBe('invalid_items');
    }
  });

  it('rechaza payloads no-objeto', () => {
    for (const bad of [null, 'texto', 42, []]) {
      expect(validateOrderPayload(bad).ok).toBe(false);
    }
  });
});

describe('priceOrder (re-pricing server-side)', () => {
  it('recalcula el total con los precios de la hoja, ignorando el total del cliente', () => {
    const result = priceOrder([{ id: 'margherita', qty: 3 }], menu);
    expect(result.ok).toBe(true);
    expect(result.totalServer).toBe(26970);
  });

  it('rechaza productos desconocidos o no disponibles', () => {
    expect(priceOrder([{ id: 'fantasma', qty: 1 }], menu).error).toMatch(/^unknown_product/);
    expect(priceOrder([{ id: 'calzone', qty: 1 }], menu).error).toMatch(/^unavailable_product/);
  });
});
