import { describe, expect, it } from 'vitest';
import {
  addItem,
  buildOrderPayload,
  cartLines,
  cartTotal,
  decrementItem,
  itemCount,
  QTY_MAX,
  removeItem,
  setQty,
  validateCheckout,
} from '../src/lib/cart';
import type { Product } from '../src/lib/types';

const products: Product[] = [
  { id: 'margherita', name: 'Margherita', description: '', price: 8990, available: true },
  { id: 'pepperoni', name: 'Pepperoni', description: '', price: 10990, available: true },
  { id: 'calzone', name: 'Calzone', description: '', price: 11490, available: false },
];

describe('mutaciones del carrito', () => {
  it('agrega y acumula cantidades sin mutar el estado original', () => {
    const s0 = {};
    const s1 = addItem(s0, 'margherita');
    const s2 = addItem(s1, 'margherita');
    expect(s2).toEqual({ margherita: 2 });
    expect(s0).toEqual({});
    expect(s1).toEqual({ margherita: 1 });
  });

  it('decrementar a cero elimina la línea', () => {
    const s = decrementItem({ margherita: 1 }, 'margherita');
    expect(s).toEqual({});
  });

  it('decrementar un id inexistente no crea basura', () => {
    expect(decrementItem({}, 'nope')).toEqual({});
  });

  it('removeItem elimina solo esa línea', () => {
    expect(removeItem({ margherita: 2, pepperoni: 1 }, 'margherita')).toEqual({ pepperoni: 1 });
  });

  it('setQty acota al máximo y trunca decimales', () => {
    expect(setQty({}, 'margherita', 500)).toEqual({ margherita: QTY_MAX });
    expect(setQty({}, 'margherita', 2.9)).toEqual({ margherita: 2 });
  });

  it('setQty con valores no válidos elimina la línea', () => {
    expect(setQty({ margherita: 2 }, 'margherita', 0)).toEqual({});
    expect(setQty({ margherita: 2 }, 'margherita', -1)).toEqual({});
    expect(setQty({ margherita: 2 }, 'margherita', NaN)).toEqual({});
  });

  it('itemCount suma todas las cantidades', () => {
    expect(itemCount({ margherita: 2, pepperoni: 3 })).toBe(5);
    expect(itemCount({})).toBe(0);
  });
});

describe('cartLines y total', () => {
  it('resuelve líneas con subtotales exactos (enteros CLP)', () => {
    const lines = cartLines({ margherita: 2, pepperoni: 1 }, products);
    expect(lines).toHaveLength(2);
    const total = cartTotal(lines);
    expect(total).toBe(8990 * 2 + 10990);
    expect(Number.isInteger(total)).toBe(true);
  });

  it('omite productos desconocidos o no disponibles (menú cambió entre visitas)', () => {
    const lines = cartLines({ fantasma: 1, calzone: 2, margherita: 1 }, products);
    expect(lines.map((l) => l.product.id)).toEqual(['margherita']);
  });

  it('carrito vacío → total 0', () => {
    expect(cartTotal([])).toBe(0);
  });
});

describe('buildOrderPayload', () => {
  it('arma el payload con el shape que espera doPost, honeypot vacío', () => {
    const lines = cartLines({ margherita: 2 }, products);
    const payload = buildOrderPayload({ orderId: 'abc-123-def-456', name: '  Ana  ', email: ' ana@mail.com ', lines });
    expect(payload).toEqual({
      order_id: 'abc-123-def-456',
      name: 'Ana',
      email: 'ana@mail.com',
      items: [{ id: 'margherita', qty: 2 }],
      total: 17980,
      website: '',
    });
  });
});

describe('validateCheckout', () => {
  const lines = cartLines({ margherita: 1 }, products);

  it('acepta datos válidos', () => {
    expect(validateCheckout('Ana', 'ana@mail.com', lines)).toBeNull();
  });

  it('rechaza carrito vacío, nombre vacío y emails malformados', () => {
    expect(validateCheckout('Ana', 'ana@mail.com', [])).toMatch(/vacío/);
    expect(validateCheckout('   ', 'ana@mail.com', lines)).toMatch(/nombre/);
    for (const bad of ['', 'sin-arroba', 'a@b', 'a @b.com', 'a@b.c']) {
      expect(validateCheckout('Ana', bad, lines)).toMatch(/email/);
    }
  });
});
