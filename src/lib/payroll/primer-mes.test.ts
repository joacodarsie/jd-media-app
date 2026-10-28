import { describe, expect, it } from "vitest";
import type { PayrollLine } from "../payroll";
import { arranqueEnPeriodo, prorratearPorArranque } from "./primer-mes";

const line = (over: Partial<PayrollLine>): PayrollLine => ({
  clienteId: "moffa",
  cliente: "Tienda Moffa",
  concepto: "CM Presencia",
  monto: 50000,
  kind: "cm",
  ...over,
});

describe("arranqueEnPeriodo", () => {
  it("cuenta vieja o sin fecha: mes completo", () => {
    expect(arranqueEnPeriodo("2025-06-01", "2026-10").fraccion).toBe(1);
    expect(arranqueEnPeriodo(null, "2026-10").fraccion).toBe(1);
  });

  it("arranca el 1: mes completo", () => {
    expect(arranqueEnPeriodo("2026-10-01", "2026-10")).toEqual({ fraccion: 1, dias: 31, diasMes: 31, dia: null });
  });

  it("arranca el 23/10: 9 de 31 días, como la factura", () => {
    const a = arranqueEnPeriodo("2026-10-23", "2026-10");
    expect(a.dias).toBe(9);
    expect(a.diasMes).toBe(31);
    expect(a.dia).toBe(23);
  });

  it("arranca después del período: no cuenta", () => {
    expect(arranqueEnPeriodo("2026-10-21", "2026-09").fraccion).toBe(0);
  });
});

describe("prorratearPorArranque", () => {
  const inicio = new Map<string, string | null>([
    ["moffa", "2026-10-23"],
    ["boxescar", "2025-06-01"],
    ["nico", "2026-10-21"],
  ]);

  it("prorratea CM, media buyer y coordinación del mes de arranque", () => {
    const out = prorratearPorArranque(
      [
        line({}),
        line({ concepto: "Media buyer Presencia", kind: "media_buyer" }),
        line({ concepto: "Coordinación gestión de redes (10%)", kind: "coordinacion", monto: 40000 }),
      ],
      inicio,
      "2026-10"
    );
    // Tienda Moffa pagó $116.129 = $400.000 × 9/31: el equipo, igual.
    expect(out.map((l) => l.monto)).toEqual([14516, 14516, 11613]);
    expect(out[0].concepto).toBe("CM Presencia · proporcional desde el 23/10 (9 de 31 días)");
  });

  it("no repite los días del pase de cuentas", () => {
    const [l] = prorratearPorArranque([line({ concepto: "CM Presencia · 9 de 31 días" })], inicio, "2026-10");
    expect(l.concepto).toBe("CM Presencia · proporcional desde el 23/10 (9 de 31 días)");
  });

  it("no toca cuentas viejas ni el contenido publicado", () => {
    const out = prorratearPorArranque(
      [
        line({ clienteId: "boxescar", cliente: "Boxescar" }),
        line({ concepto: "Diseño · 2 piezas", kind: "diseno", monto: 16000 }),
        line({ concepto: "Edición · 1 reel", kind: "edicion", monto: 15000 }),
      ],
      inicio,
      "2026-10"
    );
    expect(out.map((l) => l.monto)).toEqual([50000, 16000, 15000]);
  });

  it("saca las cuentas que arrancaron después del período", () => {
    const out = prorratearPorArranque([line({ clienteId: "nico", cliente: "Nico del Barba" })], inicio, "2026-09");
    expect(out).toEqual([]);
  });

  it("líneas sin cuenta (fijo del comercial, jornadas) pasan igual", () => {
    const fijo = line({ clienteId: null, cliente: "—", concepto: "Prospección (fijo mensual)", kind: "comercial_fijo", monto: 25000 });
    expect(prorratearPorArranque([fijo], inicio, "2026-10")).toEqual([fijo]);
  });
});
