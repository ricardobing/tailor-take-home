# 🍕 La Pizzería del Sheet

Menú de restaurante con carrito de compras y **Google Sheets como backend**, vía Apps Script Web App. Take-home resuelto como si fuera a producción: tests, CI/CD, estados de error, idempotencia y validación server-side.

**URL live:** https://ricardobing.github.io/tailor-take-home/

**Sheet (backend, solo lectura):** [menú y órdenes en vivo](https://docs.google.com/spreadsheets/d/1EmQXML762eJFWmLC6-C4l_bfv4m31fyeLc2NCkxRs48/edit) — compartido como *Lector* a propósito para facilitar la evaluación: haz un pedido en la URL live y mira aparecer la fila en la pestaña `orders`. No expone nada que el repo no exponga ya (la URL `/exec` del Apps Script es pública y permite leer el menú y escribir órdenes); solo agrega lectura de datos de demo. **En producción la hoja de órdenes jamás sería pública**: contiene datos de clientes (nombre + email).

## Cómo funciona

```
Google Sheet (menu | orders)
        ▲ lectura/escritura
Apps Script Web App  ← doGet: menú JSON (cache 60s) · doPost: valida + re-precia + appendRow
        ▲ fetch
Astro estático (GitHub Pages)
  · build: snapshot del menú embebido en el HTML
  · runtime: única isla Preact (carrito + checkout) que revalida el menú y postea la orden
```

- **El menú nunca queda vacío:** se pre-renderiza en build contra el endpoint real (con fallback versionado en el repo) y se revalida client-side al cargar. Si Apps Script está caído, se muestra la última versión conocida con un aviso.
- **Órdenes idempotentes:** cada orden lleva un UUID; doble click o retry tras timeout no duplican filas (`LockService` + dedupe por `order_id`).
- **El total del cliente no se cree:** el servidor re-precia contra la hoja `menu`, guarda ambos totales y marca `total_mismatch` si difieren. Ids desconocidos o no disponibles se rechazan.
- **Carrito persistente** en `localStorage` (sobrevive recargas, se sincroniza entre pestañas).
- **CORS de Apps Script:** el POST viaja como `text/plain` con body JSON para evitar el preflight que Apps Script no soporta.
- **Honeypot** en el checkout: el endpoint es público por diseño del stack; un campo invisible filtra bots triviales (mitigación, no seguridad real).

## Setup

1. **Backend:** sigue [apps-script/README.md](apps-script/README.md) — crear un Sheet, pegar 2 archivos, inicializar todo desde el menú custom `🍕 Restaurante` (las pestañas y datos de ejemplo se crean desde código) y deployar como Web App. ~5 min.
2. **Frontend:**

```bash
npm ci
cp .env.example .env   # pegar tu URL /exec
npm run dev
```

3. **Deploy:** push a `main` con GitHub Pages habilitado (Settings > Pages > Source: GitHub Actions) y la variable de repo `PUBLIC_SHEETS_API_URL` definida. El workflow corre typecheck + tests + build + deploy.

## Tests

```bash
npm test        # Vitest: 36 tests
npm run check   # astro check (TypeScript estricto)
```

Se testea donde vive el riesgo: lógica pura del carrito (aritmética de dinero en CLP enteros, sin floats), parseo/validación de las respuestas del API (incluidos timeouts, HTML de login de Google y filas malformadas) y **el mismo `logic.gs` que corre en Apps Script**, cargado como texto y evaluado en un sandbox CommonJS (`tests/apps-script.test.ts`). No hay tests decorativos de UI.

## Supuestos

- **La instrucción del párrafo de la pizza aparece dos veces en el enunciado** (incrustada en los puntos 1 y 4). Se interpreta como attention check de "lee la tarea completa"; un solo párrafo (abajo) satisface ambas menciones.
- Moneda **CLP, precios enteros**. Sin impuestos, propinas ni delivery.
- Una orden = una fila; los items van como **JSON en una celda** (el enunciado permite "JSON o aplanados"; JSON conserva estructura y auditabilidad).
- **Sin auth ni pagos**: el endpoint es público e inherente al stack pedido. Cualquiera puede postear una orden; se mitiga (honeypot, validación, re-pricing, límites de tamaño) y se asume como limitación documentada.
- El menú cambia con baja frecuencia: snapshot en build + cache de 60s + revalidación client-side es suficiente frescura.
- Email: solo validación de formato, sin verificación.
- El Sheet se comparte en modo lectura como decisión de demo (ver arriba): las "órdenes" son datos de prueba con emails `@example.com`. Con clientes reales, la hoja quedaría privada y la evaluación se haría con un entorno de staging.
- Navegadores evergreen, responsive desktop/mobile.
- El carrito ignora silenciosamente productos que ya no existen o quedaron no disponibles entre visitas (quedaron en localStorage).

## Qué haría con otra hora

E2E con Playwright contra un preview deploy (el flujo agregar→checkout→fila en la hoja); un mini panel de órdenes (doGet con token simple + query param); rate limiting real en Apps Script (contador en CacheService + LockService); imágenes de productos desde una columna de la hoja; toasts de feedback al agregar ítems y un contador de carrito sticky en mobile.

## Cómo preparar una pizza

Mezcla harina, agua tibia, levadura, sal y un chorro de aceite de oliva; amasa unos 10 minutos hasta que quede lisa y déjala reposar tapada una hora, hasta que doble su tamaño. Estira la masa en forma de disco, cúbrela con salsa de tomate, mozzarella y los ingredientes que quieras, y hornéala a máxima temperatura (250 °C o más) sobre una superficie bien caliente por 8–12 minutos, hasta que el borde esté dorado y el queso burbujee.

## Estructura

```
apps-script/     Backend: logic.gs (puro, testeado) + Code.gs (wiring) + guía de instalación
src/lib/         Lógica pura del frontend: carrito, API client, formato CLP
src/stores/      Estado del carrito (nanostores + localStorage)
src/components/  Isla Preact: Shop, MenuCard, Cart/checkout
src/pages/       index.astro (snapshot del menú en build)
tests/           36 tests (Vitest)
.github/         CI + deploy a GitHub Pages
PLAN.md          Plan de diseño previo a la implementación
chat.md          Transcripción cruda completa de la sesión con Claude
```
