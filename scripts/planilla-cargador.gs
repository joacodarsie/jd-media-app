/**
 * FINANZAS DE JOAQUÍN — cargador del script de la planilla
 * ========================================================
 *
 * Esto es lo ÚNICO que va en Extensiones → Apps Script, y se pega una sola
 * vez. El código que hace todo (leer las notificaciones del celular, el
 * reporte de Mercado Pago, el dólar, los números de la app de JD y marcar
 * cobros y sueldos) no está acá: se baja de la app de JD cada vez que corre.
 * Así, cuando Claude lo mejora, tu planilla lo tiene sola, sin pegar nada.
 *
 * Necesita, en Configuración del proyecto → Propiedades:
 *   - PLANILLA_TOKEN (la clave para hablar con la app de JD)
 *   - MP_TOKEN (la de Mercado Pago)
 *
 * Los disparadores (8 h, 10 h y cada hora) se ponen solos la primera vez que
 * corre cualquier cosa. Si querés forzarlo: Ejecutar → instalar.
 */

/** La misma clave que tiene MacroDroid. Vive solo acá, en tu planilla. */
var CLAVE_MACRODROID = "PEGA_ACA_LA_CLAVE_DE_MACRODROID";

var APP = "https://jd-media-app.vercel.app";
var ZONA_CARGADOR = "America/Argentina/Cordoba";

// ── Lo que llaman MacroDroid, los disparadores y el menú ────────────────────

function doPost(e) {
  return recibir_(e);
}

function doGet(e) {
  return recibir_(e);
}

function diario8() {
  codigo_().diario8();
}

function diario10() {
  codigo_().diario10();
}

function cadaHora() {
  codigo_().cadaHora();
}

/** Para correr a mano: trae todo de nuevo (dólar, app, Mercado Pago y cobros/sueldos). */
function actualizarTodo() {
  codigo_().actualizarTodo();
  SpreadsheetApp.getActive().toast("Listo: todo actualizado.", "JD Media", 5);
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("JD Media")
      .addItem("Actualizar todo ahora", "actualizarTodo")
      .addToUi();
  } catch (e) {
    // Sin interfaz (corrida automática): no hay menú que dibujar.
  }
}

/** Pone los disparadores. Corre solo la primera vez; a mano, si hiciera falta. */
function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("diario8").timeBased().everyDays(1).atHour(8).inTimezone(ZONA_CARGADOR).create();
  ScriptApp.newTrigger("diario10").timeBased().everyDays(1).atHour(10).inTimezone(ZONA_CARGADOR).create();
  ScriptApp.newTrigger("cadaHora").timeBased().everyHours(1).create();
  PropertiesService.getScriptProperties().setProperty("DISPARADORES", "v1");
}

// ── Por dentro ──────────────────────────────────────────────────────────────

function recibir_(e) {
  try {
    return codigo_().recibir(e, CLAVE_MACRODROID);
  } catch (err) {
    // Si la app no contesta, la notificación no se pierde: queda en la Bandeja.
    var sh = SpreadsheetApp.getActive().getSheetByName("Bandeja");
    var p = (e && e.parameter) || {};
    if (sh && p.token === CLAVE_MACRODROID) {
      sh.appendRow([new Date(), String(p.app || ""), String(p.titulo || ""), String(p.texto || ""), "", "Sin cargar: " + String(err).slice(0, 150)]);
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: false })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * El código de la app. Se guarda 10 minutos en la caché y una copia en las
 * propiedades del proyecto: si la app no contesta, se usa la última que anduvo.
 */
function codigo_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty("DISPARADORES") !== "v1") {
    try {
      instalar();
    } catch (e) {
      // Sin permiso todavía (primera vez desde MacroDroid): se pone la próxima.
    }
  }

  var cache = CacheService.getScriptCache();
  var texto = cache.get("codigo");
  if (!texto) {
    texto = bajarCodigo_(props.getProperty("PLANILLA_TOKEN"));
    if (texto) {
      cache.put("codigo", texto, 600);
      guardarCopia_(props, texto);
    } else {
      texto = leerCopia_(props);
    }
  }
  if (!texto) throw new Error("No pude bajar el código de la app y no hay copia guardada.");
  return eval(texto);
}

function bajarCodigo_(token) {
  if (!token) throw new Error("Falta la propiedad PLANILLA_TOKEN en Configuración del proyecto.");
  try {
    var res = UrlFetchApp.fetch(APP + "/api/finanzas/planilla/script", {
      headers: { "x-planilla-token": token },
      muteHttpExceptions: true,
    });
    return res.getResponseCode() === 200 ? res.getContentText() : null;
  } catch (e) {
    return null;
  }
}

// Una propiedad guarda hasta 9 KB: la copia va en pedazos.
var PEDAZO = 8000;

function guardarCopia_(props, texto) {
  if (props.getProperty("COPIA_LARGO") === String(texto.length) && leerCopia_(props) === texto) return;
  var n = Math.ceil(texto.length / PEDAZO);
  var datos = { COPIA_PARTES: String(n), COPIA_LARGO: String(texto.length) };
  for (var i = 0; i < n; i++) datos["COPIA_" + i] = texto.slice(i * PEDAZO, (i + 1) * PEDAZO);
  props.setProperties(datos);
}

function leerCopia_(props) {
  var n = Number(props.getProperty("COPIA_PARTES") || 0);
  if (!n) return null;
  var partes = [];
  for (var i = 0; i < n; i++) partes.push(props.getProperty("COPIA_" + i) || "");
  return partes.join("");
}
