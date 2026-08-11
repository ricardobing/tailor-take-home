/**
 * logic.gs — Funciones PURAS (sin SpreadsheetApp, sin servicios de Google).
 *
 * Separadas a propósito: este mismo archivo se importa desde Vitest en el repo
 * (tests/apps-script.test.ts) gracias al guard de module.exports del final.
 * Todo lo que toca Google vive en Code.gs.
 */

var LIMITS = {
  NAME_MAX: 120,
  EMAIL_MAX: 254,
  ITEMS_MAX: 50,
  QTY_MAX: 99,
};

// Formato mínimo razonable: algo@algo.tld — no verificamos deliverability.
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Convierte una fila cruda de la hoja "menu" en un producto, o null si la fila
 * está malformada (se filtra sin romper el resto del menú).
 * Fila esperada: [id, name, description, price, available]
 */
function parseMenuRow(row) {
  if (!row || row.length < 5) return null;
  var id = String(row[0] || '').trim();
  var name = String(row[1] || '').trim();
  var description = String(row[2] || '').trim();
  var price = Number(row[3]);
  var available = row[4] === true || String(row[4]).toUpperCase() === 'TRUE';
  if (!id || !name) return null;
  if (!isFinite(price) || price < 0 || Math.floor(price) !== price) return null; // CLP: enteros
  return { id: id, name: name, description: description, price: price, available: available };
}

/**
 * Valida el payload crudo del POST de orden.
 * Devuelve { ok: true, order: {...} } o { ok: false, error: 'codigo' }.
 * No toca la hoja: la existencia de productos y el total real se resuelven en priceOrder().
 */
function validateOrderPayload(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'invalid_payload' };

  // Honeypot: los humanos no ven este campo; si viene con contenido, es un bot.
  if (payload.website) return { ok: false, error: 'rejected' };

  var orderId = String(payload.order_id || '').trim();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(orderId)) return { ok: false, error: 'invalid_order_id' };

  var name = String(payload.name || '').trim();
  if (!name || name.length > LIMITS.NAME_MAX) return { ok: false, error: 'invalid_name' };

  var email = String(payload.email || '').trim();
  if (!EMAIL_RE.test(email) || email.length > LIMITS.EMAIL_MAX) return { ok: false, error: 'invalid_email' };

  if (!Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > LIMITS.ITEMS_MAX) {
    return { ok: false, error: 'invalid_items' };
  }
  var items = [];
  var seen = {};
  for (var i = 0; i < payload.items.length; i++) {
    var it = payload.items[i];
    if (!it || typeof it !== 'object') return { ok: false, error: 'invalid_items' };
    var id = String(it.id || '').trim();
    var qty = Number(it.qty);
    if (!id || seen[id]) return { ok: false, error: 'invalid_items' };
    if (!isFinite(qty) || Math.floor(qty) !== qty || qty < 1 || qty > LIMITS.QTY_MAX) {
      return { ok: false, error: 'invalid_items' };
    }
    seen[id] = true;
    items.push({ id: id, qty: qty });
  }

  var totalClient = Number(payload.total);
  if (!isFinite(totalClient) || totalClient < 0) return { ok: false, error: 'invalid_total' };

  return { ok: true, order: { orderId: orderId, name: name, email: email, items: items, totalClient: totalClient } };
}

/**
 * Re-precia la orden contra el menú REAL de la hoja (nunca confiar en precios
 * del cliente). Rechaza ids desconocidos o productos no disponibles.
 * Devuelve { ok: true, lines: [...], totalServer } o { ok: false, error }.
 */
function priceOrder(items, menuProducts) {
  var byId = {};
  for (var i = 0; i < menuProducts.length; i++) byId[menuProducts[i].id] = menuProducts[i];

  var lines = [];
  var total = 0;
  for (var j = 0; j < items.length; j++) {
    var it = items[j];
    var p = byId[it.id];
    if (!p) return { ok: false, error: 'unknown_product:' + it.id };
    if (!p.available) return { ok: false, error: 'unavailable_product:' + it.id };
    var subtotal = p.price * it.qty;
    lines.push({ id: p.id, name: p.name, unit_price: p.price, qty: it.qty, subtotal: subtotal });
    total += subtotal;
  }
  return { ok: true, lines: lines, totalServer: total };
}

// Guard para tests con Vitest en el repo; en Apps Script `module` no existe y esto se ignora.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LIMITS: LIMITS, parseMenuRow: parseMenuRow, validateOrderPayload: validateOrderPayload, priceOrder: priceOrder };
}
