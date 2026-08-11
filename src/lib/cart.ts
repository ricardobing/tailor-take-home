/**
 * Lógica pura del carrito. Sin DOM, sin stores, sin fetch — todo testeable.
 * Los precios son CLP enteros: la aritmética es exacta, sin floats.
 */
import type { CartLine, CartState, OrderPayload, Product } from './types';

export const QTY_MAX = 99;

export function addItem(state: CartState, id: string): CartState {
  return setQty(state, id, (state[id] ?? 0) + 1);
}

export function decrementItem(state: CartState, id: string): CartState {
  return setQty(state, id, (state[id] ?? 0) - 1);
}

export function removeItem(state: CartState, id: string): CartState {
  const { [id]: _removed, ...rest } = state;
  return rest;
}

/** qty <= 0 elimina la línea; se acota a QTY_MAX y a enteros. */
export function setQty(state: CartState, id: string, qty: number): CartState {
  const n = Math.floor(qty);
  if (!Number.isFinite(n) || n <= 0) return removeItem(state, id);
  return { ...state, [id]: Math.min(n, QTY_MAX) };
}

export function itemCount(state: CartState): number {
  return Object.values(state).reduce((sum, qty) => sum + qty, 0);
}

/**
 * Resuelve el carrito contra el menú vigente. Ids que ya no existen o quedaron
 * no disponibles se omiten (el producto salió del menú entre visitas).
 */
export function cartLines(state: CartState, products: Product[]): CartLine[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: CartLine[] = [];
  for (const [id, qty] of Object.entries(state)) {
    const product = byId.get(id);
    if (!product || !product.available) continue;
    lines.push({ product, qty, subtotal: product.price * qty });
  }
  return lines;
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.subtotal, 0);
}

export function buildOrderPayload(args: {
  orderId: string;
  name: string;
  email: string;
  lines: CartLine[];
}): OrderPayload {
  return {
    order_id: args.orderId,
    name: args.name.trim(),
    email: args.email.trim(),
    items: args.lines.map((l) => ({ id: l.product.id, qty: l.qty })),
    total: cartTotal(args.lines),
    website: '',
  };
}

/** Validación de checkout en cliente. El servidor re-valida todo igual. */
export function validateCheckout(name: string, email: string, lines: CartLine[]): string | null {
  if (lines.length === 0) return 'El carrito está vacío.';
  if (!name.trim()) return 'Ingresa tu nombre.';
  if (name.trim().length > 120) return 'El nombre es demasiado largo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return 'Ingresa un email válido.';
  return null;
}
