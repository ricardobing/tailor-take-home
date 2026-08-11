/**
 * Code.gs — Wiring con Google (SpreadsheetApp, ContentService, Cache, Lock).
 * La lógica pura (validación, re-pricing) vive en logic.gs y se testea en el repo.
 *
 * Instalación: ver apps-script/README.md. Resumen:
 *   1) Pegar logic.gs y Code.gs en el editor de Apps Script del Sheet.
 *   2) Recargar el Sheet → menú "🍕 Restaurante" → "Inicializar hojas".
 *   3) Deploy > New deployment > Web app (execute as: Me / access: Anyone).
 */

var SHEET_MENU = 'menu';
var SHEET_ORDERS = 'orders';
var MENU_HEADERS = ['id', 'name', 'description', 'price', 'available'];
var ORDER_HEADERS = ['timestamp', 'order_id', 'customer_name', 'customer_email', 'items_json', 'total_client', 'total_server', 'status'];
var MENU_CACHE_KEY = 'menu_v1';
var MENU_CACHE_SECONDS = 60;

var SEED_MENU = [
  ['margherita', 'Pizza Margherita', 'Salsa de tomate, mozzarella fresca y albahaca.', 8990, true],
  ['pepperoni', 'Pizza Pepperoni', 'Doble pepperoni, mozzarella y orégano.', 10990, true],
  ['cuatro-quesos', 'Pizza Cuatro Quesos', 'Mozzarella, gorgonzola, parmesano y queso de cabra.', 11990, true],
  ['napolitana', 'Pizza Napolitana', 'Tomate, mozzarella, anchoas, alcaparras y aceitunas.', 10490, true],
  ['hawaiana', 'Pizza Hawaiana', 'Jamón, piña caramelizada y mozzarella. Polémica y deliciosa.', 9990, true],
  ['vegetariana', 'Pizza Vegetariana', 'Pimientos, champiñones, cebolla morada, aceitunas y rúcula.', 9490, true],
  ['bebida-500', 'Bebida 500ml', 'Línea Coca-Cola, a elección al retirar.', 1990, true],
  ['tiramisu', 'Tiramisú', 'Clásico italiano de la casa, porción individual.', 4490, true],
  ['calzone', 'Calzone Especial', 'Cerrado al horno con jamón, ricotta y mozzarella.', 11490, false],
];

// ---------------------------------------------------------------- Menú custom

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🍕 Restaurante')
    .addItem('Inicializar hojas (menu + orders)', 'setupSheets')
    .addItem('Restaurar menú de ejemplo', 'resetSeedMenu')
    .addSeparator()
    .addItem('Probar lectura del menú (doGet)', 'debugMenu')
    .addToUi();
}

/** Crea/normaliza las pestañas. Idempotente: no borra datos existentes. */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var menu = ensureSheet_(ss, SHEET_MENU, MENU_HEADERS);
  if (menu.getLastRow() < 2) {
    menu.getRange(2, 1, SEED_MENU.length, MENU_HEADERS.length).setValues(SEED_MENU);
  }
  menu.autoResizeColumns(1, MENU_HEADERS.length);

  ensureSheet_(ss, SHEET_ORDERS, ORDER_HEADERS).autoResizeColumns(1, ORDER_HEADERS.length);

  // Borra la "Hoja 1" vacía por defecto si sigue ahí y sin datos.
  var others = ss.getSheets();
  for (var i = 0; i < others.length; i++) {
    var name = others[i].getName();
    if (name !== SHEET_MENU && name !== SHEET_ORDERS && others[i].getLastRow() === 0) {
      ss.deleteSheet(others[i]);
    }
  }

  CacheService.getScriptCache().remove(MENU_CACHE_KEY);
  SpreadsheetApp.getUi().alert('Listo: pestañas "menu" y "orders" inicializadas.\n\nSiguiente paso: Deploy > New deployment > Web app.');
}

/** Reemplaza el contenido de "menu" por el seed (para demos). Pide confirmación. */
function resetSeedMenu() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert('Restaurar menú', 'Esto BORRA la pestaña "menu" y la vuelve al menú de ejemplo. ¿Continuar?', ui.ButtonSet.OK_CANCEL);
  if (resp !== ui.Button.OK) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var menu = ensureSheet_(ss, SHEET_MENU, MENU_HEADERS);
  var last = menu.getLastRow();
  if (last > 1) menu.getRange(2, 1, last - 1, menu.getLastColumn()).clearContent();
  menu.getRange(2, 1, SEED_MENU.length, MENU_HEADERS.length).setValues(SEED_MENU);
  CacheService.getScriptCache().remove(MENU_CACHE_KEY);
  ui.alert('Menú de ejemplo restaurado.');
}

function debugMenu() {
  var products = readMenu_(true);
  SpreadsheetApp.getUi().alert('doGet devolvería ' + products.length + ' productos disponibles:\n\n' + JSON.stringify(products, null, 2).slice(0, 1200));
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

// ------------------------------------------------------------------- Web App

/** GET → menú disponible como JSON. Cache de 60s para no leer la hoja en cada hit. */
function doGet() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(MENU_CACHE_KEY);
  if (cached) return jsonResponse_(cached);

  var body = JSON.stringify({ ok: true, products: readMenu_(true), generated_at: new Date().toISOString() });
  cache.put(MENU_CACHE_KEY, body, MENU_CACHE_SECONDS);
  return jsonResponse_(body);
}

/**
 * POST → agrega una fila de orden.
 * El cliente envía Content-Type: text/plain (evita el preflight CORS que
 * Apps Script no soporta) con body JSON:
 *   { order_id, name, email, items: [{id, qty}], total, website: "" }
 */
function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : '');
  } catch (err) {
    return jsonResponse_(JSON.stringify({ ok: false, error: 'invalid_json' }));
  }

  var validated = validateOrderPayload(payload);
  if (!validated.ok) return jsonResponse_(JSON.stringify(validated));
  var order = validated.order;

  // Lock: serializa escrituras para que el dedupe por order_id no tenga carreras.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return jsonResponse_(JSON.stringify({ ok: false, error: 'busy' }));
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var orders = ss.getSheetByName(SHEET_ORDERS);
    if (!orders) return jsonResponse_(JSON.stringify({ ok: false, error: 'not_initialized' }));

    // Idempotencia: mismo order_id (retry o doble click) → misma respuesta OK, sin fila nueva.
    if (findOrderId_(orders, order.orderId)) {
      return jsonResponse_(JSON.stringify({ ok: true, order_id: order.orderId, duplicate: true }));
    }

    // Re-pricing contra el menú real; el total del cliente solo se registra para auditoría.
    var priced = priceOrder(order.items, readMenu_(false));
    if (!priced.ok) return jsonResponse_(JSON.stringify(priced));

    var status = priced.totalServer === order.totalClient ? 'received' : 'total_mismatch';
    orders.appendRow([
      new Date(),
      order.orderId,
      order.name,
      order.email,
      JSON.stringify(priced.lines),
      order.totalClient,
      priced.totalServer,
      status,
    ]);

    return jsonResponse_(JSON.stringify({ ok: true, order_id: order.orderId, total: priced.totalServer, status: status }));
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------- Helpers

/** Lee y parsea la pestaña "menu"; filas malformadas se filtran sin romper. */
function readMenu_(onlyAvailable) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MENU);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, MENU_HEADERS.length).getValues();
  var products = [];
  for (var i = 0; i < rows.length; i++) {
    var p = parseMenuRow(rows[i]);
    if (p && (!onlyAvailable || p.available)) products.push(p);
  }
  return products;
}

function findOrderId_(ordersSheet, orderId) {
  var last = ordersSheet.getLastRow();
  if (last < 2) return false;
  var found = ordersSheet.getRange(2, 2, last - 1, 1).createTextFinder(orderId).matchEntireCell(true).findNext();
  return found !== null;
}

function jsonResponse_(body) {
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
