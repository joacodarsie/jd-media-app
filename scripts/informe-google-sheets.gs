/**
 * INFORME DE FINANZAS DE JD MEDIA — cargador para Google Sheets
 * ==============================================================
 *
 * Esto es lo UNICO que va en la planilla, y se pega una sola vez. El codigo que
 * arma el informe no esta aca: se baja de la app en cada corrida. Asi, cuando
 * el informe cambia, la planilla lo tiene sin copiar y pegar nada.
 *
 * -- COMO INSTALARLO (una sola vez) --
 *  1. Extensiones -> Apps Script.
 *  2. Borra lo que haya y pega este archivo entero.
 *  3. Cambia el TOKEN de abajo por el que te paso Claude.
 *  4. Guarda (Ctrl+S).
 *  5. Elegi la funcion `actualizarInforme` y apreta Ejecutar. La primera vez
 *     Google pide permiso: "Configuracion avanzada" -> "Ir a..." -> Permitir.
 *  6. Volve a la planilla y recarga: aparece el menu "JD Media".
 *
 * -- DESPUES, NUNCA MAS --
 *  - Menu "JD Media" -> "Actualizar ahora" cuando quieras.
 *  - Menu "JD Media" -> "Actualizar solo, el dia 1 de cada mes" para dejarlo
 *    andando solo.
 */

/** El token que te paso Claude. Es lo unico secreto de este archivo. */
var TOKEN = "PEGA_ACA_EL_TOKEN";

/** De donde salen los datos y el codigo. */
var APP = "https://jd-media-app.vercel.app";

/** Que mes traer. "" (vacio) = el mes en curso. Ej: "2026-08". */
var MES = "";

// ---------------------------------------------------------------------

function actualizarInforme() {
  var ss = SpreadsheetApp.getActive();
  ss.toast("Trayendo los numeros...", "JD Media", 15);

  // El codigo que arma el informe vive en la app, no aca: asi se actualiza solo.
  // Devuelve la funcion de entrada, que recibe los datos y la planilla.
  var construir = eval(pedirle("/api/finanzas/informe/script"));
  var datos = JSON.parse(pedirle("/api/finanzas/informe/datos"));
  construir(datos, ss);
}

/**
 * Dibuja el menú. Google la llama sola al abrir la planilla; a mano no puede
 * correr —no hay interfaz a la que colgarle el menú— así que si alguien aprieta
 * Ejecutar con esta seleccionada, se avisa en vez de tirar un error críptico.
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("JD Media")
      .addItem("Actualizar ahora", "actualizarInforme")
      .addSeparator()
      .addItem("Actualizar solo, el dia 1 de cada mes", "activarAutomatico")
      .addItem("Desactivar la actualizacion automatica", "desactivarAutomatico")
      .addToUi();
  } catch (e) {
    throw new Error(
      "onOpen solo corre sola al abrir la planilla. Para generar el informe, " +
        "elegí la función actualizarInforme en el desplegable de arriba."
    );
  }
}

function activarAutomatico() {
  desactivarAutomatico();
  ScriptApp.newTrigger("actualizarInforme").timeBased().onMonthDay(1).atHour(9).create();
  SpreadsheetApp.getActive().toast(
    "Listo: se actualiza solo el dia 1 de cada mes a las 9.",
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

/** Le pide algo a la app y devuelve el texto, o explota con un mensaje claro. */
function pedirle(ruta) {
  if (TOKEN === "PEGA_ACA_EL_TOKEN" || !TOKEN) {
    throw new Error("Falta pegar el TOKEN arriba en el script.");
  }
  var url = APP + ruta + (ruta.indexOf("?") === -1 ? "?" : "&") + "token=" + encodeURIComponent(TOKEN);
  if (MES) url += "&m=" + encodeURIComponent(MES);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error("La app respondio " + res.getResponseCode() + ": " + res.getContentText());
  }
  return res.getContentText();
}
