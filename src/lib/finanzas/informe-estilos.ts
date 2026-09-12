import type ExcelJS from "exceljs";

/**
 * El sistema visual del informe. Un solo lugar, pocas reglas.
 *
 * El primer informe salió —palabras del dueño— "soso, mucho números, medio
 * mareador". El problema no era la información sino que había demasiadas
 * variantes tipográficas y ninguna jerarquía: todo pesaba igual.
 *
 * La referencia es la planilla que él mismo armó con Leo y que le parece
 * prolija. Lo que la hace legible:
 *   · Los resultados van en BANDAS DE COLOR LLENAS, no en negrita.
 *   · Las secciones se separan con una banda gris centrada, no con un título.
 *   · Hay filas vacías entre bloques. El aire es la mitad del diseño.
 *   · No se ven las líneas de la grilla.
 *
 * Así que acá hay exactamente dos tamaños de letra para datos, cuatro rellenos
 * y una sola fuente. Todo lo que no esté en esta lista no se usa.
 */

// ── Paleta ──
/** Amarillo de la marca: solo en el título de la hoja. */
export const MARCA = "FFFFD400";
/** Verde de resultado: relleno con texto blanco. */
export const VERDE = "FF1E7A46";
/** Rojo de pérdida: relleno con texto blanco. */
export const ROJO = "FFB42318";
/** Ámbar de atención: relleno suave, texto oscuro. */
export const AMBAR = "FFFEF0C7";
/** Gris de las bandas de sección. */
export const GRIS = "FFE8EAED";
/** Gris muy suave, para las filas alternadas. */
export const GRIS_SUAVE = "FFF7F8F9";
export const TINTA = "FF1A1A1A";
export const TINTA_SUAVE = "FF6B7280";
export const BLANCO = "FFFFFFFF";
export const LINEA = "FFD1D5DB";

const FUENTE = "Calibri";

// ── Formatos de número ──
/** Pesos, con el menos separado como en la planilla de referencia: "- $32.000". */
export const PESOS = '"$"#,##0;"- $"#,##0';
export const PORCENTAJE = "0%;-0%";
export const ENTERO = "#,##0";

/** Alturas, para que las filas respiren. */
export const ALTO = { titulo: 30, seccion: 22, fila: 19, aire: 8 };

type Cell = ExcelJS.Cell;
type Row = ExcelJS.Row;
type Sheet = ExcelJS.Worksheet;

function relleno(color: string): ExcelJS.FillPattern {
  return { type: "pattern", pattern: "solid", fgColor: { argb: color } };
}

/** Crea la hoja ya configurada: sin grilla, con la primera columna ancha. */
export function hoja(wb: ExcelJS.Workbook, nombre: string, cols: number[], congelar?: { x?: number; y?: number }): Sheet {
  const ws = wb.addWorksheet(nombre, {
    views: [
      {
        // Sin líneas de grilla: los bloques se separan con color y con aire.
        showGridLines: false,
        state: congelar ? "frozen" : "normal",
        xSplit: congelar?.x ?? 0,
        ySplit: congelar?.y ?? 0,
      },
    ],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  cols.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  ws.properties.defaultRowHeight = ALTO.fila;
  return ws;
}

/**
 * El título de la hoja: una línea amarilla con el nombre, y abajo una bajada
 * que dice en una frase qué se contesta acá. Devuelve la próxima fila libre.
 */
export function titulo(ws: Sheet, fila: number, texto: string, bajada: string, ancho: number): number {
  const t = ws.getRow(fila);
  t.height = ALTO.titulo;
  for (let c = 1; c <= ancho; c++) t.getCell(c).fill = relleno(MARCA);
  const c1 = t.getCell(1);
  c1.value = texto;
  c1.font = { name: FUENTE, size: 15, bold: true, color: { argb: TINTA } };
  c1.alignment = { vertical: "middle", indent: 1 };

  const b = ws.getRow(fila + 1);
  b.height = ALTO.fila;
  const b1 = b.getCell(1);
  b1.value = bajada;
  b1.font = { name: FUENTE, size: 10, italic: true, color: { argb: TINTA_SUAVE } };
  b1.alignment = { vertical: "middle", indent: 1 };
  return fila + 3; // deja una fila de aire
}

/** Banda gris centrada que abre un bloque. Devuelve la próxima fila libre. */
export function seccion(ws: Sheet, fila: number, texto: string, ancho: number): number {
  const r = ws.getRow(fila);
  r.height = ALTO.seccion;
  for (let c = 1; c <= ancho; c++) {
    const cell = r.getCell(c);
    cell.fill = relleno(GRIS);
    cell.font = { name: FUENTE, size: 11, bold: true, color: { argb: TINTA } };
  }
  r.getCell(1).value = texto;
  // Centrado a lo largo de todo el bloque, como en la planilla de referencia.
  ws.mergeCells(fila, 1, fila, Math.max(1, ancho));
  r.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  return fila + 1;
}

/** Encabezado de columnas: sin relleno, con una línea abajo. */
export function encabezado(ws: Sheet, fila: number, celdas: (string | null)[]): number {
  const r = ws.getRow(fila);
  r.height = ALTO.fila;
  celdas.forEach((t, i) => {
    const c = r.getCell(i + 1);
    if (t != null) c.value = t;
    c.font = { name: FUENTE, size: 10, bold: true, color: { argb: TINTA_SUAVE } };
    c.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center", indent: i === 0 ? 1 : 0 };
    c.border = { bottom: { style: "thin", color: { argb: LINEA } } };
  });
  return fila + 1;
}

export interface OpcionesFila {
  /** Texto chico y gris que va al lado de la etiqueta. */
  detalle?: string;
  /** Sombrear la fila, para alternar en listas largas. */
  rayada?: boolean;
  /** Formato de los valores. Por defecto, pesos. */
  formato?: string;
  /** Alinea los valores a la izquierda (para texto, no números). */
  texto?: boolean;
}

/**
 * Una fila de datos: etiqueta a la izquierda, valores a la derecha.
 *
 * Es la única forma de escribir datos en el informe. Que todo pase por acá es
 * lo que hace que dos hojas distintas se vean igual.
 */
export function fila(
  ws: Sheet,
  n: number,
  etiqueta: string,
  valores: (number | string | null)[],
  o: OpcionesFila = {}
): number {
  const r = ws.getRow(n);
  r.height = ALTO.fila;
  const e = r.getCell(1);
  e.value = o.detalle ? `${etiqueta}   ${o.detalle}` : etiqueta;
  e.font = { name: FUENTE, size: 11, color: { argb: TINTA } };
  e.alignment = { vertical: "middle", indent: 1 };

  valores.forEach((v, i) => {
    const c = r.getCell(i + 2);
    c.value = v;
    c.font = { name: FUENTE, size: 11, color: { argb: TINTA } };
    if (typeof v === "number") c.numFmt = o.formato ?? PESOS;
    c.alignment = { vertical: "middle", horizontal: o.texto ? "left" : "right", indent: 1 };
  });

  if (o.rayada) {
    for (let c = 1; c <= valores.length + 1; c++) r.getCell(c).fill = relleno(GRIS_SUAVE);
  }
  return n + 1;
}

/**
 * Una fila de RESULTADO: banda de color llena, texto blanco.
 *
 * Es el recurso que hace legible la planilla de referencia. Se usa poco a
 * propósito: si todo es una banda, ninguna resalta.
 */
export function resultado(
  ws: Sheet,
  n: number,
  etiqueta: string,
  valores: number[],
  o: { formato?: string; detalle?: string } = {}
): number {
  const r = ws.getRow(n);
  r.height = ALTO.seccion;
  const ancho = valores.length + 1;

  // El color lo decide el primer valor: verde si deja plata, rojo si no.
  const positivo = (valores[0] ?? 0) >= 0;
  const base = positivo ? VERDE : ROJO;
  for (let c = 1; c <= ancho; c++) r.getCell(c).fill = relleno(base);

  const e = r.getCell(1);
  e.value = o.detalle ? `${etiqueta}   ${o.detalle}` : etiqueta;
  e.font = { name: FUENTE, size: 11, bold: true, color: { argb: BLANCO } };
  e.alignment = { vertical: "middle", indent: 1 };

  valores.forEach((v, i) => {
    const c = r.getCell(i + 2);
    c.value = v;
    c.numFmt = o.formato ?? PESOS;
    // Cada columna se pinta según su propio signo: un mes en rojo entre meses
    // verdes tiene que verse.
    c.fill = relleno(v >= 0 ? VERDE : ROJO);
    c.font = { name: FUENTE, size: 12, bold: true, color: { argb: BLANCO } };
    c.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
  });
  return n + 1;
}

/**
 * Banda de resultado con el valor en UNA columna puntual, no en la siguiente.
 * Sirve cuando la tabla tiene columnas intermedias que no llevan número (la
 * hoja de gastos fijos, por ejemplo: concepto, monto, moneda, y el total va
 * recién en la cuarta).
 */
export function resultadoEn(
  ws: Sheet,
  n: number,
  etiqueta: string,
  ancho: number,
  columna: number,
  valor: number,
  formato = PESOS
): number {
  const r = ws.getRow(n);
  r.height = ALTO.seccion;
  const base = valor >= 0 ? VERDE : ROJO;
  for (let c = 1; c <= ancho; c++) r.getCell(c).fill = relleno(base);
  const e = r.getCell(1);
  e.value = etiqueta;
  e.font = { name: FUENTE, size: 11, bold: true, color: { argb: BLANCO } };
  e.alignment = { vertical: "middle", indent: 1 };
  const v = r.getCell(columna);
  v.value = valor;
  v.numFmt = formato;
  v.font = { name: FUENTE, size: 12, bold: true, color: { argb: BLANCO } };
  v.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
  return n + 1;
}

/** Fila de total: sin relleno, con una línea doble arriba. */
export function total(
  ws: Sheet,
  n: number,
  etiqueta: string,
  valores: (number | null)[],
  formato = PESOS
): number {
  const r = ws.getRow(n);
  r.height = ALTO.fila;
  const e = r.getCell(1);
  e.value = etiqueta;
  e.font = { name: FUENTE, size: 11, bold: true, color: { argb: TINTA } };
  e.alignment = { vertical: "middle", indent: 1 };
  valores.forEach((v, i) => {
    const c = r.getCell(i + 2);
    c.value = v;
    if (typeof v === "number") c.numFmt = formato;
    c.font = { name: FUENTE, size: 11, bold: true, color: { argb: TINTA } };
    c.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
  });
  for (let c = 1; c <= valores.length + 1; c++) {
    r.getCell(c).border = { top: { style: "double", color: { argb: TINTA_SUAVE } } };
  }
  return n + 1;
}

/** Un párrafo de texto que ocupa varias columnas. Para la hoja de la guía. */
export function parrafo(
  ws: Sheet,
  n: number,
  texto: string,
  ancho: number,
  o: { negrita?: boolean; alto?: number } = {}
): number {
  const r = ws.getRow(n);
  r.height = o.alto ?? ALTO.fila;
  ws.mergeCells(n, 1, n, ancho);
  const c = r.getCell(1);
  c.value = texto;
  c.font = { name: FUENTE, size: 11, bold: !!o.negrita, color: { argb: TINTA } };
  c.alignment = { vertical: "middle", wrapText: true, indent: 1 };
  return n + 1;
}

/** Deja una fila de aire. */
export function aire(ws: Sheet, n: number): number {
  ws.getRow(n).height = ALTO.aire;
  return n + 1;
}

/** Pinta una celda de ámbar: se usa para marcar lo que hay que mirar. */
export function marcar(cell: Cell, color: string = AMBAR, tinta: string = TINTA) {
  cell.fill = relleno(color);
  cell.font = { name: FUENTE, size: 11, bold: true, color: { argb: tinta } };
}

export { FUENTE, relleno };
export type { Row, Sheet };
