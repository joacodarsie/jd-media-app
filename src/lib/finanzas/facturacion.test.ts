import { describe, it, expect } from "vitest";
import {
  fetchFacturacion,
  fetchFacturadoUltimos12Meses,
  resumenFacturacion,
} from "./facturacion";

const aArs = (m: number, moneda: string) => (moneda === "USD" ? m * 1000 : m);

describe("resumenFacturacion", () => {
  it("solo mira lo cobrado: lo pendiente no cuenta como 'sin facturar'", () => {
    const r = resumenFacturacion(
      [
        { fecha_cobro: "2026-09-03", facturado: true, monto: 300_000, moneda: "ARS" },
        { fecha_cobro: "2026-09-05", facturado: false, monto: 200_000, moneda: "ARS" },
        // Todavía no pagó: no debería ensuciar el porcentaje.
        { fecha_cobro: null, facturado: false, monto: 900_000, moneda: "ARS" },
      ],
      aArs
    );
    expect(r.total).toBe(500_000);
    expect(r.facturado).toBe(300_000);
    expect(r.sinFactura).toBe(200_000);
    expect(r.cuentaSinFactura).toBe(1);
    expect(r.pct).toBeCloseTo(0.6);
  });

  it("mide en plata, no en cantidad de facturas", () => {
    // Diez chicas hechas y una grande sin hacer NO es 91% facturado.
    const rows = [
      ...Array.from({ length: 10 }, () => ({
        fecha_cobro: "2026-09-01",
        facturado: true,
        monto: 10_000,
        moneda: "ARS",
      })),
      { fecha_cobro: "2026-09-01", facturado: false, monto: 900_000, moneda: "ARS" },
    ];
    const r = resumenFacturacion(rows, aArs);
    expect(Math.round(r.pct * 100)).toBe(10);
  });

  it("convierte a pesos antes de sumar", () => {
    const r = resumenFacturacion(
      [
        { fecha_cobro: "2026-09-01", facturado: true, monto: 100, moneda: "USD" },
        { fecha_cobro: "2026-09-01", facturado: false, monto: 100_000, moneda: "ARS" },
      ],
      aArs
    );
    expect(r.facturado).toBe(100_000);
    expect(r.pct).toBeCloseTo(0.5);
  });

  it("sin cobros no divide por cero", () => {
    const r = resumenFacturacion([], aArs);
    expect(r.total).toBe(0);
    expect(r.pct).toBe(0);
  });

  it("trata el facturado ausente como sin factura", () => {
    // Es el caso de la migración 0164 todavía sin aplicar.
    const r = resumenFacturacion(
      [{ fecha_cobro: "2026-09-01", monto: 50_000, moneda: "ARS" }],
      aArs
    );
    expect(r.sinFactura).toBe(50_000);
    expect(r.pct).toBe(0);
  });
});

describe("fetchFacturacion", () => {
  function db(respuesta: { data?: unknown; error?: unknown }) {
    const q = {
      select: () => q,
      eq: () => q,
      then: (res: (v: unknown) => void) => res(respuesta),
    };
    return { from: () => q };
  }

  it("devuelve el estado por id cuando la columna existe", async () => {
    const r = await fetchFacturacion(
      db({
        data: [
          { id: "a", facturado: true, factura_nro: "0001-23", facturado_at: "2026-09-10" },
          { id: "b", facturado: false, factura_nro: null, facturado_at: null },
        ],
      })
    );
    expect(r.disponible).toBe(true);
    expect(r.byId.get("a")).toEqual({
      facturado: true,
      factura_nro: "0001-23",
      facturado_at: "2026-09-10",
    });
    expect(r.byId.get("b")?.facturado).toBe(false);
  });

  it("no rompe si la migración 0164 no está aplicada", async () => {
    const r = await fetchFacturacion(
      db({ error: { code: "42703", message: 'column "facturado" does not exist' } })
    );
    expect(r.disponible).toBe(false);
    expect(r.byId.size).toBe(0);
  });

  it("tampoco rompe si la consulta tira una excepción", async () => {
    const roto = {
      from: () => {
        throw new Error("sin conexión");
      },
    };
    const r = await fetchFacturacion(roto);
    expect(r.disponible).toBe(false);
  });
});

describe("fetchFacturadoUltimos12Meses", () => {
  /** Mock que además anota con qué filtros se lo llamó. */
  function db(respuesta: { data?: unknown; error?: unknown }) {
    const filtros: Record<string, unknown> = {};
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => {
        filtros["eq:" + c] = v;
        return q;
      },
      gte: (c: string, v: unknown) => {
        filtros["gte:" + c] = v;
        return q;
      },
      lte: (c: string, v: unknown) => {
        filtros["lte:" + c] = v;
        return q;
      },
      then: (res: (v: unknown) => void) => res(respuesta),
    };
    return { db: { from: () => q }, filtros };
  }

  it("suma lo facturado y arranca doce meses antes de hoy", async () => {
    const { db: d, filtros } = db({
      data: [
        { monto: 350_000, moneda: "ARS", facturado_at: "2026-09-12" },
        { monto: 265_000, moneda: "ARS", facturado_at: "2026-03-01" },
      ],
    });
    const r = await fetchFacturadoUltimos12Meses(d, "2026-09-12");
    expect(r).toEqual({ monto: 615_000, desde: "2025-09-12" });
    // El corte va por la fecha de emisión, que es lo que mira ARCA, y no por
    // el período del cobro.
    expect(filtros["gte:facturado_at"]).toBe("2025-09-12");
    expect(filtros["lte:facturado_at"]).toBe("2026-09-12");
    expect(filtros["eq:facturado"]).toBe(true);
  });

  it("sin facturas emitidas da cero, no null", async () => {
    const { db: d } = db({ data: [] });
    expect((await fetchFacturadoUltimos12Meses(d, "2026-09-12"))?.monto).toBe(0);
  });

  it("devuelve null si la migración 0164 no está aplicada", async () => {
    const { db: d } = db({ error: { code: "42703" } });
    expect(await fetchFacturadoUltimos12Meses(d, "2026-09-12")).toBeNull();
  });

  it("cruza bien el año bisiesto", async () => {
    const { db: d, filtros } = db({ data: [] });
    await fetchFacturadoUltimos12Meses(d, "2028-02-29");
    expect(filtros["gte:facturado_at"]).toBe("2027-03-01");
  });
});
