import ExcelJS from "exceljs";
import { periodLabel } from "@/lib/finanzas";
import { cascada, type MesResumen } from "./resumen";
import type { Cuadre, FilaCliente, FilaEquipo } from "./informe-mensual";
import {
  hoja,
  titulo,
  seccion,
  encabezado,
  fila,
  resultado,
  resultadoEn,
  total,
  parrafo,
  aire,
  marcar,
  PESOS,
  PORCENTAJE,
  ENTERO,
  VERDE,
  ROJO,
  AMBAR,
  BLANCO,
  TINTA_SUAVE,
  FUENTE,
} from "./informe-estilos";

/**
 * El informe mensual de finanzas de JD Media.
 *
 * Siete hojas: una guía que explica el negocio y el informe, y seis de datos.
 * La primera versión salió —textual del dueño— "soso, mucho números, medio
 * mareador", así que todo el formato pasa ahora por `informe-estilos`, con la
 * planilla que él armó como referencia: bandas de color para los resultados,
 * secciones grises centradas, aire entre bloques y sin líneas de grilla.
 *
 * Lo que lo hace creíble está en la hoja Resumen: un bloque de CONTROL que
 * cruza los totales entre hojas y dice si cierran. Si cierran solos, el número
 * no depende de confiarle a nadie.
 */

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
  aCuenta: number;
  saldo: number;
}

export interface FilaMovimiento {
  fecha: string;
  tipo: "Cobro" | "Equipo" | "Gasto";
  contraparte: string;
  concepto: string;
  montoARS: number;
}

export interface DatosInforme {
  periodo: string;
  generadoEl: string;
  dolar: number;
  serie: MesResumen[];
  clientes: FilaCliente[];
  equipo: FilaEquipo[];
  fijos: FilaFijo[];
  cobros: FilaCobro[];
  movimientos: FilaMovimiento[];
  cuadres: Cuadre[];
  /** Los márgenes de referencia, para explicarlos en la guía. */
  margenes: { minimo: number; sano: number; comisionCierre: number; plusPrimerMes: number };
}

function mesCorto(p: string): string {
  const [y, m] = p.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
  return s.replace(".", "").replace(/^./, (c) => c.toUpperCase());
}

const plata = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

export async function construirInforme(d: DatosInforme): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "JD Media";
  wb.created = new Date(d.generadoEl);

  const meses = d.serie.filter((m) => m.entro > 0 || m.salio > 0);
  const cols = meses.length;
  const cascadas = meses.map((m) => cascada(m));
  const ultima = cascadas[cascadas.length - 1];
  const mesActual = periodLabel(d.periodo);

  // ═══════════════════════ 0. CÓMO LEER ESTO ═══════════════════════
  {
    const ANCHO = 6;
    const ws = hoja(wb, "Cómo leer esto", [4, 22, 22, 22, 22, 22]);
    let f = titulo(
      ws,
      1,
      "Cómo leer este informe",
      `JD Media · cierre de ${mesActual} · generado el ${d.generadoEl.slice(0, 10)}`,
      ANCHO
    );

    f = seccion(ws, f, "EL NEGOCIO EN CUATRO PASOS", ANCHO);
    f = aire(ws, f);
    f = parrafo(ws, f, "1.  Entra el abono de cada cliente.", ANCHO);
    f = parrafo(
      ws,
      f,
      "2.  Se paga la producción de ese cliente: diseño, edición, community manager, pauta y coordinación. Lo que queda es el MARGEN DE LA AGENCIA.",
      ANCHO,
      { alto: 32 }
    );
    f = parrafo(
      ws,
      f,
      "3.  Con la suma de todos esos márgenes se pagan los GASTOS FIJOS: monotributo, plataformas, la cuenta propia de la agencia. Son los mismos con 1 cliente o con 20.",
      ANCHO,
      { alto: 32 }
    );
    f = parrafo(ws, f, "4.  Lo que sobra es TU SUELDO.", ANCHO, { negrita: true });
    f = aire(ws, f);
    f = parrafo(
      ws,
      f,
      `La referencia: un ${d.margenes.sano}% de margen es sano para una cuenta de gestión, y por debajo del ${d.margenes.minimo}% la cuenta es frágil.`,
      ANCHO,
      { alto: 28 }
    );
    f = aire(ws, f);

    // Los cuatro pasos con los números del mes: la guía deja de ser abstracta.
    if (ultima) {
      f = seccion(ws, f, `LOS CUATRO PASOS CON TUS NÚMEROS DE ${mesActual.toUpperCase()}`, ANCHO);
      f = encabezado(ws, f, ["", "", "", "", "En pesos", "De lo que entró"]);
      const paso = (etiqueta: string, monto: number, pct: number | null) => {
        const r = ws.getRow(f);
        r.height = 19;
        ws.mergeCells(f, 1, f, 4);
        r.getCell(1).value = etiqueta;
        r.getCell(1).font = { name: FUENTE, size: 11 };
        r.getCell(1).alignment = { vertical: "middle", indent: 1 };
        r.getCell(5).value = Math.round(monto);
        r.getCell(5).numFmt = PESOS;
        r.getCell(5).alignment = { vertical: "middle", horizontal: "right", indent: 1 };
        r.getCell(5).font = { name: FUENTE, size: 11 };
        if (pct != null) {
          r.getCell(6).value = pct / 100;
          r.getCell(6).numFmt = PORCENTAJE;
          r.getCell(6).alignment = { vertical: "middle", horizontal: "right", indent: 1 };
          r.getCell(6).font = { name: FUENTE, size: 11 };
        }
        f++;
      };
      paso("1.  Entró de los clientes", ultima.entro, 100);
      paso("2.  Menos la producción del equipo", -ultima.equipo, -(ultima.equipo / (ultima.entro || 1)) * 100);
      f = resultado(ws, f, "      = MARGEN DE LA AGENCIA", [ultima.margenAgencia]);
      paso("3.  Menos los gastos fijos", -ultima.fijos, -ultima.fijosPct);
      f = resultado(ws, f, "      = TU SUELDO", [ultima.tuSueldo]);
      f = aire(ws, f);
    }

    f = seccion(ws, f, "EL PRIMER MES DE UN CLIENTE ES OTRO NEGOCIO", ANCHO);
    f = aire(ws, f);
    f = parrafo(
      ws,
      f,
      `Solo en el primer mes se pagan el manual de marca, la comisión del comercial (${d.margenes.comisionCierre}% del primer abono) y el plus de arranque (${plata(d.margenes.plusPrimerMes)} a la community manager y otro tanto al media buyer).`,
      ANCHO,
      { alto: 32 }
    );
    f = parrafo(
      ws,
      f,
      "Por eso el primer mes deja mucho menos que los demás. La regla es no perder plata nunca: el precio mínimo de una cotización ya tiene ese arranque adentro. Si una cuenta se va antes del mes 3, el arranque no se recuperó.",
      ANCHO,
      { alto: 46 }
    );
    f = aire(ws, f);

    f = seccion(ws, f, "QUÉ HAY EN CADA HOJA", ANCHO);
    f = aire(ws, f);
    const guia: [string, string][] = [
      ["1. Resumen", "La cascada de los cuatro pasos, mes por mes, en pesos y en porcentaje. Es la hoja que se muestra."],
      ["2. Clientes", "Qué deja cada cuenta, ordenadas de mejor a peor margen. Arriba las que conviene cuidar, abajo las que hay que renegociar."],
      ["3. Equipo", "Lo que cobró cada persona, mes por mes."],
      ["4. Gastos fijos", "La estructura línea por línea, en su moneda y en pesos."],
      ["5. Cobros", "Cada factura: si se cobró, cuándo, y qué saldo queda."],
      ["6. Movimientos", "El libro completo, fecha por fecha. Es el respaldo de todo lo anterior."],
    ];
    for (const [h, q] of guia) {
      const r = ws.getRow(f);
      r.height = 30;
      r.getCell(1).value = "";
      r.getCell(2).value = h;
      r.getCell(2).font = { name: FUENTE, size: 11, bold: true };
      r.getCell(2).alignment = { vertical: "middle", indent: 1 };
      ws.mergeCells(f, 3, f, ANCHO);
      r.getCell(3).value = q;
      r.getCell(3).font = { name: FUENTE, size: 11 };
      r.getCell(3).alignment = { vertical: "middle", wrapText: true, indent: 1 };
      f++;
    }
    f = aire(ws, f);

    f = seccion(ws, f, "DE DÓNDE SALEN LOS NÚMEROS", ANCHO);
    f = aire(ws, f);
    f = parrafo(
      ws,
      f,
      "Todo lo que aparece acá es plata que se movió de verdad: facturas con fecha de cobro y pagos con fecha de pago. Lo facturado y todavía no cobrado NO cuenta como ingreso — está aparte, en la hoja Cobros.",
      ANCHO,
      { alto: 46 }
    );
    f = parrafo(
      ws,
      f,
      `Los dólares se convierten con el dólar de Dólar App del día en que se generó el informe: $${d.dolar.toLocaleString("es-AR")}.`,
      ANCHO,
      { alto: 28 }
    );
    f = aire(ws, f);

    f = seccion(ws, f, "CÓMO SABER SI PODÉS CONFIAR EN ESTE INFORME", ANCHO);
    f = aire(ws, f);
    f = parrafo(
      ws,
      f,
      "Al final de la hoja Resumen hay un bloque de CONTROL. Compara los totales de hojas distintas entre sí: lo que entró según el Resumen contra la suma de la hoja Cobros, y así con el equipo y los gastos fijos.",
      ANCHO,
      { alto: 46 }
    );
    f = parrafo(
      ws,
      f,
      "Si los tres dicen «cierra», los números no dependen de confiarle a nadie: se verifican solos. Si alguno dijera «NO CIERRA», ese número está mal y hay que revisarlo antes de usar el informe.",
      ANCHO,
      { alto: 46 }
    );
  }

  // ═══════════════════════ 1. RESUMEN ═══════════════════════
  {
    const ANCHO = cols + 1;
    const ws = hoja(wb, "1. Resumen", [38, ...meses.map(() => 16)], { x: 1 });
    let f = titulo(
      ws,
      1,
      `JD Media · ${mesActual}`,
      "De lo que entró a lo que te queda a vos, mes por mes.",
      ANCHO
    );

    f = seccion(ws, f, "EN PESOS", ANCHO);
    f = encabezado(ws, f, ["", ...meses.map((m) => mesCorto(m.periodo))]);
    f = fila(ws, f, "Entró", cascadas.map((c) => c.entro), {
      detalle: "lo que te pagaron los clientes",
    });
    f = fila(ws, f, "Le pagaste al equipo", cascadas.map((c) => -c.equipo), {
      detalle: "producción de las cuentas",
      rayada: true,
    });
    f = resultado(ws, f, "MARGEN DE LA AGENCIA", cascadas.map((c) => c.margenAgencia));
    f = fila(ws, f, "Gastos fijos", cascadas.map((c) => -c.fijos), {
      detalle: "la estructura, con clientes o sin ellos",
      rayada: true,
    });
    f = resultado(ws, f, "TU SUELDO", cascadas.map((c) => c.tuSueldo), {
      detalle: "lo que sobra después de todo",
    });
    f = aire(ws, f);

    f = seccion(ws, f, "EN PORCENTAJE DE LO QUE ENTRÓ", ANCHO);
    f = encabezado(ws, f, ["", ...meses.map((m) => mesCorto(m.periodo))]);
    f = fila(ws, f, "Margen de la agencia", cascadas.map((c) => c.margenPct / 100), {
      formato: PORCENTAJE,
    });
    f = fila(ws, f, "Gastos fijos", cascadas.map((c) => c.fijosPct / 100), {
      formato: PORCENTAJE,
      rayada: true,
    });
    f = resultado(ws, f, "TU SUELDO", cascadas.map((c) => c.tuSueldoPct / 100), {
      formato: PORCENTAJE,
    });
    f = aire(ws, f);

    // El control cruzado: lo que hace verificable al informe.
    f = seccion(ws, f, "CONTROL · LAS HOJAS TIENEN QUE DECIR LO MISMO", ANCHO);
    f = encabezado(ws, f, ["Concepto", "Dice el Resumen", "Dice la otra hoja", "¿Cierra?"]);
    for (const c of d.cuadres) {
      const r = ws.getRow(f);
      r.height = 19;
      r.getCell(1).value = `${c.concepto}   (contra ${c.hojaB})`;
      r.getCell(1).font = { name: FUENTE, size: 11 };
      r.getCell(1).alignment = { vertical: "middle", indent: 1 };
      [c.a, c.b].forEach((v, i) => {
        const cell = r.getCell(i + 2);
        cell.value = v;
        cell.numFmt = PESOS;
        cell.font = { name: FUENTE, size: 11 };
        cell.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
      });
      const est = r.getCell(4);
      est.value = c.cierra ? "Cierra" : "NO CIERRA";
      marcar(est, c.cierra ? VERDE : ROJO, BLANCO);
      est.alignment = { vertical: "middle", horizontal: "center" };
      f++;
    }
    f = aire(ws, f);
    f = parrafo(
      ws,
      f,
      "Si los tres dicen «Cierra», los números se verifican solos. Ver la hoja «Cómo leer esto».",
      ANCHO
    );
    ws.getRow(f - 1).getCell(1).font = {
      name: FUENTE,
      size: 10,
      italic: true,
      color: { argb: TINTA_SUAVE },
    };
  }

  // ═══════════════════════ 2. CLIENTES ═══════════════════════
  {
    const ANCHO = 7;
    const ws = hoja(wb, "2. Clientes", [30, 22, 15, 15, 15, 11, 10], { y: 5 });
    let f = titulo(
      ws,
      1,
      "Qué deja cada cuenta",
      `Ordenadas de mejor a peor margen. Los gastos fijos no se descuentan acá: se pagan con la suma de todos estos márgenes.`,
      ANCHO
    );

    f = seccion(ws, f, `LAS ${d.clientes.length} CUENTAS ACTIVAS`, ANCHO);
    f = encabezado(ws, f, [
      "Cliente",
      "Servicio",
      "Abono",
      "Producción",
      "Margen",
      "%",
      "Meses",
    ]);

    d.clientes.forEach((c, i) => {
      const r = ws.getRow(f);
      r.height = 19;
      const celdas: (string | number)[] = [
        c.cliente,
        c.servicio,
        c.abono,
        -(c.costoEntrega + c.coordinacion),
        c.margen,
        c.margenPct / 100,
        c.meses ?? 0,
      ];
      celdas.forEach((v, j) => {
        const cell = r.getCell(j + 1);
        cell.value = v;
        cell.font = { name: FUENTE, size: 11, bold: j === 4 };
        if (j >= 2 && j <= 4) cell.numFmt = PESOS;
        if (j === 5) cell.numFmt = PORCENTAJE;
        if (j === 6) cell.numFmt = ENTERO;
        cell.alignment = {
          vertical: "middle",
          horizontal: j <= 1 ? "left" : "right",
          indent: 1,
        };
      });
      if (i % 2 === 1) {
        for (let cc = 1; cc <= ANCHO; cc++) {
          r.getCell(cc).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF7F8F9" },
          };
        }
      }
      // El semáforo va SOLO en el porcentaje: una celda de color por fila.
      const pct = r.getCell(6);
      if (c.margenPct < 0) marcar(pct, ROJO, BLANCO);
      else if (c.margenPct < d.margenes.minimo) marcar(pct, AMBAR);
      pct.alignment = { vertical: "middle", horizontal: "center" };
      f++;
    });

    const sumaAbono = d.clientes.reduce((a, c) => a + c.abono, 0);
    const sumaProd = d.clientes.reduce((a, c) => a + c.costoEntrega + c.coordinacion, 0);
    const sumaMargen = d.clientes.reduce((a, c) => a + c.margen, 0);
    f = total(ws, f, "TOTAL DE LA CARTERA", [
      null,
      sumaAbono,
      -sumaProd,
      sumaMargen,
      sumaAbono > 0 ? sumaMargen / sumaAbono : 0,
    ]);
    ws.getRow(f - 1).getCell(6).numFmt = PORCENTAJE;
    f = aire(ws, f);
    f = parrafo(
      ws,
      f,
      `En ámbar, las cuentas por debajo del ${d.margenes.minimo}%: a ese margen un mes con una pieza de más se lo come entero.`,
      ANCHO
    );
    ws.getRow(f - 1).getCell(1).font = {
      name: FUENTE,
      size: 10,
      italic: true,
      color: { argb: TINTA_SUAVE },
    };
  }

  // ═══════════════════════ 3. EQUIPO ═══════════════════════
  {
    const ANCHO = cols + 2;
    const ws = hoja(wb, "3. Equipo", [28, ...meses.map(() => 15), 16], { x: 1, y: 5 });
    let f = titulo(ws, 1, "Lo que cobró cada uno", "Mes por mes, según los pagos registrados.", ANCHO);
    f = seccion(ws, f, "EQUIPO", ANCHO);
    f = encabezado(ws, f, ["Persona", ...meses.map((m) => mesCorto(m.periodo)), "Total"]);

    d.equipo.forEach((p, i) => {
      f = fila(
        ws,
        f,
        p.persona,
        [...meses.map((m) => p.porMes[m.periodo] || null), p.total],
        { rayada: i % 2 === 1 }
      );
      ws.getRow(f - 1).getCell(cols + 2).font = { name: FUENTE, size: 11, bold: true };
    });

    f = total(ws, f, "TOTAL", [
      ...meses.map((m) => d.equipo.reduce((a, p) => a + (p.porMes[m.periodo] ?? 0), 0)),
      d.equipo.reduce((a, p) => a + p.total, 0),
    ]);
  }

  // ═══════════════════════ 4. GASTOS FIJOS ═══════════════════════
  {
    const ANCHO = 4;
    const ws = hoja(wb, "4. Gastos fijos", [36, 16, 12, 18], { y: 5 });
    let f = titulo(
      ws,
      1,
      "La estructura",
      `Se paga todos los meses, con clientes o sin ellos. Los dólares van a $${d.dolar.toLocaleString("es-AR")} (Dólar App).`,
      ANCHO
    );
    f = seccion(ws, f, mesActual.toUpperCase(), ANCHO);
    f = encabezado(ws, f, ["Concepto", "Monto", "Moneda", "En pesos"]);

    d.fijos.forEach((g, i) => {
      const r = ws.getRow(f);
      r.height = 19;
      r.getCell(1).value = g.proveedor;
      r.getCell(1).font = { name: FUENTE, size: 11 };
      r.getCell(1).alignment = { vertical: "middle", indent: 1 };
      r.getCell(2).value = g.montoOriginal;
      r.getCell(2).numFmt = g.moneda === "USD" ? '"US$ "#,##0' : PESOS;
      r.getCell(3).value = g.moneda;
      r.getCell(4).value = Math.round(g.montoARS);
      r.getCell(4).numFmt = PESOS;
      [2, 3, 4].forEach((c) => {
        r.getCell(c).font = { name: FUENTE, size: 11 };
        r.getCell(c).alignment = {
          vertical: "middle",
          horizontal: c === 3 ? "center" : "right",
          indent: 1,
        };
      });
      if (i % 2 === 1) {
        for (let cc = 1; cc <= ANCHO; cc++) {
          r.getCell(cc).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF7F8F9" },
          };
        }
      }
      f++;
    });

    resultadoEn(
      ws,
      f,
      "TOTAL DE LA ESTRUCTURA",
      ANCHO,
      4,
      -Math.round(d.fijos.reduce((a, g) => a + g.montoARS, 0))
    );
  }

  // ═══════════════════════ 5. COBROS ═══════════════════════
  {
    const ANCHO = 6;
    const ws = hoja(wb, "5. Cobros", [28, 12, 16, 13, 16, 16], { y: 5 });
    let f = titulo(
      ws,
      1,
      "Cada factura",
      "Lo cobrado alimenta el Resumen. Lo pendiente todavía no es plata que entró.",
      ANCHO
    );

    const pendientes = d.cobros.filter((c) => !c.cobrado);
    const cobradas = d.cobros.filter((c) => c.cobrado);

    if (pendientes.length > 0) {
      f = seccion(ws, f, "FALTA COBRAR", ANCHO);
      f = encabezado(ws, f, ["Cliente", "Mes", "Monto", "¿Cobrado?", "Entregó a cuenta", "Saldo"]);
      pendientes.forEach((c, i) => {
        f = fila(ws, f, c.cliente, [c.periodo, c.monto, "No", c.aCuenta || null, c.saldo], {
          rayada: i % 2 === 1,
        });
        const r = ws.getRow(f - 1);
        r.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
        r.getCell(4).alignment = { vertical: "middle", horizontal: "center" };
        marcar(r.getCell(6), AMBAR);
        r.getCell(6).numFmt = PESOS;
        r.getCell(6).alignment = { vertical: "middle", horizontal: "right", indent: 1 };
      });
      f = total(ws, f, "TOTAL PENDIENTE", [
        null,
        null,
        null,
        null,
        pendientes.reduce((a, c) => a + c.saldo, 0),
      ]);
      f = aire(ws, f);
    }

    f = seccion(ws, f, `COBRADO EN ${mesActual.toUpperCase()}`, ANCHO);
    f = encabezado(ws, f, ["Cliente", "Mes", "Monto", "¿Cobrado?", "Fecha de cobro", ""]);
    cobradas.forEach((c, i) => {
      f = fila(ws, f, c.cliente, [c.periodo, c.monto, "Sí", c.fechaCobro ?? "—", null], {
        rayada: i % 2 === 1,
      });
      const r = ws.getRow(f - 1);
      [2, 4, 5].forEach((cc) => {
        r.getCell(cc).alignment = { vertical: "middle", horizontal: "center" };
      });
    });
    f = total(ws, f, "TOTAL COBRADO", [
      null,
      cobradas.reduce((a, c) => a + c.monto, 0),
    ]);
  }

  // ═══════════════════════ 6. MOVIMIENTOS ═══════════════════════
  {
    const ANCHO = 5;
    const ws = hoja(wb, "6. Movimientos", [13, 12, 26, 44, 17], { y: 5 });
    let f = titulo(
      ws,
      1,
      "El libro completo",
      "Todo lo que entró y salió, del más nuevo al más viejo. Es el respaldo de las hojas anteriores.",
      ANCHO
    );
    f = seccion(ws, f, "MOVIMIENTOS", ANCHO);
    const filaEncabezado = f;
    f = encabezado(ws, f, ["Fecha", "Tipo", "Contraparte", "Concepto", "Monto"]);

    d.movimientos.forEach((m, i) => {
      f = fila(ws, f, m.fecha, [m.tipo, m.contraparte, m.concepto, m.montoARS], {
        rayada: i % 2 === 1,
        texto: true,
      });
      const r = ws.getRow(f - 1);
      r.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
      const monto = r.getCell(5);
      monto.numFmt = PESOS;
      monto.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
      monto.font = {
        name: FUENTE,
        size: 11,
        color: { argb: m.montoARS >= 0 ? VERDE : ROJO },
      };
    });

    ws.autoFilter = {
      from: { row: filaEncabezado, column: 1 },
      to: { row: filaEncabezado, column: ANCHO },
    };
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
