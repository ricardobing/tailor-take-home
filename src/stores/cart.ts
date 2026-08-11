/**
 * Store del carrito: wrapper fino de nanostores/persistent sobre la lógica
 * pura de lib/cart.ts. Persiste en localStorage (clave versionada) y se
 * sincroniza entre pestañas gracias a @nanostores/persistent.
 */
import { persistentAtom } from '@nanostores/persistent';
import * as cart from '../lib/cart';
import type { CartState } from '../lib/types';

function decode(raw: string): CartState {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const state: CartState = {};
    for (const [id, qty] of Object.entries(parsed)) {
      if (typeof qty === 'number' && Number.isInteger(qty) && qty > 0) state[id] = Math.min(qty, cart.QTY_MAX);
    }
    return state;
  } catch {
    return {}; // localStorage corrupto → carrito limpio, no página rota
  }
}

export const $cart = persistentAtom<CartState>('pizzeria:cart:v1', {}, { encode: JSON.stringify, decode });

export const add = (id: string) => $cart.set(cart.addItem($cart.get(), id));
export const decrement = (id: string) => $cart.set(cart.decrementItem($cart.get(), id));
export const remove = (id: string) => $cart.set(cart.removeItem($cart.get(), id));
export const clear = () => $cart.set({});
