import { describe, expect, it } from "vitest";
import type { PayrollClient } from "../payroll";
import { computeManualMarcaLines } from "./manual-marca";

const cliente = (over: Partial<PayrollClient>): PayrollClient => ({
  id: "freedom",
  nombre: "Freedom",
  cm_id: null,
  disenador_id: "ana",
  audiovisual_id: null,
  media_buyer_id: null,
  coordinador_id: null,
  cerrado_por_id: null,
  fecha_inicio: "2026-10-01",
  ...over,
});

describe("computeManualMarcaLines", () => {
  it("paga el manual de una cuenta nueva a quien la diseña", () => {
    const out = computeManualMarcaLines(
      [cliente({})],
      [{ cliente_id: "freedom", dg_manual_marca_at: "2026-10-14T12:00:00+00:00" }],
      new Set(),
      50000,
      "2026-10"
    );
    expect(out.get("ana")).toEqual([
      { clienteId: "freedom", cliente: "Freedom", concepto: "Manual de marca", monto: 50000, kind: "diseno" },
    ]);
  });

  it("también si se termina el mes siguiente al arranque", () => {
    const out = computeManualMarcaLines(
      [cliente({ fecha_inicio: "2026-09-24" })],
      [{ cliente_id: "freedom", dg_manual_marca_at: "2026-10-03" }],
      new Set(),
      50000,
      "2026-10"
    );
    expect(out.get("ana")?.length).toBe(1);
  });

  it("no paga el rediseño de una cuenta vieja", () => {
    const out = computeManualMarcaLines(
      [cliente({ id: "magic", nombre: "Magic", fecha_inicio: "2026-07-05" })],
      [{ cliente_id: "magic", dg_manual_marca_at: "2026-10-16" }],
      new Set(),
      50000,
      "2026-10"
    );
    expect(out.size).toBe(0);
  });

  it("nada fuera del mes, sin diseñador o con acuerdo fijo", () => {
    const manual = [{ cliente_id: "freedom", dg_manual_marca_at: "2026-10-14" }];
    expect(computeManualMarcaLines([cliente({})], manual, new Set(), 50000, "2026-11").size).toBe(0);
    expect(computeManualMarcaLines([cliente({ disenador_id: null })], manual, new Set(), 50000, "2026-10").size).toBe(0);
    expect(computeManualMarcaLines([cliente({})], manual, new Set(["freedom"]), 50000, "2026-10").size).toBe(0);
  });
});
