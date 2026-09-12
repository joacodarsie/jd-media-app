/**
 * INFORME DE FINANZAS DE JD MEDIA — script para Google Sheets
 * ============================================================
 *
 * Por qué existe: el dueño no usa Excel. El .xlsx que generaba la app se veía
 * bien en Excel pero al convertirlo a Google Sheets quedaba con detalles rotos.
 * Este script corre DENTRO de su cuenta de Google, pide los datos a la app y
 * arma la planilla con formato nativo de Sheets. No hay conversión de por
 * medio, y la app no necesita ninguna credencial de Google.
 *
 * ── CÓMO INSTALARLO (una sola vez) ──
 *  1. Creá una planilla nueva en tu Drive y llamala "JD Media · Finanzas".
 *  2. Extensiones → Apps Script.
 *  3. Borrá lo que haya y pegá TODO este archivo.
 *  4. Cambiá el TOKEN de abajo por el que te pasó Claude.
 *  5. Guardá (el iconito del disquete).
 *  6. Arriba, donde dice "Seleccionar función", elegí `actualizarInforme` y
 *     apretá "Ejecutar". La primera vez Google te va a pedir permiso: aceptá.
 *     (Va a decir "app no verificada" → "Configuración avanzada" → "Ir a…".
 *     Es tu propio script, corriendo en tu cuenta.)
 *  7. Listo. Volvé a la planilla: arriba aparece el menú "JD Media".
 *
 * ── DESPUÉS ──
 *  · Menú "JD Media" → "Actualizar ahora" para regenerarlo cuando quieras.
 *  · Menú "JD Media" → "Actualizar solo, el día 1 de cada mes" para dejarlo
 *    automático. Después de eso no tenés que volver a tocar nada.
 */

// ─────────────────────────── CONFIGURACIÓN ───────────────────────────

/** El token que te pasó Claude. Sin esto la app no responde. */
var TOKEN = "PEGA_ACA_EL_TOKEN";

/** De dónde salen los datos. */
var APP = "https://jd-media-app.vercel.app";

/**
 * Qué mes traer. "" (vacío) = el mes en curso.
 * Se puede poner "2026-08" para regenerar un mes viejo.
 */
var MES = "";

// ─────────────────────────── SISTEMA VISUAL ───────────────────────────
//
// Pocas reglas, aplicadas siempre igual. La referencia es la planilla que el
// dueño armó a mano y le parece prolija: los resultados van en bandas de color
// llenas de ancho completo, las secciones se abren con una banda gris centrada,
// hay filas vacías entre bloques y no se ven las líneas de la grilla.

var MARCA = "#ffd400";
var VERDE = "#1e7a46";
var ROJO = "#b42318";
var AMBAR = "#fef0c7";
var GRIS = "#e8eaed";
var GRIS_SUAVE = "#f7f8f9";
var TINTA = "#1a1a1a";
var TINTA_SUAVE = "#6b7280";
var BLANCO = "#ffffff";
var LINEA = "#d1d5db";

var FUENTE = "Roboto";
var PESOS = '"$"#,##0;"- $"#,##0';
var PESOS_USD = '"US$ "#,##0';
var PCT = "0%;-0%";

// ─────────────────────────── MENÚ ───────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("JD Media")
    .addItem("Actualizar ahora", "actualizarInforme")
    .addSeparator()
    .addItem("Actualizar solo, el día 1 de cada mes", "activarAutomatico")
    .addItem("Desactivar la actualización automática", "desactivarAutomatico")
    .addToUi();
}

function activarAutomatico() {
  desactivarAutomatico();
  ScriptApp.newTrigger("actualizarInforme")
    .timeBased()
    .onMonthDay(1)
    .atHour(9)
    .create();
  SpreadsheetApp.getActive().toast(
    "Listo: se va a actualizar solo el día 1 de cada mes a las 9.",
    "JD Media",
    8
  );
}

function desactivarAutomatico() {
  var ts = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ts.length; i++) {
    if (ts[i].getHandlerFunction() === "actualizarInforme") ScriptApp.deleteTrigger(ts[i]);
  }
}

// ─────────────────────────── LO PRINCIPAL ───────────────────────────

function actualizarInforme() {
  var ss = SpreadsheetApp.getActive();
  ss.toast("Trayendo los números…", "JD Media", 10);

  var d = traerDatos();
  var meses = [];
  for (var i = 0; i < d.serie.length; i++) {
    var m = d.serie[i];
    if (m.entro > 0 || m.salio > 0) meses.push(m);
  }

  hojaGuia(ss, d, meses);
  hojaResumen(ss, d, meses);
  hojaClientes(ss, d);
  hojaEquipo(ss, d, meses);
  hojaGastosFijos(ss, d);
  hojaCobros(ss, d);
  hojaMovimientos(ss, d);

  // Dejar las hojas en orden y borrar las que sobraron de corridas viejas.
  var orden = [
    "Cómo leer esto",
    "1. Resumen",
    "2. Clientes",
    "3. Equipo",
    "4. Gastos fijos",
    "5. Cobros",
    "6. Movimientos",
  ];
  for (var j = 0; j < orden.length; j++) {
    var h = ss.getSheetByName(orden[j]);
    if (h) {
      ss.setActiveSheet(h);
      ss.moveActiveSheet(j + 1);
    }
  }
  var sobrantes = [];
  var todas = ss.getSheets();
  for (var k = 0; k < todas.length; k++) {
    if (orden.indexOf(todas[k].getName()) === -1) sobrantes.push(todas[k]);
  }
  // Google no deja quedarse sin ninguna hoja, pero acá siempre quedan las 7.
  for (var z = 0; z < sobrantes.length; z++) ss.deleteSheet(sobrantes[z]);
  ss.setActiveSheet(ss.getSheetByName("Cómo leer esto"));
  ss.rename("JD Media · Finanzas · " + mesLargo(d.periodo));
  ss.toast("Informe actualizado.", "JD Media", 5);
}

function traerDatos() {
  if (TOKEN === "PEGA_ACA_EL_TOKEN" || !TOKEN) {
    throw new Error("Falta pegar el TOKEN arriba en el script.");
  }
  var url = APP + "/api/finanzas/informe/datos?token=" + encodeURIComponent(TOKEN);
  if (MES) url += "&m=" + encodeURIComponent(MES);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error("La app respondió " + res.getResponseCode() + ": " + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

// ─────────────────────────── HERRAMIENTAS DE FORMATO ───────────────────────────

/** Deja la hoja vacía y configurada, y devuelve el objeto. */
function prepararHoja(ss, nombre, anchos) {
  var sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  sh.clear();
  sh.clearConditionalFormatRules();
  var congeladas = sh.getFrozenRows();
  if (congeladas > 0) sh.setFrozenRows(0);
  if (sh.getFrozenColumns() > 0) sh.setFrozenColumns(0);
  // Quitar merges viejos, si no fallan los nuevos.
  sh.getRange(1, 1, Math.max(sh.getMaxRows(), 1), Math.max(sh.getMaxColumns(), 1)).breakApart();
  // El filtro y las bandas sobreviven a clear(): si no se sacan, la segunda
  // corrida falla al recrearlos.
  var filtroViejo = sh.getFilter();
  if (filtroViejo) filtroViejo.remove();
  var bandas = sh.getBandings();
  for (var b = 0; b < bandas.length; b++) bandas[b].remove();
  sh.setHiddenGridlines(true);
  for (var i = 0; i < anchos.length; i++) sh.setColumnWidth(i + 1, anchos[i]);
  // Sacar columnas de más, para que la hoja termine donde termina la tabla.
  if (sh.getMaxColumns() > anchos.length) {
    sh.deleteColumns(anchos.length + 1, sh.getMaxColumns() - anchos.length);
  }
  sh.getRange(1, 1, sh.getMaxRows(), anchos.length)
    .setFontFamily(FUENTE)
    .setFontSize(11)
    .setFontColor(TINTA)
    .setVerticalAlignment("middle");
  return sh;
}

/** Título de la hoja: banda amarilla de ancho completo + bajada. */
function titulo(sh, f, texto, bajada, ancho) {
  var t = sh.getRange(f, 1, 1, ancho);
  t.merge().setBackground(MARCA).setValue(texto);
  t.setFontSize(15).setFontWeight("bold").setFontColor(TINTA).setHorizontalAlignment("left");
  sh.setRowHeight(f, 34);

  var b = sh.getRange(f + 1, 1, 1, ancho);
  b.merge().setValue(bajada).setFontSize(10).setFontStyle("italic").setFontColor(TINTA_SUAVE);
  b.setWrap(true);
  sh.setRowHeight(f + 1, 24);
  return aire(sh, f + 2);
}

/** Banda gris centrada que abre un bloque. */
function seccion(sh, f, texto, ancho) {
  var r = sh.getRange(f, 1, 1, ancho);
  r.merge()
    .setBackground(GRIS)
    .setValue(texto)
    .setFontWeight("bold")
    .setFontSize(11)
    .setHorizontalAlignment("center");
  sh.setRowHeight(f, 26);
  return f + 1;
}

/** Encabezado de columnas: sin relleno, con una línea abajo. */
function encabezado(sh, f, celdas) {
  var r = sh.getRange(f, 1, 1, celdas.length);
  r.setValues([celdas])
    .setFontSize(10)
    .setFontWeight("bold")
    .setFontColor(TINTA_SUAVE)
    .setBorder(null, null, true, null, null, null, LINEA, SpreadsheetApp.BorderStyle.SOLID);
  r.setHorizontalAlignment("right");
  sh.getRange(f, 1).setHorizontalAlignment("left");
  sh.setRowHeight(f, 24);
  return f + 1;
}

/**
 * Una fila de datos: etiqueta en A, valores a la derecha.
 * `o` acepta: detalle, rayada, formato, alinearTexto (columnas de texto).
 */
function fila(sh, f, etiqueta, valores, o) {
  o = o || {};
  var ancho = valores.length + 1;
  var datos = [etiqueta].concat(valores);
  var r = sh.getRange(f, 1, 1, ancho);
  r.setValues([datos]);
  r.setHorizontalAlignment("right");
  sh.getRange(f, 1).setHorizontalAlignment("left");
  if (o.formato) sh.getRange(f, 2, 1, valores.length).setNumberFormat(o.formato);
  if (o.rayada) r.setBackground(GRIS_SUAVE);
  if (o.detalle) {
    // El detalle va en la misma celda pero en gris y más chico: se logra con
    // texto enriquecido, que Sheets sí soporta.
    var rico = SpreadsheetApp.newRichTextValue()
      .setText(etiqueta + "   " + o.detalle)
      .setTextStyle(
        0,
        etiqueta.length,
        SpreadsheetApp.newTextStyle().setForegroundColor(TINTA).build()
      )
      .setTextStyle(
        etiqueta.length,
        etiqueta.length + 3 + o.detalle.length,
        SpreadsheetApp.newTextStyle().setForegroundColor(TINTA_SUAVE).setFontSize(9).build()
      )
      .build();
    sh.getRange(f, 1).setRichTextValue(rico);
  }
  sh.setRowHeight(f, 24);
  return f + 1;
}

/**
 * Fila de RESULTADO: banda de color de ANCHO COMPLETO, texto blanco.
 *
 * El ancho completo es lo que estaba mal en la versión de Excel: las bandas
 * ocupaban dos columnas y quedaban como cajitas sueltas en medio de la hoja.
 */
function resultado(sh, f, etiqueta, valores, ancho, o) {
  o = o || {};
  var r = sh.getRange(f, 1, 1, ancho);
  r.setBackground((valores[0] || 0) >= 0 ? VERDE : ROJO);
  r.setFontColor(BLANCO).setFontWeight("bold");
  sh.getRange(f, 1).setValue(etiqueta).setHorizontalAlignment("left").setFontSize(11);

  // Los valores van alineados con la columna de la tabla de arriba: por defecto
  // las últimas, o desde o.columna cuando la tabla tiene columnas vacías al
  // final (el total de Cobros va bajo "Monto", no al borde de la hoja).
  var desde = o.columna ? o.columna : ancho - valores.length + 1;
  var rv = sh.getRange(f, desde, 1, valores.length);
  rv.setValues([valores])
    .setNumberFormat(o.formato || PESOS)
    .setHorizontalAlignment("right")
    .setFontSize(12)
    .setFontWeight("bold")
    .setFontColor(BLANCO);
  // Cada mes se pinta por su propio signo: un mes en rojo entre verdes se ve.
  for (var i = 0; i < valores.length; i++) {
    sh.getRange(f, desde + i).setBackground(valores[i] >= 0 ? VERDE : ROJO);
  }
  sh.setRowHeight(f, 28);
  return f + 1;
}

/** Fila de total: sin relleno, línea doble arriba. */
function total(sh, f, etiqueta, valores, ancho, formato) {
  var desde = ancho - valores.length + 1;
  sh.getRange(f, 1).setValue(etiqueta).setFontWeight("bold");
  var rv = sh.getRange(f, desde, 1, valores.length);
  rv.setValues([valores])
    .setNumberFormat(formato || PESOS)
    .setFontWeight("bold")
    .setHorizontalAlignment("right");
  sh.getRange(f, 1, 1, ancho).setBorder(
    true,
    null,
    null,
    null,
    null,
    null,
    TINTA_SUAVE,
    SpreadsheetApp.BorderStyle.DOUBLE
  );
  sh.setRowHeight(f, 26);
  return f + 1;
}

/** Un párrafo que ocupa todo el ancho. */
function parrafo(sh, f, texto, ancho, o) {
  o = o || {};
  var r = sh.getRange(f, 1, 1, ancho);
  r.merge().setValue(texto).setWrap(true).setVerticalAlignment("middle");
  if (o.negrita) r.setFontWeight("bold");
  if (o.chico) r.setFontSize(10).setFontStyle("italic").setFontColor(TINTA_SUAVE);
  sh.setRowHeight(f, o.alto || 24);
  return f + 1;
}

/** Una fila de aire. */
function aire(sh, f) {
  sh.setRowHeight(f, 12);
  return f + 1;
}

function mesLargo(p) {
  var MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  var partes = String(p).split("-");
  return MESES[Number(partes[1]) - 1] + " de " + partes[0];
}

function mesCorto(p) {
  var C = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  var partes = String(p).split("-");
  return C[Number(partes[1]) - 1] + " " + partes[0].slice(2);
}

function plata(n) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

/** La cascada de un mes: los cuatro pasos. */
function cascada(m) {
  var margen = m.entro - m.equipo;
  var pct = function (n) {
    return m.entro > 0 ? (n / m.entro) * 100 : 0;
  };
  return {
    entro: m.entro,
    equipo: m.equipo,
    margen: margen,
    margenPct: pct(margen),
    fijos: m.gastos,
    fijosPct: pct(m.gastos),
    sueldo: margen - m.gastos,
    sueldoPct: pct(margen - m.gastos),
  };
}

// ─────────────────────────── LAS HOJAS ───────────────────────────

function hojaGuia(ss, d, meses) {
  var ANCHO = 5;
  var sh = prepararHoja(ss, "Cómo leer esto", [330, 130, 130, 130, 130]);
  var f = titulo(
    sh,
    1,
    "Cómo leer este informe",
    "JD Media · cierre de " + mesLargo(d.periodo) + " · actualizado el " + d.generadoEl.slice(0, 10),
    ANCHO
  );

  f = seccion(sh, f, "EL NEGOCIO EN CUATRO PASOS", ANCHO);
  f = aire(sh, f);
  f = parrafo(sh, f, "1.   Entra el abono de cada cliente.", ANCHO);
  f = parrafo(
    sh,
    f,
    "2.   Se paga la producción de ese cliente: diseño, edición, community manager, pauta y coordinación. Lo que queda es el MARGEN DE LA AGENCIA.",
    ANCHO,
    { alto: 40 }
  );
  f = parrafo(
    sh,
    f,
    "3.   Con la suma de todos esos márgenes se pagan los GASTOS FIJOS: monotributo, plataformas, la cuenta propia de la agencia. Son los mismos con 1 cliente o con 20.",
    ANCHO,
    { alto: 40 }
  );
  f = parrafo(sh, f, "4.   Lo que sobra es TU SUELDO.", ANCHO, { negrita: true });
  f = aire(sh, f);
  f = parrafo(
    sh,
    f,
    "La referencia: un " + d.margenes.sano + "% de margen es sano para una cuenta de gestión. Por debajo del " +
      d.margenes.minimo + "%, un mes con una pieza de más se lo come entero.",
    ANCHO,
    { alto: 40 }
  );
  f = aire(sh, f);

  // Los cuatro pasos con los números del mes, para que no sea abstracto.
  var ult = meses.length ? cascada(meses[meses.length - 1]) : null;
  if (ult) {
    f = seccion(sh, f, "LOS CUATRO PASOS CON TUS NÚMEROS DE " + mesLargo(d.periodo).toUpperCase(), ANCHO);
    f = encabezado(sh, f, ["", "", "", "En pesos", "De lo que entró"]);
    f = fila(sh, f, "1.   Entró de los clientes", ["", "", ult.entro, 1], { formato: PESOS });
    sh.getRange(f - 1, 5).setNumberFormat(PCT);
    f = fila(sh, f, "2.   Menos la producción del equipo", ["", "", -ult.equipo, -ult.equipo / (ult.entro || 1)], {
      formato: PESOS,
      rayada: true,
    });
    sh.getRange(f - 1, 5).setNumberFormat(PCT);
    f = resultado(sh, f, "      = MARGEN DE LA AGENCIA", [ult.margen, ult.margenPct / 100], ANCHO);
    sh.getRange(f - 1, 5).setNumberFormat(PCT);
    f = fila(sh, f, "3.   Menos los gastos fijos", ["", "", -ult.fijos, -ult.fijosPct / 100], {
      formato: PESOS,
      rayada: true,
    });
    sh.getRange(f - 1, 5).setNumberFormat(PCT);
    f = resultado(sh, f, "      = TU SUELDO", [ult.sueldo, ult.sueldoPct / 100], ANCHO);
    sh.getRange(f - 1, 5).setNumberFormat(PCT);
    f = aire(sh, f);
  }

  f = seccion(sh, f, "EL PRIMER MES DE UN CLIENTE ES OTRO NEGOCIO", ANCHO);
  f = aire(sh, f);
  f = parrafo(
    sh,
    f,
    "Solo en el primer mes se pagan el manual de marca, la comisión del comercial (" +
      d.margenes.comisionCierre + "% del primer abono) y el plus de arranque (" +
      plata(d.margenes.plusPrimerMes) + " a la community manager y otro tanto al media buyer).",
    ANCHO,
    { alto: 40 }
  );
  f = parrafo(
    sh,
    f,
    "Por eso el primer mes deja mucho menos que los demás. La regla es no perder plata nunca: el precio mínimo de una cotización ya tiene ese arranque adentro. Si una cuenta se va antes del mes 3, el arranque no se recuperó.",
    ANCHO,
    { alto: 56 }
  );
  f = aire(sh, f);

  f = seccion(sh, f, "QUÉ HAY EN CADA HOJA", ANCHO);
  f = aire(sh, f);
  var guia = [
    ["1. Resumen", "La cascada de los cuatro pasos, mes por mes, en pesos y en porcentaje. Es la hoja que se muestra."],
    ["2. Clientes", "Qué deja cada cuenta, de mejor a peor margen. Arriba las que conviene cuidar, abajo las que hay que renegociar."],
    ["3. Equipo", "Lo que cobró cada persona, mes por mes."],
    ["4. Gastos fijos", "La estructura línea por línea, en su moneda y en pesos."],
    ["5. Cobros", "Cada factura: si se cobró, cuándo, y qué saldo queda."],
    ["6. Movimientos", "El libro completo, fecha por fecha. Es el respaldo de todo lo anterior."],
  ];
  for (var i = 0; i < guia.length; i++) {
    sh.getRange(f, 1).setValue(guia[i][0]).setFontWeight("bold");
    var r = sh.getRange(f, 2, 1, ANCHO - 1);
    r.merge().setValue(guia[i][1]).setWrap(true).setHorizontalAlignment("left");
    sh.setRowHeight(f, 38);
    if (i % 2 === 1) sh.getRange(f, 1, 1, ANCHO).setBackground(GRIS_SUAVE);
    f++;
  }
  f = aire(sh, f);

  f = seccion(sh, f, "DE DÓNDE SALEN LOS NÚMEROS", ANCHO);
  f = aire(sh, f);
  f = parrafo(
    sh,
    f,
    "Todo lo que aparece acá es plata que se movió de verdad: facturas con fecha de cobro y pagos con fecha de pago. Lo facturado y todavía no cobrado NO cuenta como ingreso — está aparte, en la hoja Cobros.",
    ANCHO,
    { alto: 56 }
  );
  f = parrafo(
    sh,
    f,
    "Los dólares se convierten con el dólar de Dólar App del día en que se actualizó el informe: " + plata(d.dolar) + ".",
    ANCHO,
    { alto: 32 }
  );
  f = aire(sh, f);

  f = seccion(sh, f, "CÓMO SABER SI PODÉS CONFIAR EN ESTE INFORME", ANCHO);
  f = aire(sh, f);
  f = parrafo(
    sh,
    f,
    "Al final de la hoja Resumen hay un bloque de CONTROL. Compara los totales de hojas distintas entre sí: lo que entró según el Resumen contra la suma de la hoja Cobros, y así con el equipo y los gastos fijos.",
    ANCHO,
    { alto: 56 }
  );
  f = parrafo(
    sh,
    f,
    "Si los tres dicen «Cierra», los números se verifican solos y no dependen de confiarle a nadie. Si alguno dijera «NO CIERRA», ese número está mal: hay que revisarlo antes de usar el informe.",
    ANCHO,
    { alto: 56 }
  );
  sh.setFrozenRows(2);
}

function hojaResumen(ss, d, meses) {
  var ANCHO = meses.length + 1;
  var anchos = [300];
  for (var i = 0; i < meses.length; i++) anchos.push(130);
  var sh = prepararHoja(ss, "1. Resumen", anchos);

  var f = titulo(
    sh,
    1,
    "JD Media · " + mesLargo(d.periodo),
    "De lo que entró a lo que te queda a vos, mes por mes.",
    ANCHO
  );

  var cas = [];
  for (var j = 0; j < meses.length; j++) cas.push(cascada(meses[j]));
  var cabecera = [""];
  for (var k = 0; k < meses.length; k++) cabecera.push(mesCorto(meses[k].periodo));

  var mapa = function (campo, signo) {
    var out = [];
    for (var i2 = 0; i2 < cas.length; i2++) out.push((signo || 1) * cas[i2][campo]);
    return out;
  };

  f = seccion(sh, f, "EN PESOS", ANCHO);
  f = encabezado(sh, f, cabecera);
  f = fila(sh, f, "Entró", mapa("entro"), {
    detalle: "lo que te pagaron los clientes",
    formato: PESOS,
  });
  f = fila(sh, f, "Le pagaste al equipo", mapa("equipo", -1), {
    detalle: "producción de las cuentas",
    formato: PESOS,
    rayada: true,
  });
  f = resultado(sh, f, "MARGEN DE LA AGENCIA", mapa("margen"), ANCHO);
  f = fila(sh, f, "Gastos fijos", mapa("fijos", -1), {
    detalle: "la estructura, con clientes o sin ellos",
    formato: PESOS,
    rayada: true,
  });
  f = resultado(sh, f, "TU SUELDO", mapa("sueldo"), ANCHO);
  f = aire(sh, f);

  f = seccion(sh, f, "EN PORCENTAJE DE LO QUE ENTRÓ", ANCHO);
  f = encabezado(sh, f, cabecera);
  var pctDe = function (campo) {
    var out = [];
    for (var i3 = 0; i3 < cas.length; i3++) out.push(cas[i3][campo] / 100);
    return out;
  };
  f = fila(sh, f, "Margen de la agencia", pctDe("margenPct"), { formato: PCT });
  f = fila(sh, f, "Gastos fijos", pctDe("fijosPct"), { formato: PCT, rayada: true });
  f = resultado(sh, f, "TU SUELDO", pctDe("sueldoPct"), ANCHO, { formato: PCT });
  f = aire(sh, f);

  f = seccion(sh, f, "CONTROL · LAS HOJAS TIENEN QUE DECIR LO MISMO", ANCHO);
  var anchoCtrl = Math.max(4, ANCHO);
  f = encabezado(sh, f, recortar(["Concepto", "Dice el Resumen", "Dice la otra hoja", "¿Cierra?"], anchoCtrl));
  for (var c = 0; c < d.cuadres.length; c++) {
    var q = d.cuadres[c];
    sh.getRange(f, 1).setValue(q.concepto + "   (contra " + q.hojaB + ")");
    sh.getRange(f, 2, 1, 2).setValues([[q.a, q.b]]).setNumberFormat(PESOS).setHorizontalAlignment("right");
    var est = sh.getRange(f, 4);
    est
      .setValue(q.cierra ? "Cierra" : "NO CIERRA")
      .setBackground(q.cierra ? VERDE : ROJO)
      .setFontColor(BLANCO)
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
    sh.setRowHeight(f, 24);
    f++;
  }
  f = aire(sh, f);
  f = parrafo(sh, f, "Si los tres dicen «Cierra», los números se verifican solos. Ver la hoja «Cómo leer esto».", ANCHO, { chico: true });

  sh.setFrozenRows(2);
}

/** Recorta o rellena una lista de encabezados al ancho de la hoja. */
function recortar(celdas, ancho) {
  var out = celdas.slice(0, ancho);
  while (out.length < ancho) out.push("");
  return out;
}

function hojaClientes(ss, d) {
  var ANCHO = 7;
  var sh = prepararHoja(ss, "2. Clientes", [220, 165, 120, 125, 120, 75, 70]);
  var f = titulo(
    sh,
    1,
    "Qué deja cada cuenta",
    "De mejor a peor margen. Los gastos fijos no se descuentan acá: se pagan con la suma de todos estos márgenes.",
    ANCHO
  );

  f = seccion(sh, f, "LAS " + d.clientes.length + " CUENTAS ACTIVAS", ANCHO);
  f = encabezado(sh, f, ["Cliente", "Servicio", "Abono", "Producción", "Margen", "%", "Meses"]);
  var primera = f;

  for (var i = 0; i < d.clientes.length; i++) {
    var c = d.clientes[i];
    sh.getRange(f, 1, 1, ANCHO).setValues([
      [c.cliente, c.servicio, c.abono, -(c.costoEntrega + c.coordinacion), c.margen, c.margenPct / 100, c.meses || 0],
    ]);
    sh.getRange(f, 3, 1, 3).setNumberFormat(PESOS);
    sh.getRange(f, 6).setNumberFormat(PCT);
    sh.getRange(f, 3, 1, 5).setHorizontalAlignment("right");
    sh.getRange(f, 5).setFontWeight("bold");
    sh.getRange(f, 6).setHorizontalAlignment("center");
    if (i % 2 === 1) sh.getRange(f, 1, 1, ANCHO).setBackground(GRIS_SUAVE);
    // El semáforo va solo en el porcentaje: una celda de color por fila.
    if (c.margenPct < 0) {
      sh.getRange(f, 6).setBackground(ROJO).setFontColor(BLANCO).setFontWeight("bold");
    } else if (c.margenPct < d.margenes.minimo) {
      sh.getRange(f, 6).setBackground(AMBAR).setFontWeight("bold");
    }
    sh.setRowHeight(f, 24);
    f++;
  }

  var sAbono = 0, sProd = 0, sMargen = 0;
  for (var j = 0; j < d.clientes.length; j++) {
    sAbono += d.clientes[j].abono;
    sProd += d.clientes[j].costoEntrega + d.clientes[j].coordinacion;
    sMargen += d.clientes[j].margen;
  }
  sh.getRange(f, 1).setValue("TOTAL DE LA CARTERA").setFontWeight("bold");
  sh.getRange(f, 3, 1, 4).setValues([[sAbono, -sProd, sMargen, sAbono > 0 ? sMargen / sAbono : 0]]);
  sh.getRange(f, 3, 1, 3).setNumberFormat(PESOS);
  sh.getRange(f, 6).setNumberFormat(PCT).setHorizontalAlignment("center");
  sh.getRange(f, 1, 1, ANCHO)
    .setFontWeight("bold")
    .setBorder(true, null, null, null, null, null, TINTA_SUAVE, SpreadsheetApp.BorderStyle.DOUBLE);
  sh.getRange(f, 3, 1, 3).setHorizontalAlignment("right");
  sh.setRowHeight(f, 26);
  f++;
  f = aire(sh, f);
  parrafo(
    sh,
    f,
    "En ámbar, las cuentas por debajo del " + d.margenes.minimo + "%. «Producción» junta lo que cuesta entregar el mes más la comisión de coordinación.",
    ANCHO,
    { chico: true, alto: 32 }
  );
  sh.setFrozenRows(primera - 1);
}

function hojaEquipo(ss, d, meses) {
  var ANCHO = meses.length + 2;
  var anchos = [220];
  for (var i = 0; i < meses.length; i++) anchos.push(125);
  anchos.push(135);
  var sh = prepararHoja(ss, "3. Equipo", anchos);
  var f = titulo(sh, 1, "Lo que cobró cada uno", "Mes por mes, según los pagos registrados.", ANCHO);

  f = seccion(sh, f, "EQUIPO", ANCHO);
  var cabecera = ["Persona"];
  for (var j = 0; j < meses.length; j++) cabecera.push(mesCorto(meses[j].periodo));
  cabecera.push("Total");
  f = encabezado(sh, f, cabecera);
  var primera = f;

  for (var k = 0; k < d.equipo.length; k++) {
    var p = d.equipo[k];
    var valores = [];
    for (var m = 0; m < meses.length; m++) valores.push(p.porMes[meses[m].periodo] || "");
    valores.push(p.total);
    f = fila(sh, f, p.persona, valores, { formato: PESOS, rayada: k % 2 === 1 });
    sh.getRange(f - 1, ANCHO).setFontWeight("bold");
  }

  var totales = [];
  for (var n = 0; n < meses.length; n++) {
    var s = 0;
    for (var q = 0; q < d.equipo.length; q++) s += d.equipo[q].porMes[meses[n].periodo] || 0;
    totales.push(s);
  }
  var granTotal = 0;
  for (var r = 0; r < d.equipo.length; r++) granTotal += d.equipo[r].total;
  totales.push(granTotal);
  total(sh, f, "TOTAL", totales, ANCHO);
  sh.setFrozenRows(primera - 1);
}

function hojaGastosFijos(ss, d) {
  var ANCHO = 4;
  var sh = prepararHoja(ss, "4. Gastos fijos", [300, 140, 100, 150]);
  var f = titulo(
    sh,
    1,
    "La estructura",
    "Se paga todos los meses, con clientes o sin ellos. Los dólares van a " + plata(d.dolar) + " (Dólar App).",
    ANCHO
  );
  f = seccion(sh, f, mesLargo(d.periodo).toUpperCase(), ANCHO);
  f = encabezado(sh, f, ["Concepto", "Monto", "Moneda", "En pesos"]);
  var primera = f;

  var suma = 0;
  for (var i = 0; i < d.fijos.length; i++) {
    var g = d.fijos[i];
    suma += g.montoARS;
    sh.getRange(f, 1, 1, ANCHO).setValues([[g.proveedor, g.montoOriginal, g.moneda, Math.round(g.montoARS)]]);
    sh.getRange(f, 2).setNumberFormat(g.moneda === "USD" ? PESOS_USD : PESOS);
    sh.getRange(f, 4).setNumberFormat(PESOS);
    sh.getRange(f, 2, 1, 3).setHorizontalAlignment("right");
    sh.getRange(f, 3).setHorizontalAlignment("center");
    if (i % 2 === 1) sh.getRange(f, 1, 1, ANCHO).setBackground(GRIS_SUAVE);
    sh.setRowHeight(f, 24);
    f++;
  }
  resultado(sh, f, "TOTAL DE LA ESTRUCTURA", [-Math.round(suma)], ANCHO);
  sh.setFrozenRows(primera - 1);
}

function hojaCobros(ss, d) {
  var ANCHO = 6;
  var sh = prepararHoja(ss, "5. Cobros", [220, 100, 130, 100, 140, 130]);
  var f = titulo(
    sh,
    1,
    "Cada factura",
    "Lo cobrado alimenta el Resumen. Lo pendiente todavía no es plata que entró.",
    ANCHO
  );

  var pend = [], cobr = [];
  for (var i = 0; i < d.cobros.length; i++) {
    (d.cobros[i].cobrado ? cobr : pend).push(d.cobros[i]);
  }

  if (pend.length) {
    f = seccion(sh, f, "FALTA COBRAR", ANCHO);
    f = encabezado(sh, f, ["Cliente", "Mes", "Monto", "¿Cobrado?", "Entregó a cuenta", "Saldo"]);
    var sSaldo = 0;
    for (var j = 0; j < pend.length; j++) {
      var c = pend[j];
      sSaldo += c.saldo;
      sh.getRange(f, 1, 1, ANCHO).setValues([[c.cliente, c.periodo, c.monto, "No", c.aCuenta || "", c.saldo]]);
      sh.getRange(f, 3).setNumberFormat(PESOS);
      sh.getRange(f, 5, 1, 2).setNumberFormat(PESOS);
      sh.getRange(f, 3, 1, 4).setHorizontalAlignment("right");
      sh.getRange(f, 2).setHorizontalAlignment("center");
      sh.getRange(f, 4).setHorizontalAlignment("center");
      sh.getRange(f, 6).setBackground(AMBAR).setFontWeight("bold");
      if (j % 2 === 1) sh.getRange(f, 1, 1, 5).setBackground(GRIS_SUAVE);
      sh.setRowHeight(f, 24);
      f++;
    }
    f = total(sh, f, "TOTAL PENDIENTE", [sSaldo], ANCHO);
    f = aire(sh, f);
  }

  f = seccion(sh, f, "COBRADO EN " + mesLargo(d.periodo).toUpperCase(), ANCHO);
  f = encabezado(sh, f, ["Cliente", "Mes", "Monto", "¿Cobrado?", "Fecha de cobro", ""]);
  var primera = f;
  var sCobr = 0;
  for (var k = 0; k < cobr.length; k++) {
    var x = cobr[k];
    sCobr += x.monto;
    sh.getRange(f, 1, 1, 5).setValues([[x.cliente, x.periodo, x.monto, "Sí", x.fechaCobro || "—"]]);
    sh.getRange(f, 3).setNumberFormat(PESOS).setHorizontalAlignment("right");
    sh.getRange(f, 2).setHorizontalAlignment("center");
    sh.getRange(f, 4).setHorizontalAlignment("center");
    sh.getRange(f, 5).setHorizontalAlignment("center");
    if (k % 2 === 1) sh.getRange(f, 1, 1, ANCHO).setBackground(GRIS_SUAVE);
    sh.setRowHeight(f, 24);
    f++;
  }
  resultado(sh, f, "TOTAL COBRADO", [sCobr], ANCHO, { columna: 3 });
  sh.setFrozenRows(2);
}

function hojaMovimientos(ss, d) {
  var ANCHO = 5;
  var sh = prepararHoja(ss, "6. Movimientos", [110, 100, 220, 360, 140]);
  var f = titulo(
    sh,
    1,
    "El libro completo",
    "Todo lo que entró y salió, del más nuevo al más viejo. Es el respaldo de las hojas anteriores.",
    ANCHO
  );
  f = seccion(sh, f, "MOVIMIENTOS", ANCHO);
  f = encabezado(sh, f, ["Fecha", "Tipo", "Contraparte", "Concepto", "Monto"]);
  var primera = f;

  // De una sola vez: escribir fila por fila 100+ veces es lentísimo en Sheets.
  if (d.movimientos.length) {
    var datos = [];
    for (var i = 0; i < d.movimientos.length; i++) {
      var m = d.movimientos[i];
      datos.push([m.fecha, m.tipo, m.contraparte, m.concepto, Math.round(m.montoARS)]);
    }
    var r = sh.getRange(primera, 1, datos.length, ANCHO);
    r.setValues(datos);
    sh.getRange(primera, 5, datos.length, 1).setNumberFormat(PESOS).setHorizontalAlignment("right");
    sh.getRange(primera, 2, datos.length, 1).setHorizontalAlignment("center");

    // Verde lo que entra, rojo lo que sale: una regla, no 100 formatos.
    var rango = sh.getRange(primera, 5, datos.length, 1);
    var entra = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0)
      .setFontColor(VERDE)
      .setRanges([rango])
      .build();
    var sale = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(0)
      .setFontColor(ROJO)
      .setRanges([rango])
      .build();
    sh.setConditionalFormatRules([entra, sale]);

    // Y una banda alternada, también como regla.
    sh.getRange(primera, 1, datos.length, ANCHO).applyRowBanding(
      SpreadsheetApp.BandingTheme.LIGHT_GREY,
      false,
      false
    );
  }

  sh.setFrozenRows(primera - 1);
  sh.getRange(primera - 1, 1, Math.max(d.movimientos.length + 1, 2), ANCHO).createFilter();
}
