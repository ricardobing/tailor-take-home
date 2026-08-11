import { useEffect, useState } from 'preact/hooks';
import { fetchMenu } from '../lib/api';
import type { Product } from '../lib/types';
import { Cart } from './Cart';
import { MenuCard } from './MenuCard';

/**
 * Única isla de la página. Recibe el menú pre-renderizado en build (snapshot)
 * y lo revalida contra Apps Script al montar: si la hoja cambió, la UI se
 * actualiza; si el endpoint está caído, el snapshot sigue funcionando y se
 * avisa que los precios podrían estar desactualizados.
 */
export function Shop({ initialProducts, apiUrl, builtFromLive }: {
  initialProducts: Product[];
  apiUrl: string;
  builtFromLive: boolean;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [menuState, setMenuState] = useState<'fresh' | 'validating' | 'stale'>(
    apiUrl ? 'validating' : 'stale',
  );

  useEffect(() => {
    if (!apiUrl) return;
    let cancelled = false;
    fetchMenu(apiUrl)
      .then((fresh) => {
        if (cancelled) return;
        setProducts(fresh);
        setMenuState('fresh');
      })
      .catch(() => {
        if (!cancelled) setMenuState('stale');
      });
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  return (
    <div class="shop">
      {menuState === 'stale' && (
        <p class="banner" role="status">
          {builtFromLive
            ? 'No pudimos actualizar el menú — mostrando la última versión conocida.'
            : 'Mostrando menú de demostración (backend no disponible).'}
        </p>
      )}
      <div class="shop-layout">
        <section class="menu" aria-label="Menú">
          <div class="menu-grid">
            {products.map((p) => (
              <MenuCard key={p.id} product={p} />
            ))}
          </div>
          {products.length === 0 && <p class="muted">No hay productos disponibles en este momento.</p>}
        </section>
        <Cart products={products} apiUrl={apiUrl} />
      </div>
    </div>
  );
}
