import { describe, it, expect } from "vitest";
import { computeDireccionCreativaLines, fraccionDelMes } from "./direccion-creativa";
import type { PayrollClient } from "../payroll";

function cliente(id: string, nombre = id): PayrollClient {
  return {
    id,
    nombre,
    cm_id: null,
    disenador_id: null,
    audiovisual_id: null,
    media_buyer_id: null,
    coordinador_id: null,
    cerrado_por_id: null,
    fecha_inicio: "2026-01-01",
  };
}

describe("fraccionDelMes", () => {
  it("antes de septiembre de 2026 no existe el rol", () => {
    expect(fraccionDelMes("2026-08")).toBe(0);
  });
  it("septiembre va por la mitad: arrancó el 15", () => {
    expect(fraccionDelMes("2026-09")).toBe(0.5);
  });
  it("de octubre en adelante, el mes entero", () => {
    expect(fraccionDelMes("2026-10")).toBe(1);
    expect(fraccionDelMes("2027-03")).toBe(1);
  });
});

describe("computeDireccionCreativaLines", () => {
  const clients = [cliente("a", "Impermax"), cliente("b", "La Azotea"), cliente("c", "Origen")];
  const gdr = new Map([
    ["a", 350_000],
    ["b", 200_000],
    // Origen no tiene gestión de redes: no suma.
  ]);

  it("paga el 5% del abono de gestión de redes de cada cuenta", () => {
    const out = computeDireccionCreativaLines(clients, gdr, 0.05, "2026-10");
    expect(out.map((l) => [l.cliente, l.monto])).toEqual([
      ["Impermax", 17_500],
      ["La Azotea", 10_000],
    ]);
  });

  it("en septiembre paga la mitad", () => {
    const out = computeDireccionCreativaLines(clients, gdr, 0.05, "2026-09");
    expect(out.reduce((a, l) => a + l.monto, 0)).toBe(13_750);
    expect(out[0].concepto).toContain("medio mes");
  });

  it("con la cartera de septiembre de 2026 da $171.750 por mes entero", () => {
    const abonos = [370_000, 350_000, 350_000, 350_000, 350_000, 350_000, 300_000, 300_000, 265_000, 250_000, 200_000];
    const cs = abonos.map((_, i) => cliente(`c${i}`));
    const m = new Map(abonos.map((v, i) => [`c${i}`, v]));
    expect(computeDireccionCreativaLines(cs, m, 0.05, "2026-10").reduce((a, l) => a + l.monto, 0)).toBe(171_750);
  });

  it("antes del arranque o con 0% no genera nada", () => {
    expect(computeDireccionCreativaLines(clients, gdr, 0.05, "2026-08")).toHaveLength(0);
    expect(computeDireccionCreativaLines(clients, gdr, 0, "2026-10")).toHaveLength(0);
  });

  it("al pasar al 10% se paga lo mismo que la coordinación de la Project Manager", () => {
    const out = computeDireccionCreativaLines(clients, gdr, 0.1, "2026-12");
    expect(out.reduce((a, l) => a + l.monto, 0)).toBe(55_000);
  });
});
