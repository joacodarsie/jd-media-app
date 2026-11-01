/**
 * CUERPO DEL SCRIPT DE «Finanzas de Joaquín» — lo sirve la app, lo ejecuta el
 * cargador que vive en la planilla (scripts/planilla-cargador.gs).
 *
 * El dueño pidió no pegar más código a mano: en la planilla queda solo el
 * cargador y todo esto se baja de la app (/api/finanzas/planilla/script).
 * Cuando acá cambia algo, la planilla lo tiene en minutos sin que nadie toque
 * nada.
 *
 * Qué hace:
 *   1. Recibe cada notificación del celular (MacroDroid), la guarda en
 *      «Bandeja», la interpreta y la suma a «Movimientos».
 *   2. Todos los días baja el reporte de Mercado Pago, el dólar y los números
 *      de la app de JD.
 *   3. Cada hora manda a la app los cobros y los sueldos nuevos, que la app
 *      marca sola y el dueño confirma.
 *
 * Es un IIFE que devuelve sus funciones públicas: el cargador hace
 * `eval(codigo)` y recibe el objeto.
 */
(function () {

const ZONA = "America/Argentina/Cordoba";

/** La clave de MacroDroid la pasa el cargador: vive solo en la planilla, nunca en la app. */
function recibir_(e, clave) {
  const p = leerParametros_(e);
  if (!clave || p.token !== clave) return responder_({ ok: false, error: "token" });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const app = String(p.app || "");
    const titulo = String(p.titulo || "");
    const texto = String(p.texto || "");
    const ahora = new Date();
    const clave = [app, titulo, texto].join(" | ");

    const bandeja = hoja_("Bandeja", ["Recibido", "App", "Título", "Texto", "Clave", "Resultado"]);
    if (yaLlego_(bandeja, clave, ahora)) {
      bandeja.appendRow([ahora, app, titulo, texto, clave, "Repetida: no se cargó"]);
      return responder_({ ok: true, repetida: true });
    }

    const mov = interpretar_(app, titulo, texto);
    if (!mov) {
      bandeja.appendRow([ahora, app, titulo, texto, clave, "Sin monto: no es un movimiento"]);
      return responder_({ ok: true, movimiento: false });
    }

    const fila = agregarMovimiento_(ahora, mov);
    bandeja.appendRow([ahora, app, titulo, texto, clave, "Cargada en Movimientos, fila " + fila]);
    return responder_({ ok: true, fila: fila });
  } finally {
    lock.releaseLock();
  }
}

/** MacroDroid puede mandar parámetros (recomendado) o un JSON en el cuerpo. */
function leerParametros_(e) {
  const crudo = (e && e.parameter) || {};
  const p = {};
  Object.keys(crudo).forEach(function (k) {
    p[k.toLowerCase()] = crudo[k];
  });
  if (e && e.postData && e.postData.contents && !p.token) {
    try {
      Object.assign(p, JSON.parse(e.postData.contents));
    } catch (err) {
      // no era JSON: nos quedamos con los parámetros
    }
  }
  return p;
}

function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function hoja_(nombre, encabezados) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.appendRow(encabezados);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** La misma notificación en los últimos 10 minutos: Android a veces la repite. */
function yaLlego_(bandeja, clave, ahora) {
  const ultima = bandeja.getLastRow();
  if (ultima < 2) return false;
  const desde = Math.max(2, ultima - 50);
  const filas = bandeja.getRange(desde, 1, ultima - desde + 1, 6).getValues();
  return filas.some(function (f) {
    return f[4] === clave && String(f[5]).indexOf("Cargada") === 0 && ahora - new Date(f[0]) < 10 * 60 * 1000;
  });
}

// ── Interpretar la notificación ─────────────────────────────────────────────

const ENTRA = /recib|te (envi|transfiri|pag)|ingres|acredit|reintegr|devoluci|revertido|cobraste|te lleg|deposit|rendimient/i;
const SALE = /pagaste|has pagado|enviaste|transferiste|compra|consumo|d[eé]bito|debitamos|retiraste|extracci|se descont|pago de tu|pago realizado|pagaste con/i;

/**
 * Publicidad de los bancos: traen montos ("préstamo de hasta $4.260.000") pero no
 * son movimientos. El 30/10 una de Macro entró como un gasto de $4.260.000 en la
 * Visa y dejó el disponible en −$6,4 millones.
 */
const PUBLICIDAD = /pr[eé]stamo de hasta|hasta \$|ped[ií]lo|sac[aá] tu|oportunidad|promoci[oó]n|beneficio|descuento de|cuotas sin inter[eé]s|click|clic ac[aá]|vigencia hasta|sujeto a (condiciones|aprobaci)|ten[eé]s disponible|pre.?aprobad|aument[aá] tu l[ií]mite|invert[ií]|cartera de consumo/i;

function interpretar_(app, titulo, texto) {
  const todo = (titulo + " " + texto).replace(/\s+/g, " ").trim();
  if (PUBLICIDAD.test(todo) && !/pagaste|te (envi|transfiri)|recibiste|transferiste|compraste|debitamos/i.test(todo)) return null;
  const monto = leerMonto_(todo);
  if (!monto) return null;

  let signo = 0;
  const propia = /te transferiste|transferencia entre (tus|mis) cuentas|a tu cuenta (de|en)/i.test(todo);
  if (propia) signo = /te transferiste|recib|ingres|lleg/i.test(todo) ? 1 : -1;
  else if (SALE.test(todo) && !/te (envi|transfiri)|recibiste|revertido/i.test(todo)) signo = -1;
  else if (ENTRA.test(todo)) signo = 1;

  const cuenta = leerCuenta_(app, todo);
  const regla = aplicarReglas_(todo);
  let categoria = regla ? regla.categoria : "";
  let detalle = regla ? regla.detalle : "";
  if (!categoria && (propia || /FRANCO JOAQU[IÍ]N DARSIE|DARSIE,? FRANCO/i.test(todo))) {
    categoria = "Transferencia entre cuentas";
    detalle = "Otra cuenta tuya";
  }
  if (!categoria && /cuenta (de )?tarjeta|resumen de tu tarjeta|pagaste tu resumen/i.test(todo)) {
    categoria = "Pago de tarjeta";
  }

  const notas = [];
  if (!signo) notas.push("No supe si entra o sale: lo puse como gasto, revisalo");
  if (!categoria) notas.push("Sin categoría");

  return {
    cuenta: cuenta,
    descripcion: todo.slice(0, 250),
    monto: (signo || -1) * monto.valor,
    moneda: monto.moneda,
    categoria: categoria,
    detalle: detalle,
    notas: notas.join(". "),
  };
}

/** "$ 1.234,56" → 1234.56. Toma el primer monto de la notificación. */
function leerMonto_(t) {
  // DolarApp (ARQ) escribe "4.25 USD" o "$4.25 USDc": punto decimal y la moneda
  // después del número. Sin esto, "$4.25" se leía como $425 en pesos.
  const usd = t.match(/(\d+(?:[.,]\d{1,2})?)\s?USDc?\b/i);
  if (usd) {
    const v = Number(usd[1].replace(",", "."));
    if (v) return { valor: v, moneda: "USD" };
  }
  // DolarApp avisa los depósitos en pesos a la inglesa: "Has recibido 50,000 ARS"
  // (coma de miles, moneda después). Antes no se leía y el depósito se perdía.
  const ars = t.match(/(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s?ARS\b/);
  if (ars) {
    const v = Number(ars[1].replace(/,/g, ""));
    if (v) return { valor: v, moneda: "ARS" };
  }
  const m = t.match(/(US\$|U\$S|USDc?|€|\$)\s?([\d.]+(?:,\d{1,2})?)/i);
  if (!m) return null;
  const valor = Number(m[2].replace(/\./g, "").replace(",", "."));
  if (!valor) return null;
  const s = m[1].toUpperCase();
  const moneda = s === "€" ? "EUR" : s === "$" ? "ARS" : "USD";
  return { valor: valor, moneda: moneda };
}

function leerCuenta_(app, t) {
  const a = app.toLowerCase();
  const tarjeta = /tarjeta de cr[eé]dito|con tu tarjeta|compraste|consumo/i.test(t);
  if (/mercado ?pago/.test(a)) return tarjeta ? "Mercado Pago Tarjeta" : "Mercado Pago";
  if (/naranja/.test(a)) return /d[oó]lar|US\$|USD/i.test(t) ? "Naranja X Dólares" : "Naranja X";
  if (/dolarapp|arq/.test(a)) {
    if (tarjeta || /pagaste (en|con)|has pagado|revertido|compra/i.test(t)) return "DolarApp Tarjeta";
    return /US\$|USD/i.test(t) ? "DolarApp" : "DolarApp Pesos";
  }
  if (/macro/.test(a)) return tarjeta ? "Macro Visa" : "Macro Cuenta";
  return "Mercado Pago";
}

/** Pestaña Reglas: «Si la descripción contiene» (A), Categoría (B), Notas (C), desde la fila 5. */
function aplicarReglas_(t) {
  const sh = SpreadsheetApp.getActive().getSheetByName("Reglas");
  if (!sh || sh.getLastRow() < 5) return null;
  const reglas = sh.getRange(5, 1, sh.getLastRow() - 4, 3).getValues();
  const texto = sinTildes_(t).toUpperCase();
  for (let i = 0; i < reglas.length; i++) {
    const clave = sinTildes_(String(reglas[i][0])).toUpperCase().trim();
    if (!clave || texto.indexOf(clave) === -1) continue;
    const nota = String(reglas[i][2] || "");
    const cliente = nota.match(/Cliente[^:]*:\s*([^.(]+)/i);
    return { categoria: String(reglas[i][1]), detalle: cliente ? cliente[1].trim() : nota.split(".")[0] };
  }
  return null;
}

function sinTildes_(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ── Escribir en Movimientos ─────────────────────────────────────────────────

function agregarMovimiento_(fecha, m) {
  const sh = SpreadsheetApp.getActive().getSheetByName("Movimientos");
  const colA = sh.getRange("A2:A").getValues();
  let fila = 2;
  for (let i = colA.length - 1; i >= 0; i--) {
    if (colA[i][0] !== "") {
      fila = i + 3;
      break;
    }
  }
  const dia = new Date(Utilities.formatDate(fecha, ZONA, "yyyy-MM-dd") + "T12:00:00");
  // En dólares, el tipo de cambio de referencia de «Cuentas y disponible» (D19).
  let cambio = "";
  if (m.moneda !== "ARS") {
    const cuentas = SpreadsheetApp.getActive().getSheetByName("Cuentas y disponible");
    cambio = cuentas ? cuentas.getRange("D19").getValue() : "";
  }
  sh.getRange(fila, 1, 1, 12).setValues([[
    dia,
    m.cuenta,
    m.descripcion,
    m.monto,
    m.moneda,
    cambio,
    m.categoria,
    m.detalle,
    "Notificación",
    "No",
    m.categoria.indexOf("JD") === 0 ? "" : "No corresponde",
    m.notas,
  ]]);
  // Las fórmulas de Mes, Ámbito, Tipo y Monto en ARS: si la fila es nueva, se copian de la de arriba.
  if (sh.getRange(fila, 13).getFormula() === "") {
    sh.getRange(fila - 1, 13, 1, 4).copyTo(sh.getRange(fila, 13, 1, 4));
  }
  return fila;
}

// ── Mercado Pago: reporte de liberaciones, todos los días ───────────────────
//
// MP no avisa por notificación cuando VOS transferís. El reporte de
// liberaciones (programado diario en MP → Reportes → Liberaciones) trae todo lo
// que entra y sale, pero sin el nombre de a quién. Este bloque:
//   - baja los reportes nuevos con la API (clave MP_TOKEN en las Propiedades
//     del proyecto, nunca en el código),
//   - no duplica: si el movimiento ya está (por ID o por notificación del mismo
//     día y monto), solo le pone el ID,
//   - si una salida coincide con una entrada del mismo monto en otra cuenta
//     tuya, la marca como transferencia entre cuentas,
//   - lo que no puede saber queda «¿A quién fue?» para revisarlo.

const MP_API = "https://api.mercadopago.com/v1/account/release_report";
// 1/11/2026: el movimiento que cargó este reporte se pisó al completar a mano
// el extracto de Macro. Se vuelve a bajar una vez.
const REIMPORTAR_MP = ["reserve-release-375831356-2026-11-01-035617.csv"];
// Todo lo anterior a esta fecha ya está cargado desde los extractos: no se toca.
const MP_DESDE = "2026-10-29";
const CUENTAS_PROPIAS = ["Naranja X", "DolarApp Pesos", "Macro Cuenta", "Naranja X Dólares", "DolarApp"];

/** Lo corre el disparador diario. También se puede correr a mano. */
function importarMercadoPago() {
  const token = PropertiesService.getScriptProperties().getProperty("MP_TOKEN");
  if (!token) throw new Error("Falta la propiedad MP_TOKEN en Configuración del proyecto.");
  const headers = { Authorization: "Bearer " + token };

  const lista = JSON.parse(UrlFetchApp.fetch(MP_API + "/list", { headers: headers }).getContentText());
  const props = PropertiesService.getScriptProperties();
  // Reportes que hay que volver a cargar una vez (por ejemplo, si se pisó una
  // fila a mano). No duplica: lo que ya está se reconoce por el ID de operación.
  const reimportados = JSON.parse(props.getProperty("MP_REIMPORTADOS") || "[]");
  const aReimportar = REIMPORTAR_MP.filter(function (f) { return reimportados.indexOf(f) === -1; });
  const hechos = JSON.parse(props.getProperty("MP_REPORTES_HECHOS") || "[]").filter(function (f) {
    return aReimportar.indexOf(f) === -1;
  });
  const nuevos = lista
    .filter(function (r) {
      return r.file_name && /\.csv$/i.test(r.file_name) && hechos.indexOf(r.file_name) === -1;
    })
    .sort(function (a, b) {
      return String(a.date_created).localeCompare(String(b.date_created));
    });

  const bandeja = hoja_("Bandeja", ["Recibido", "App", "Título", "Texto", "Clave", "Resultado"]);
  nuevos.forEach(function (r) {
    const csv = UrlFetchApp.fetch(MP_API + "/" + encodeURIComponent(r.file_name), { headers: headers }).getContentText();
    const res = cargarReporteMP_(csv);
    bandeja.appendRow([new Date(), "Mercado Pago (reporte)", r.file_name, "", "", res]);
    hechos.push(r.file_name);
  });
  props.setProperty("MP_REPORTES_HECHOS", JSON.stringify(hechos.slice(-200)));
  if (aReimportar.length) props.setProperty("MP_REIMPORTADOS", JSON.stringify(reimportados.concat(aReimportar).slice(-50)));
}

function cargarReporteMP_(csv) {
  const lineas = csv.split(/\r?\n/).filter(function (l) {
    return l.trim();
  });
  if (lineas.length < 2) return "Reporte vacío";
  const sep = lineas[0].indexOf(";") >= 0 ? ";" : ",";
  const cab = lineas[0].split(sep).map(function (c) {
    return c.trim().replace(/"/g, "");
  });
  const col = function (n) {
    return cab.indexOf(n);
  };

  const sh = SpreadsheetApp.getActive().getSheetByName("Movimientos");
  const datos = sh.getRange(2, 1, sh.getLastRow() - 1, 17).getValues();
  const ids = new Set(
    datos.map(function (f) {
      return String(f[16]);
    })
  );
  let cargados = 0;
  let yaEstaban = 0;
  const rendimientos = {};

  for (let i = 1; i < lineas.length; i++) {
    const c = lineas[i].split(sep).map(function (x) {
      return x.trim().replace(/"/g, "");
    });
    if (c[col("RECORD_TYPE")] !== "release") continue;
    const tipo = c[col("DESCRIPTION")];
    if (tipo === "reserve_for_payout") continue; // se reserva y se libera en el mismo instante
    const id = c[col("SOURCE_ID")];
    const monto = Number(c[col("NET_CREDIT_AMOUNT")] || 0) - Number(c[col("NET_DEBIT_AMOUNT")] || 0);
    if (!monto) continue;
    const fecha = new Date(c[col("DATE")]);
    const dia = Utilities.formatDate(fecha, ZONA, "yyyy-MM-dd");
    if (dia < MP_DESDE) continue;

    if (tipo === "asset_management") {
      rendimientos[dia] = (rendimientos[dia] || 0) + monto;
      continue;
    }
    if (ids.has(id)) {
      yaEstaban++;
      continue;
    }
    // ¿Ya entró por notificación o a mano? Mismo día (±1), misma cuenta y monto, sin ID.
    const fila = buscarFila_(datos, "Mercado Pago", monto, dia);
    if (fila >= 0) {
      sh.getRange(fila + 2, 17).setValue(id);
      datos[fila][16] = id;
      ids.add(id);
      yaEstaban++;
      continue;
    }

    let categoria = "";
    let detalle = "";
    let nota = "";
    if (monto < 0) {
      const destino = buscarEntradaPropia_(datos, -monto, dia);
      if (destino) {
        categoria = "Transferencia entre cuentas";
        detalle = "Hacia " + destino;
      } else {
        nota = "¿A quién fue? El reporte de MP no trae el nombre";
      }
    } else {
      nota = "¿De quién es? El reporte de MP no trae el nombre";
    }
    agregarFilaMP_(sh, dia, tipo === "payout" ? "Transferencia enviada" : "Cobro / ingreso", monto, categoria, detalle, nota, id);
    ids.add(id);
    cargados++;
  }

  Object.keys(rendimientos).forEach(function (dia) {
    const id = "rend-" + dia;
    if (ids.has(id)) return;
    agregarFilaMP_(sh, dia, "Rendimientos de Mercado Pago", rendimientos[dia], "JD · Otros ingresos", "Rendimientos", "", id);
    cargados++;
  });

  return "Cargados " + cargados + ", ya estaban " + yaEstaban;
}

function buscarFila_(datos, cuenta, monto, dia) {
  const d = new Date(dia + "T12:00:00");
  for (let i = datos.length - 1; i >= 0; i--) {
    const f = datos[i];
    if (f[1] !== cuenta || f[16] !== "" || Math.abs(Number(f[3]) - monto) > 0.01) continue;
    if (Math.abs(new Date(f[0]) - d) <= 36 * 3600 * 1000) return i;
  }
  return -1;
}

function buscarEntradaPropia_(datos, monto, dia) {
  const d = new Date(dia + "T12:00:00");
  for (let i = datos.length - 1; i >= 0; i--) {
    const f = datos[i];
    if (CUENTAS_PROPIAS.indexOf(f[1]) === -1 || Math.abs(Number(f[3]) - monto) > 0.01) continue;
    if (Math.abs(new Date(f[0]) - d) <= 36 * 3600 * 1000) return f[1];
  }
  return null;
}

function agregarFilaMP_(sh, dia, descripcion, monto, categoria, detalle, nota, id) {
  const fila = primeraFilaVacia_(sh);
  sh.getRange(fila, 1, 1, 12).setValues([[
    new Date(dia + "T12:00:00"),
    "Mercado Pago",
    descripcion + " (reporte MP)",
    monto,
    "ARS",
    "",
    categoria,
    detalle,
    "Reporte MP",
    categoria ? "Sí" : "No",
    categoria.indexOf("JD") === 0 ? "" : "No corresponde",
    nota,
  ]]);
  sh.getRange(fila, 17).setValue(id);
  if (sh.getRange(fila, 13).getFormula() === "") {
    sh.getRange(fila - 1, 13, 1, 4).copyTo(sh.getRange(fila, 13, 1, 4));
  }
}

function primeraFilaVacia_(sh) {
  const colA = sh.getRange("A2:A").getValues();
  for (let i = colA.length - 1; i >= 0; i--) {
    if (colA[i][0] !== "") return i + 3;
  }
  return 2;
}


// ── El dólar, todos los días ────────────────────────────────────────────────
//
// Antes se cambiaba a mano y quedaba viejo: de ese número dependen la deuda en
// dólares con papá, la meta de US$10.000 y lo que se paga en dólares (Claude,
// Vercel, Meta). Se usa el dólar cripto porque es el que cobra DolarApp.

const DOLAR_API = "https://dolarapi.com/v1/dolares/cripto";

function actualizarDolar() {
  const r = JSON.parse(UrlFetchApp.fetch(DOLAR_API).getContentText());
  const venta = Number(r.venta);
  if (!venta || venta < 100) throw new Error("La cotización vino rara: " + JSON.stringify(r).slice(0, 200));
  const sh = SpreadsheetApp.getActive().getSheetByName("Cuentas y disponible");
  const fila = filaQueEmpieza_(sh, "Dólar de referencia");
  if (!fila) throw new Error("No encontré la fila «Dólar de referencia» en Cuentas y disponible.");
  sh.getRange(fila, 4).setValue(Math.round(venta));
  sh.getRange(fila, 5).setValue(
    "Dólar cripto (el que cobra DolarApp) del " + Utilities.formatDate(new Date(), ZONA, "dd/MM HH:mm") + ". Se actualiza solo todos los días."
  );
}

/** La fila (1, 2, …) cuya columna A empieza con `texto`, o 0. */
function filaQueEmpieza_(sh, texto) {
  const col = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = 0; i < col.length; i++) if (String(col[i][0]).indexOf(texto) === 0) return i + 1;
  return 0;
}

// ── La app de JD: los números de la agencia, todos los días ─────────────────
//
// La app sabe lo que se facturó cada mes, cuánto cuesta el equipo de cada
// cuenta y quién debe. Antes eso se copiaba a mano a esta planilla y quedaba
// viejo. Este bloque lo baja y lo escribe en «Datos de la app»; las otras
// pestañas lo leen con fórmulas. También rehace «Márgenes por cliente»
// conservando las notas que hayas escrito.
//
// La clave va en las Propiedades del proyecto (PLANILLA_TOKEN), nunca acá.

const APP_JD = "https://jd-media-app.vercel.app/api/finanzas/planilla";
const HOJA_APP = "Datos de la app";
// Dónde arranca cada tabla: las fórmulas de las otras pestañas apuntan acá.
const FILA_MESES = 14; // 12 meses: filas 14 a 25
const FILA_CLIENTES = 29; // hasta 60 clientes: filas 29 a 88

function actualizarDesdeApp() {
  const token = PropertiesService.getScriptProperties().getProperty("PLANILLA_TOKEN");
  if (!token) throw new Error("Falta la propiedad PLANILLA_TOKEN en Configuración del proyecto.");
  const res = UrlFetchApp.fetch(APP_JD, { headers: { "x-planilla-token": token }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error("La app contestó " + res.getResponseCode() + ": " + res.getContentText().slice(0, 200));
  }
  const d = JSON.parse(res.getContentText());
  escribirDatosApp_(d);
  escribirMargenes_(d);
  escribirSueldos_(d);
}

/**
 * «Sueldos del 7»: para pagar sin vueltas. Arriba de cada persona, cuánto y a
 * qué alias; abajo, de qué sale (cada cuenta y concepto), para saber por qué.
 */
function escribirSueldos_(d) {
  if (!d.sueldos) return;
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName("Sueldos del 7");
  if (!sh) sh = ss.insertSheet("Sueldos del 7");
  sh.clear();
  const personas = d.sueldos.personas || [];
  const total = personas.reduce(function (a, p) { return a + p.total; }, 0);
  const faltan = personas.reduce(function (a, p) { return a + (p.pagado ? 0 : p.total); }, 0);

  const filas = [
    ["Sueldos de " + d.sueldos.periodo + " (se pagan el 7)", "", "", ""],
    ["Lo calcula la app con lo que se publicó. Cuando pagás, la planilla lo detecta y la app lo marca solo. Se actualiza todos los días: no escribas acá.", "", "", ""],
    ["Total", total, "Falta pagar", faltan],
    ["", "", "", ""],
  ];
  const negritas = [1, 3];
  personas.forEach(function (p) {
    negritas.push(filas.length + 1);
    filas.push([
      p.nombre,
      p.total,
      p.alias ? "Alias: " + p.alias + (p.titular ? " (" + p.titular + ")" : "") : "Sin alias cargado",
      p.pagado ? "Pagado" : "Falta pagar",
    ]);
    (p.lineas || []).forEach(function (l) {
      filas.push(["      " + l.cuenta, l.monto, l.concepto, ""]);
    });
    filas.push(["", "", "", ""]);
  });
  sh.getRange(1, 1, filas.length, 4).setValues(filas);
  sh.getRange(1, 2, filas.length, 1).setNumberFormat('"$"#,##0');
  sh.getRange(3, 4).setNumberFormat('"$"#,##0');
  negritas.forEach(function (f) { sh.getRange(f, 1, 1, 4).setFontWeight("bold"); });
  sh.getRange("A1").setFontSize(14);
  sh.setColumnWidth(1, 260);
  sh.setColumnWidth(3, 380);
}

function escribirDatosApp_(d) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(HOJA_APP);
  if (!sh) sh = ss.insertSheet(HOJA_APP);
  sh.clear();

  const activos = d.clientes.length;
  const abonos = d.clientes.reduce(function (a, c) { return a + c.abono; }, 0);
  const deuda = d.porCobrar.reduce(function (a, c) { return a + c.saldo; }, 0);

  sh.getRange(1, 1, 2, 1).setValues([
    ["Datos de la app de JD"],
    ["Se actualiza solo todos los días a las 8 (o desde el menú JD Media → Actualizar todo ahora). No escribas acá: se borra. Última vez: " +
      Utilities.formatDate(new Date(), ZONA, "dd/MM/yyyy HH:mm")],
  ]);
  const personas = (d.sueldos && d.sueldos.personas) || [];
  const aPagar = personas.reduce(function (a, p) { return a + (p.pagado ? 0 : p.total); }, 0);
  sh.getRange(4, 1, 8, 2).setValues([
    ["Mes en curso", d.periodo],
    ["Dólar que usa la app", d.dolar],
    ["Sueldos del equipo de este mes (se pagan el 7 del que viene)", d.nominaDelMes],
    ["Facturado en los últimos 12 meses (lo que mira el monotributo)", d.facturado12m],
    ["Clientes activos", activos],
    ["Abonos por mes de los clientes activos", abonos],
    ["Falta cobrar (todos los meses)", deuda],
    ["Sueldos que faltan pagar del mes anterior (el 7)", aPagar],
  ]);

  // Sueldos del 7: a cada uno, cuánto y a qué alias. Columnas M a Q.
  sh.getRange(FILA_MESES - 1, 13, 1, 5).setValues([[
    "Sueldos de " + ((d.sueldos && d.sueldos.periodo) || "") + " (se pagan el 7)", "A pagar", "Alias", "A nombre de", "¿Pagado?",
  ]]);
  const filasSueldos = personas.slice(0, 40).map(function (p) {
    return [p.nombre, p.total, p.alias || "", p.titular || "", p.pagado ? "Sí (" + p.montoPagado + ")" : "No"];
  });
  if (filasSueldos.length) sh.getRange(FILA_MESES, 13, filasSueldos.length, 5).setValues(filasSueldos);
  sh.getRange(FILA_MESES, 14, 40, 1).setNumberFormat('"$"#,##0');
  sh.getRange(FILA_MESES - 1, 13, 1, 5).setFontWeight("bold");

  sh.getRange(FILA_MESES - 1, 1, 1, 8).setValues([["Mes", "Facturado", "Cobrado", "Equipo", "Gastos", "Resultado (facturado − equipo − gastos)", "Margen", "Equipo"]]);
  const meses = d.meses.slice(-12).map(function (m) {
    return [m.periodo, m.facturado, m.cobrado, m.equipo, m.gastos, m.resultado, m.margen, m.equipoEstimado ? "Estimado: todavía no se pagó" : "Pagado"];
  });
  // Los meses van como texto: Sheets convertía "2026-01" en una fecha y lo mostraba "2026-1",
  // y las fórmulas que buscan el mes dejaban de encontrarlo.
  sh.getRange(FILA_MESES, 1, 12, 1).setNumberFormat("@");
  if (meses.length) sh.getRange(FILA_MESES, 1, meses.length, 8).setValues(meses);

  sh.getRange(FILA_CLIENTES - 1, 1, 1, 7).setValues([["Cliente", "Pack", "Abono", "Costo del equipo", "Te queda", "Margen", "Desde"]]);
  const clientes = d.clientes.slice(0, 60).map(function (c) {
    return [c.cliente, packLimpio_(c.pack), c.abono, c.costo, c.margen, c.margenPct, c.desde || ""];
  });
  sh.getRange(FILA_CLIENTES, 7, 60, 1).setNumberFormat("@");
  if (clientes.length) sh.getRange(FILA_CLIENTES, 1, clientes.length, 7).setValues(clientes);

  sh.getRange(FILA_MESES - 1, 9, 1, 3).setValues([["Falta cobrar: cliente", "Mes", "Saldo"]]);
  const deudas = d.porCobrar.slice(0, 40).map(function (c) { return [c.cliente, c.periodo, c.saldo]; });
  sh.getRange(FILA_MESES, 10, 40, 1).setNumberFormat("@");
  if (deudas.length) sh.getRange(FILA_MESES, 9, deudas.length, 3).setValues(deudas);

  // Formato: pesos y porcentajes.
  const pesos = '"$"#,##0;-"$"#,##0';
  sh.getRange("B5:B11").setNumberFormat(pesos);
  sh.getRange("B8").setNumberFormat("0");
  sh.getRange(FILA_MESES, 2, 12, 5).setNumberFormat(pesos);
  sh.getRange(FILA_MESES, 7, 12, 1).setNumberFormat("0%");
  sh.getRange(FILA_CLIENTES, 3, 60, 3).setNumberFormat(pesos);
  sh.getRange(FILA_CLIENTES, 6, 60, 1).setNumberFormat("0%");
  sh.getRange(FILA_MESES, 11, 40, 1).setNumberFormat(pesos);
  sh.getRange("A1").setFontSize(14).setFontWeight("bold");
  [FILA_MESES - 1, FILA_CLIENTES - 1].forEach(function (f) { sh.getRange(f, 1, 1, 7).setFontWeight("bold"); });
  sh.getRange(FILA_MESES - 1, 9, 1, 3).setFontWeight("bold");
  sh.setColumnWidth(1, 330);
}

/** "— + Presencia" → "Presencia": la app marca con — los servicios sin pack. */
function packLimpio_(p) {
  const s = String(p || "").replace(/\s*\+\s*—|—\s*\+\s*/g, "").trim();
  return s === "—" ? "" : s;
}

/** Rehace «Márgenes por cliente» con los datos de la app. Las notas (columna F) se conservan por cliente. */
function escribirMargenes_(d) {
  const sh = SpreadsheetApp.getActive().getSheetByName("Márgenes por cliente");
  if (!sh) return;
  const notas = {};
  const viejas = sh.getRange(5, 1, Math.max(sh.getLastRow() - 4, 1), 6).getValues();
  viejas.forEach(function (f) { if (f[0] && f[5]) notas[String(f[0]).trim()] = f[5]; });

  sh.getRange(5, 1, Math.max(sh.getMaxRows() - 4, 1), 6).clearContent();
  sh.getRange(1, 1).setValue("Márgenes por cliente · " + d.periodo);
  sh.getRange(2, 1).setValue(
    "Lo que paga cada cliente contra lo que cuesta su equipo si se entrega el pack completo (tarifas de la app, coordinación y dirección creativa incluidas). Del peor margen al mejor. Se actualiza solo; tus notas de la columna F se conservan."
  );
  const filas = d.clientes.map(function (c) {
    return [c.cliente, c.abono, c.costo, c.margen, c.margenPct, notas[c.cliente] || ""];
  });
  if (!filas.length) return;
  sh.getRange(5, 1, filas.length, 6).setValues(filas);
  const total = 5 + filas.length;
  sh.getRange(total, 1, 1, 6).setValues([[
    "Total por cuentas",
    "=SUM(B5:B" + (total - 1) + ")",
    "=SUM(C5:C" + (total - 1) + ")",
    "=SUM(D5:D" + (total - 1) + ")",
    "=IF(B" + total + ">0,D" + total + "/B" + total + ",0)",
    "Margen bruto: lo que dejan las cuentas antes de herramientas, impuestos y tu sueldo.",
  ]]);
  sh.getRange(total, 1, 1, 6).setFontWeight("bold");
  sh.getRange(5, 2, filas.length + 1, 3).setNumberFormat('"$"#,##0;-"$"#,##0');
  sh.getRange(5, 5, filas.length + 1, 1).setNumberFormat("0%");
  // Rojo suave para lo que queda por debajo del 30%.
  const regla = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0.3)
    .setBackground("#f9d8d8")
    .setRanges([sh.getRange(5, 5, filas.length, 1)])
    .build();
  sh.setConditionalFormatRules([regla]);
}


// ── Cobros y sueldos: la app los marca sola ─────────────────────────────────
//
// Cada hora se mandan a la app los movimientos nuevos de «JD · Cobro de
// cliente» y «JD · Pagos al equipo». La app marca el cobro o el sueldo y le
// pregunta al dueño si estuvo bien (Finanzas → Detectados). Lo que contesta
// queda en la columna K («¿Está en la app de JD?»): con algo escrito ahí, el
// movimiento no se vuelve a mandar. Si la categoría estaba mal, se corrige, se
// borra la K y en la próxima hora se manda de nuevo.

const APP_MOVS = "https://jd-media-app.vercel.app/api/finanzas/planilla/movimientos";
// Lo anterior ya está cargado a mano en la app: no se toca.
const SYNC_DESDE = "2026-11-01";
const CAT_COBRO = "JD · Cobro de cliente";
const CAT_SUELDO = "JD · Pagos al equipo";

function sincronizarConApp() {
  const token = PropertiesService.getScriptProperties().getProperty("PLANILLA_TOKEN");
  if (!token) throw new Error("Falta la propiedad PLANILLA_TOKEN en Configuración del proyecto.");
  const sh = SpreadsheetApp.getActive().getSheetByName("Movimientos");
  const n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  const datos = sh.getRange(2, 1, n, 17).getValues();

  const pendientes = [];
  datos.forEach(function (f, i) {
    const cat = String(f[6]);
    if (cat !== CAT_COBRO && cat !== CAT_SUELDO) return;
    if (String(f[10]).trim()) return;
    const fecha = f[0] instanceof Date ? Utilities.formatDate(f[0], ZONA, "yyyy-MM-dd") : "";
    if (!fecha || fecha < SYNC_DESDE) return;
    const ars = Number(f[15]) || Number(f[3]) || 0;
    // Un cobro entra y un sueldo sale: lo contrario es una devolución, no se marca nada.
    if ((cat === CAT_COBRO && ars <= 0) || (cat === CAT_SUELDO && ars >= 0)) return;
    const clave = String(f[16] || "") || claveDe_([fecha, f[1], f[3], f[2]].join("|"));
    pendientes.push({
      fila: i + 2,
      mov: { clave: clave, fecha: fecha, monto: Math.abs(ars), categoria: cat, detalle: String(f[7] || ""), descripcion: String(f[2] || ""), cuenta: String(f[1] || "") },
    });
  });
  if (!pendientes.length) return 0;

  const res = UrlFetchApp.fetch(APP_MOVS, {
    method: "post",
    contentType: "application/json",
    headers: { "x-planilla-token": token },
    payload: JSON.stringify({ movimientos: pendientes.map(function (p) { return p.mov; }) }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error("La app contestó " + res.getResponseCode() + ": " + res.getContentText().slice(0, 200));
  }
  const porClave = {};
  JSON.parse(res.getContentText()).resultados.forEach(function (r) { porClave[r.clave] = r; });
  let marcados = 0;
  pendientes.forEach(function (p) {
    const r = porClave[p.mov.clave];
    if (!r || r.estado === "ignorado") return;
    const texto =
      r.estado === "marcado" || r.estado === "confirmado" ? "Sí: " + r.mensaje
      : r.estado === "omitido" ? "No corresponde: " + r.mensaje
      : r.estado === "deshecho" ? "Deshecho en la app"
      : "No: " + r.mensaje;
    sh.getRange(p.fila, 11).setValue(texto.slice(0, 250));
    marcados++;
  });
  return marcados;
}

function claveDe_(s) {
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return "p-" + Utilities.base64EncodeWebSafe(d).slice(0, 30);
}

// ── Lo que el cargador puede llamar ─────────────────────────────────────────

/** Todos los días a las 8: el dólar y los números de la app. */
function diario8() {
  actualizarDolar();
  actualizarDesdeApp();
}

/** Todos los días a las 10: el reporte de Mercado Pago. */
function diario10() {
  importarMercadoPago();
  sincronizarConApp();
}

/** Cada hora: Mercado Pago (si hay reportes nuevos) y lo nuevo de cobros y sueldos, a la app. */
function cadaHora() {
  importarMercadoPago();
  sincronizarConApp();
}

function actualizarTodo() {
  actualizarDolar();
  actualizarDesdeApp();
  importarMercadoPago();
  sincronizarConApp();
}

return {
  recibir: recibir_,
  diario8: diario8,
  diario10: diario10,
  cadaHora: cadaHora,
  actualizarTodo: actualizarTodo,
  actualizarDolar: actualizarDolar,
  actualizarDesdeApp: actualizarDesdeApp,
  importarMercadoPago: importarMercadoPago,
  sincronizarConApp: sincronizarConApp,
  // Si cambian, el cargador vuelve a poner los disparadores solo.
  version: "2026-11-01.1",
};
})()
