import { useStore } from '@nanostores/preact';
import { formatCLP } from '../lib/format';
import type { Product } from '../lib/types';
import { $cart, add, decrement } from '../stores/cart';

export function MenuCard({ product }: { product: Product }) {
  const cart = useStore($cart);
  const qty = cart[product.id] ?? 0;

  return (
    <article class="card">
      <div class="card-body">
        <h3>{product.name}</h3>
        <p class="card-description">{product.description}</p>
      </div>
      <div class="card-footer">
        <span class="card-price">{formatCLP(product.price)}</span>
        {qty === 0 ? (
          <button type="button" class="btn btn-primary" onClick={() => add(product.id)}>
            Agregar
          </button>
        ) : (
          <div class="qty-controls" aria-label={`Cantidad de ${product.name}`}>
            <button type="button" class="btn btn-qty" onClick={() => decrement(product.id)} aria-label={`Quitar una ${product.name}`}>
              −
            </button>
            <span class="qty" aria-live="polite">{qty}</span>
            <button type="button" class="btn btn-qty" onClick={() => add(product.id)} aria-label={`Agregar una ${product.name}`}>
              +
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
