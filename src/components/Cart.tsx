import { useStore } from '@nanostores/preact';
import { useState } from 'preact/hooks';
import { ApiError, submitOrder } from '../lib/api';
import { buildOrderPayload, cartLines, cartTotal, validateCheckout } from '../lib/cart';
import { formatCLP } from '../lib/format';
import type { Product } from '../lib/types';
import { $cart, clear, remove } from '../stores/cart';

type SendState =
  | { phase: 'idle' }
  | { phase: 'sending' }
  | { phase: 'success'; orderId: string; total: number }
  | { phase: 'error'; message: string };

export function Cart({ products, apiUrl }: { products: Product[]; apiUrl: string }) {
  const cart = useStore($cart);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [send, setSend] = useState<SendState>({ phase: 'idle' });
  const [website, setWebsite] = useState(''); // honeypot: humanos nunca lo llenan
  // El order_id se fija al primer intento: los retries reusan el mismo UUID y
  // el backend dedupea — reintentar tras un timeout no duplica la orden.
  const [orderId, setOrderId] = useState<string | null>(null);

  const lines = cartLines(cart, products);
  const total = cartTotal(lines);

  async function onSubmit(e: Event) {
    e.preventDefault();
    if (send.phase === 'sending') return;

    const validationError = validateCheckout(name, email, lines);
    if (validationError) {
      setSend({ phase: 'error', message: validationError });
      return;
    }
    if (!apiUrl) {
      setSend({ phase: 'error', message: 'Backend no configurado (falta PUBLIC_SHEETS_API_URL).' });
      return;
    }

    const id = orderId ?? crypto.randomUUID();
    setOrderId(id);
    setSend({ phase: 'sending' });

    try {
      const result = await submitOrder(apiUrl, { ...buildOrderPayload({ orderId: id, name, email, lines }), website });
      if (result.ok) {
        setSend({ phase: 'success', orderId: id, total: result.total ?? total });
        clear(); // solo se vacía el carrito cuando el backend confirmó
        setOrderId(null);
      } else {
        setSend({ phase: 'error', message: `El servidor rechazó la orden (${result.error ?? 'desconocido'}).` });
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error inesperado.';
      setSend({ phase: 'error', message: `${message} Tu carrito sigue intacto — vuelve a intentar.` });
    }
  }

  if (send.phase === 'success') {
    return (
      <section class="cart" aria-label="Carrito">
        <div class="cart-success" role="status">
          <h2>¡Orden enviada! 🎉</h2>
          <p>
            Total: <strong>{formatCLP(send.total)}</strong>
          </p>
          <p class="muted">Referencia: {send.orderId}</p>
          <button type="button" class="btn btn-primary" onClick={() => setSend({ phase: 'idle' })}>
            Hacer otro pedido
          </button>
        </div>
      </section>
    );
  }

  return (
    <section class="cart" aria-label="Carrito">
      <h2>Tu pedido</h2>
      {lines.length === 0 ? (
        <p class="muted">El carrito está vacío. Agrega algo del menú 🍕</p>
      ) : (
        <>
          <ul class="cart-lines">
            {lines.map((line) => (
              <li key={line.product.id} class="cart-line">
                <span class="cart-line-name">
                  {line.qty} × {line.product.name}
                </span>
                <span class="cart-line-subtotal">{formatCLP(line.subtotal)}</span>
                <button
                  type="button"
                  class="btn btn-ghost"
                  onClick={() => remove(line.product.id)}
                  aria-label={`Eliminar ${line.product.name} del carrito`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <p class="cart-total" aria-live="polite">
            Total: <strong>{formatCLP(total)}</strong>
          </p>
          <form onSubmit={onSubmit} class="checkout" noValidate>
            <label>
              Nombre
              <input
                type="text"
                name="name"
                value={name}
                maxLength={120}
                required
                autocomplete="name"
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                name="email"
                value={email}
                required
                autocomplete="email"
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              />
            </label>
            {/* Honeypot: invisible para humanos; si un bot lo llena, el backend descarta. */}
            <label class="hp" aria-hidden="true">
              Website
              <input
                type="text"
                name="website"
                value={website}
                tabIndex={-1}
                autocomplete="off"
                onInput={(e) => setWebsite((e.target as HTMLInputElement).value)}
              />
            </label>
            <button type="submit" class="btn btn-primary btn-submit" disabled={send.phase === 'sending'}>
              {send.phase === 'sending' ? 'Enviando…' : 'Enviar orden'}
            </button>
          </form>
        </>
      )}
      {send.phase === 'error' && (
        <p class="cart-error" role="alert">
          {send.message}
        </p>
      )}
    </section>
  );
}
