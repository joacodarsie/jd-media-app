import ExcelJS from "exceljs";
import { periodLabel } from "@/lib/finanzas";
import { cascada, type MesResumen } from "./resumen";
import type { Cuadre, FilaCliente, FilaEquipo } from "./informe-mensual";

/**
 * El informe mensual de finanzas, en Excel.
 *
 * Seis hojas, cada una contesta UNA pregunta, y una hoja de control que cruza
 * los totales entre ellas. Esa última es la que hace al informe creíble: si
 * "Entró" del Resumen coincide con la suma de Cobros, el número no depende de
 * confiar en quien armó la planilla.
 *
 * Se eligió .xlsx y no Google Sheets a propósito: el Sheets necesitaría una
 * cuenta de Google conectada con permisos —una pieza más que se puede romper—
 * mientras que el .xlsx lo genera la app sola y Drive lo convierte si hace
 * falta.
 */

/** La paleta de la marca, para que el informe se vea como JD Media. */
const AMARILLO = "FFFFD400";
const GRIS = "FFF3F4F6";
const NEGRO = "FF111111";

export interface FilaFijo {
  concepto: string;
  proveedor: string;
  montoOriginal: number;
  moneda: string;
  montoARS: number;
}

export interface FilaCobro {
  cliente: string;
  periodo: string;
  concepto: string;
  monto: number;
  moneda: string;
  cobrado: boolean;
  fechaCobro: string | null;
  /** Lo entregado a cuenta, cuando hubo pagos parciales. */
  aCuenta: number;
  /** Lo que todavía falta cobrar. */
  saldo: number;
}

export interface FilaMovimiento {
  fecha: string;
  tipo: "Cobro" | "Equipo" | "Gasto";
  contraparte: string;
  concepto: string;
  /** Positivo si entró, negativo si salió. */
  montoARS: number;
}

export interface DatosInforme {
  periodo: string;
  generadoEl: string;
  /** El dólar con el que se convirtió todo. */
  dolar: number;
  serie: MesResumen[];
  clientes: FilaCliente[];
  equipo: FilaEquipo[];
  fijos: FilaFijo[];
  cobros: FilaCobro[];
  movimientos: FilaMovimiento[];
  cuadres: Cuadre[];
}

const PLATA = '"$"#,##0';
const PCT = "0%";

function mesCorto(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
}

/** Título de sección: amarillo de la marca, en negro y en negrita. */
function titulo(ws: ExcelJS.Worksheet, fila: number, texto: string, ancho: number) {
  const row = ws.getRow(fila);
  row.getCell(1).value = texto;
  row.font = { bold: true, size: 12, color: { argb: NEGRO } };
  for (let c = 1; c <= ancho; c++) {
    row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMARILLO } };
  }
  row.height = 20;
}

/** Encabezado de tabla: gris, en negrita, con borde abajo. */
function encabezado(ws: ExcelJS.Worksheet, fila: number, celdas: string[]) {
  const row = ws.getRow(fila);
  celdas.forEach((t, i) => {
    const c = row.getCell(i + 1);
    c.value = t;
    c.font = { bold: true, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS } };
    c.border = { bottom: { style: "thin", color: { argb: "FFCCCCCC" } } };
  });
}

function anchos(ws: ExcelJS.Worksheet, cols: number[]) {
  cols.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

export async function construirInforme(d: DatosInforme): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "JD Media";
  wb.created = new Date(d.generadoEl);

  const conMov = d.serie.filter((m) => m.entro > 0 || m.salio > 0);

  // ═══════════════════ 1. RESUMEN ═══════════════════
  {
    const ws = wb.addWorksheet("1. Resumen", { views: [{ state: "frozen", xSplit: 1 }] });
    anchos(ws, [34, ...conMov.map(() => 15)]);

    ws.getCell("A1").value = "JD Media · Finanzas";
    ws.getCell("A1").font = { bold: true, size: 16 };
    ws.getCell("A2").value = `Cierre de ${periodLabel(d.periodo)}`;
    ws.getCell("A2").font = { size: 11, color: { argb: "FF666666" } };
    ws.getCell("A3").value = `Generado el ${d.generadoEl.slice(0, 10)} · dólar $${d.dolar.toLocaleString("es-AR")} (Dólar App)`;
    ws.getCell("A3").font = { size: 9, color: { argb: "FF999999" } };

    titulo(ws, 5, "De lo que entró a lo que te queda a vos", conMov.length + 1);
    encabezado(ws, 6, ["", ...conMov.map((m) => mesCorto(m.periodo))]);

    // Las filas de la cascada, una por concepto y un mes por columna.
    const pasos: [string, (c: ReturnType<typeof cascada>) => number, boolean][] = [
      ["Entró — lo que te pagaron los clientes", (c) => c.entro, false],
      ["Le pagaste al equipo", (c) => -c.equipo, false],
      ["Margen de la agencia", (c) => c.margenAgencia, true],
      ["Gastos fijos", (c) => -c.fijos, false],
      ["TU SUELDO — lo que sobra", (c) => c.tuSueldo, true],
    ];
    const cascadas = conMov.map((m) => cascada(m));

    pasos.forEach(([label, get, fuerte], i) => {
      const row = ws.getRow(7 + i);
      row.getCell(1).value = label;
      if (fuerte) row.getCell(1).font = { bold: true };
      cascadas.forEach((c, j) => {
        const cell = row.getCell(j + 2);
        cell.value = Math.round(get(c));
        cell.numFmt = PLATA;
        if (fuerte) cell.font = { bold: true };
        if (get(c) < 0 && label.startsWith("TU SUELDO")) {
          cell.font = { bold: true, color: { argb: "FFC00000" } };
        }
      });
      if (fuerte) {
        row.eachCell((c) => {
          c.border = { top: { style: "thin", color: { argb: "FFCCCCCC" } } };
        });
      }
    });

    // Los porcentajes, que es como el dueño se maneja.
    titulo(ws, 13, "En porcentaje de lo que entró", conMov.length + 1);
    encabezado(ws, 14, ["", ...conMov.map((m) => mesCorto(m.periodo))]);
    const pctPasos: [string, (c: ReturnType<typeof cascada>) => number][] = [
      ["Margen de la agencia", (c) => c.margenPct / 100],
      ["Gastos fijos", (c) => c.fijosPct / 100],
      ["Tu sueldo", (c) => c.tuSueldoPct / 100],
    ];
    pctPasos.forEach(([label, get], i) => {
      const row = ws.getRow(15 + i);
      row.getCell(1).value = label;
      if (label === "Tu sueldo") row.getCell(1).font = { bold: true };
      cascadas.forEach((c, j) => {
        const cell = row.getCell(j + 2);
        cell.value = get(c);
        cell.numFmt = PCT;
        if (label === "Tu sueldo") cell.font = { bold: true };
      });
    });

    // El control: si esto cierra, no hace falta creerle a nadie.
    const base = 20;
    titulo(ws, base, "Control: las hojas tienen que decir lo mismo", 5);
    encabezado(ws, base + 1, ["Concepto", "Hoja", "Dice", "Contra", "Dice"]);
    d.cuadres.forEach((c, i) => {
      const row = ws.getRow(base + 2 + i);
      row.getCell(1).value = c.concepto;
      row.getCell(2).value = c.hojaA;
      row.getCell(3).value = c.a;
      row.getCell(3).numFmt = PLATA;
      row.getCell(4).value = c.hojaB;
      row.getCell(5).value = c.b;
      row.getCell(5).numFmt = PLATA;
      const color = c.cierra ? "FF107C41" : "FFC00000";
      row.getCell(6).value = c.cierra ? "✓ cierra" : "✗ NO CIERRA";
      row.getCell(6).font = { bold: true, color: { argb: color } };
    });
  }

  // ═══════════════════ 2. CLIENTES ═══════════════════
  {
    const ws = wb.addWorksheet("2. Clientes", { views: [{ state: "frozen", ySplit: 3 }] });
    anchos(ws, [26, 20, 16, 14, 14, 14, 14, 9, 9]);
    titulo(ws, 1, "Qué deja cada cuenta — de mejor a peor", 9);
    ws.getCell("A2").value =
      "El margen no descuenta los gastos fijos: esos se pagan con la suma de todos los márgenes.";
    ws.getCell("A2").font = { size: 9, italic: true, color: { argb: "FF666666" } };
    encabezado(ws, 3, [
      "Cliente",
      "Servicio",
      "Pack",
      "Abono",
      "Costo de entrega",
      "Coordinación",
      "Margen",
      "%",
      "Meses",
    ]);

    d.clientes.forEach((f, i) => {
      const row = ws.getRow(4 + i);
      row.getCell(1).value = f.cliente;
      row.getCell(2).value = f.servicio;
      row.getCell(3).value = f.pack;
      row.getCell(4).value = f.abono;
      row.getCell(5).value = -f.costoEntrega;
      row.getCell(6).value = -f.coordinacion;
      row.getCell(7).value = f.margen;
      row.getCell(8).value = f.margenPct / 100;
      row.getCell(9).value = f.meses ?? "—";
      [4, 5, 6, 7].forEach((c) => (row.getCell(c).numFmt = PLATA));
      row.getCell(8).numFmt = PCT;
      row.getCell(7).font = { bold: true };
      // Ámbar las que no llegan al 25%, rojo las que pierden.
      if (f.margenPct < 0) {
        row.getCell(8).font = { bold: true, color: { argb: "FFC00000" } };
      } else if (f.margenPct < 25) {
        row.getCell(8).font = { bold: true, color: { argb: "FFB45309" } };
      }
    });

    const fin = 4 + d.clientes.length;
    const tot = ws.getRow(fin);
    tot.getCell(1).value = "TOTAL";
    tot.getCell(4).value = d.clientes.reduce((a, f) => a + f.abono, 0);
    tot.getCell(7).value = d.clientes.reduce((a, f) => a + f.margen, 0);
    [4, 7].forEach((c) => {
      tot.getCell(c).numFmt = PLATA;
    });
    tot.font = { bold: true };
    tot.eachCell((c) => {
      c.border = { top: { style: "double", color: { argb: "FF999999" } } };
    });
  }

  // ═══════════════════ 3. EQUIPO ═══════════════════
  {
    const ws = wb.addWorksheet("3. Equipo", { views: [{ state: "frozen", xSplit: 1, ySplit: 2 }] });
    anchos(ws, [26, ...conMov.map(() => 14), 15]);
    titulo(ws, 1, "Lo que cobró cada uno, mes por mes", conMov.length + 2);
    encabezado(ws, 2, ["Persona", ...conMov.map((m) => mesCorto(m.periodo)), "Total"]);

    d.equipo.forEach((f, i) => {
      const row = ws.getRow(3 + i);
      row.getCell(1).value = f.persona;
      conMov.forEach((m, j) => {
        const cell = row.getCell(j + 2);
        const v = f.porMes[m.periodo] ?? 0;
        cell.value = v || null;
        cell.numFmt = PLATA;
      });
      const t = row.getCell(conMov.length + 2);
      t.value = f.total;
      t.numFmt = PLATA;
      t.font = { bold: true };
    });

    const fin = 3 + d.equipo.length;
    const tot = ws.getRow(fin);
    tot.getCell(1).value = "TOTAL";
    conMov.forEach((m, j) => {
      const cell = tot.getCell(j + 2);
      cell.value = d.equipo.reduce((a, f) => a + (f.porMes[m.periodo] ?? 0), 0);
      cell.numFmt = PLATA;
    });
    const t = tot.getCell(conMov.length + 2);
    t.value = d.equipo.reduce((a, f) => a + f.total, 0);
    t.numFmt = PLATA;
    tot.font = { bold: true };
    tot.eachCell((c) => {
      c.border = { top: { style: "double", color: { argb: "FF999999" } } };
    });
  }

  // ═══════════════════ 4. GASTOS FIJOS ═══════════════════
  {
    const ws = wb.addWorksheet("4. Gastos fijos", { views: [{ state: "frozen", ySplit: 3 }] });
    anchos(ws, [34, 22, 14, 10, 16]);
    titulo(ws, 1, `La estructura de ${periodLabel(d.periodo)}`, 5);
    ws.getCell("A2").value = `Se paga todos los meses, con clientes o sin ellos. Los dólares van a $${d.dolar.toLocaleString("es-AR")} (Dólar App).`;
    ws.getCell("A2").font = { size: 9, italic: true, color: { argb: "FF666666" } };
    encabezado(ws, 3, ["Concepto", "Proveedor", "Monto", "Moneda", "En pesos"]);

    d.fijos.forEach((f, i) => {
      const row = ws.getRow(4 + i);
      row.getCell(1).value = f.concepto;
      row.getCell(2).value = f.proveedor;
      row.getCell(3).value = f.montoOriginal;
      row.getCell(4).value = f.moneda;
      row.getCell(5).value = Math.round(f.montoARS);
      row.getCell(5).numFmt = PLATA;
    });

    const fin = 4 + d.fijos.length;
    const tot = ws.getRow(fin);
    tot.getCell(1).value = "TOTAL";
    tot.getCell(5).value = Math.round(d.fijos.reduce((a, f) => a + f.montoARS, 0));
    tot.getCell(5).numFmt = PLATA;
    tot.font = { bold: true };
    tot.eachCell((c) => {
      c.border = { top: { style: "double", color: { argb: "FF999999" } } };
    });
  }

  // ═══════════════════ 5. COBROS ═══════════════════
  {
    const ws = wb.addWorksheet("5. Cobros", { views: [{ state: "frozen", ySplit: 3 }] });
    anchos(ws, [26, 12, 40, 14, 10, 12, 13, 16, 15]);
    titulo(ws, 1, "Cada factura: quién pagó, cuándo y qué falta", 9);
    ws.getCell("A2").value =
      "Lo cobrado del mes es lo que alimenta el Resumen. Lo pendiente todavía no cuenta como plata que entró.";
    ws.getCell("A2").font = { size: 9, italic: true, color: { argb: "FF666666" } };
    encabezado(ws, 3, [
      "Cliente",
      "Mes",
      "Concepto",
      "Monto",
      "Moneda",
      "¿Cobrado?",
      "Fecha de cobro",
      "Entregado a cuenta",
      "Saldo pendiente",
    ]);

    d.cobros.forEach((f, i) => {
      const row = ws.getRow(4 + i);
      row.getCell(1).value = f.cliente;
      row.getCell(2).value = f.periodo;
      row.getCell(3).value = f.concepto;
      row.getCell(4).value = f.monto;
      row.getCell(4).numFmt = PLATA;
      row.getCell(5).value = f.moneda;
      row.getCell(6).value = f.cobrado ? "Sí" : "No";
      row.getCell(6).font = {
        bold: true,
        color: { argb: f.cobrado ? "FF107C41" : "FFB45309" },
      };
      row.getCell(7).value = f.fechaCobro ?? "—";
      row.getCell(8).value = f.aCuenta || null;
      row.getCell(8).numFmt = PLATA;
      row.getCell(9).value = f.saldo || null;
      row.getCell(9).numFmt = PLATA;
      if (f.saldo > 0) row.getCell(9).font = { bold: true, color: { argb: "FFB45309" } };
    });
  }

  // ═══════════════════ 6. MOVIMIENTOS ═══════════════════
  {
    const ws = wb.addWorksheet("6. Movimientos", { views: [{ state: "frozen", ySplit: 3 }] });
    anchos(ws, [13, 11, 26, 46, 16]);
    titulo(ws, 1, "El libro completo: todo lo que entró y salió", 5);
    ws.getCell("A2").value = "Es el respaldo de las cinco hojas anteriores. Ordenado del más nuevo al más viejo.";
    ws.getCell("A2").font = { size: 9, italic: true, color: { argb: "FF666666" } };
    encabezado(ws, 3, ["Fecha", "Tipo", "Contraparte", "Concepto", "Monto"]);

    d.movimientos.forEach((f, i) => {
      const row = ws.getRow(4 + i);
      row.getCell(1).value = f.fecha;
      row.getCell(2).value = f.tipo;
      row.getCell(3).value = f.contraparte;
      row.getCell(4).value = f.concepto;
      const c = row.getCell(5);
      c.value = Math.round(f.montoARS);
      c.numFmt = PLATA;
      c.font = { color: { argb: f.montoARS >= 0 ? "FF107C41" : "FFC00000" } };
    });

    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 5 } };
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
