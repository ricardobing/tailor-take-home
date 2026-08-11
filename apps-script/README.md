# Backend: Google Sheets + Apps Script

Instalación en ~5 minutos. Todo el estado (pestañas, headers, datos de ejemplo) se crea desde código — no hay que armar nada a mano en la hoja.

## 1. Crear el Sheet y pegar el código

1. Crea un Google Sheet nuevo (cualquier nombre, p. ej. `restaurante-backend`).
2. `Extensiones > Apps Script`.
3. En el editor, crea **dos archivos** y pega el contenido de este repo:
   - `logic.gs` ← [apps-script/logic.gs](logic.gs)
   - `Code.gs` ← [apps-script/Code.gs](Code.gs) (reemplaza el `Code.gs` vacío por defecto)
4. Guarda (Ctrl+S).

## 2. Inicializar las hojas desde el menú

1. Vuelve al Sheet y **recarga la página** (F5) — aparece el menú **🍕 Restaurante**.
2. `🍕 Restaurante > Inicializar hojas (menu + orders)`.
3. La primera vez Google pide autorización: `Revisar permisos > tu cuenta > Avanzado > Ir a ... (no seguro) > Permitir`. (Es tu propio script; el warning es estándar para scripts no verificados.)
4. Si el menú pidió permisos y no ejecutó, vuelve a hacer click en `Inicializar hojas`.

Resultado: pestaña `menu` con 9 productos de ejemplo (uno marcado `available=FALSE` para probar el filtro) y pestaña `orders` vacía con headers.

Extras del menú:
- **Restaurar menú de ejemplo** — vuelve `menu` al seed (pide confirmación).
- **Probar lectura del menú (doGet)** — muestra el JSON que devolvería el endpoint.

## 3. Deployar como Web App

1. En el editor de Apps Script: `Implementar (Deploy) > Nueva implementación`.
2. Tipo: **Aplicación web (Web app)**.
3. Configuración:
   - **Ejecutar como:** Yo (tu cuenta)
   - **Quién tiene acceso:** **Cualquier usuario (Anyone)** ← imprescindible, si no el frontend recibe HTML de login en vez de JSON.
4. `Implementar` y copia la **URL que termina en `/exec`**.

Esa URL es la que consume el frontend (`PUBLIC_SHEETS_API_URL`).

> Si después editas el código: `Deploy > Administrar implementaciones > lápiz > Versión: Nueva versión`. Re-deployar con "Nueva implementación" cambia la URL; editar la existente la conserva.

## 4. Smoke test rápido

- **GET:** abre la URL `/exec` en el navegador → JSON con `{"ok":true,"products":[...]}`.
- **POST:** desde una terminal:

```bash
curl -sL -X POST -H "Content-Type: text/plain" --data '{"order_id":"smoke-test-0001","name":"Test","email":"test@example.com","items":[{"id":"margherita","qty":2}],"total":17980,"website":""}' "URL_EXEC_AQUI"
```

Debería responder `{"ok":true,...,"status":"received"}` y aparecer una fila en `orders`. Repetir el mismo curl responde `duplicate: true` sin crear otra fila (idempotencia).

## Diseño / decisiones

- **`logic.gs` es puro** (sin servicios de Google) y se testea con Vitest en el repo (`tests/apps-script.test.ts`) importando el mismo archivo que corre en producción.
- **Re-pricing server-side:** el total del cliente nunca se usa; se recalcula contra la hoja `menu`. Se guardan ambos totales y `status: total_mismatch` si difieren.
- **Idempotencia:** `order_id` (UUID del cliente) + `LockService` — retry/doble click no duplica filas.
- **CORS:** Apps Script no maneja preflight; el POST usa `Content-Type: text/plain` con body JSON.
- **Cache 60s** en `doGet` para no leer la hoja en cada visita; se invalida al inicializar/restaurar.
