import { describe, it, expect } from "vitest";
import { DEFAULT_AGENCY_SETTINGS } from "../coordinacion";
import type { PayrollLine, PayrollLineKind, PersonPayroll } from "../payroll";
import { packPayoutBreakdown, payModelRules, summarizePayroll } from "../payroll-summary";

function line(kind: PayrollLineKind, monto: number): PayrollLine {
  return { clienteId: null, cliente: "—", concepto: kind, monto, kind };
}

function person(
  userId: string,
  nombre: string,
  autoLines: PayrollLine[],
  manualItems: PersonPayroll["manualItems"] = []
): PersonPayroll {
  const total =
    autoLines.reduce((a, l) => a + l.monto, 0) + manualItems.reduce((a, i) => a + i.monto, 0);
  return {
    userId,
    nombre,
    rol: "diseno",
    alias: null,
    titular: null,
    autoLines,
    manualItems,
    total,
    registrado: false,
    pagado: false,
  };
}

describe("summarizePayroll", () => {
  it("agrupa por puesto y suma a la misma persona en varias cuentas", () => {
    const people = [
      person("u1", "Brisa Diaz", [line("diseno", 10000), line("diseno", 20000)]),
      person("u2", "Darío Lopez", [line("diseno", 5000), line("edicion", 17900)]),
    ];
    const { total, puestos } = summarizePayroll(people);

    expect(total).toBe(52900);
    const diseno = puestos.find((p) => p.key === "diseno")!;
    expect(diseno.monto).toBe(35000);
    expect(diseno.personas).toEqual([
      { userId: "u1", nombre: "Brisa Diaz", monto: 30000 },
      { userId: "u2", nombre: "Darío Lopez", monto: 5000 },
    ]);
    expect(Math.round(diseno.pctNomina)).toBe(66);
  });

  it("manda la comisión manual al comercial, y extras/ajustes a su propio puesto", () => {
    const people = [
      person(
        "u1",
        "Gonza Ruiz",
        [line("comercial_fijo", 50000)],
        [
          { id: "i1", tipo: "comision", concepto: "cierre", monto: 35000, cliente: null, clienteId: null },
          { id: "i2", tipo: "extra", concepto: "videos", monto: 15000, cliente: null, clienteId: null },
          { id: "i3", tipo: "ajuste", concepto: "adelanto", monto: -20000, cliente: null, clienteId: null },
        ]
      ),
    ];
    const { puestos } = summarizePayroll(people);
    const byKey = Object.fromEntries(puestos.map((p) => [p.key, p.monto]));

    expect(byKey.comercial).toBe(85000); // fijo + comisión manual
    expect(byKey.extra).toBe(15000);
    expect(byKey.ajuste).toBe(-20000);
  });

  it("no lista puestos sin plata y ordena por el orden del modelo", () => {
    const people = [person("u1", "Sol Perez", [line("cm", 70000), line("coordinacion", 50000)])];
    const { puestos } = summarizePayroll(people);
    expect(puestos.map((p) => p.key)).toEqual(["cm", "coordinacion"]);
  });

  it("con nómina en cero no divide por cero", () => {
    const { total, puestos } = summarizePayroll([]);
    expect(total).toBe(0);
    expect(puestos).toEqual([]);
  });
});

describe("payModelRules", () => {
  it("escribe las reglas con las tarifas vigentes", () => {
    const rules = payModelRules(DEFAULT_AGENCY_SETTINGS);
    const diseno = rules.find((r) => r.key === "diseno")!;
    expect(diseno.regla).toContain("$10.000");
    expect(diseno.regla).toContain("$2.000");

    const comercial = rules.find((r) => r.key === "comercial")!;
    expect(comercial.regla).toContain("$50.000");
    expect(comercial.regla).toContain("10%");
  });

  it("no promete un fijo mensual al comercial cuando está en cero", () => {
    const settings = {
      ...DEFAULT_AGENCY_SETTINGS,
      rates: { ...DEFAULT_AGENCY_SETTINGS.rates, comercial_fijo: 0 },
    };
    const comercial = payModelRules(settings).find((r) => r.key === "comercial")!;
    expect(comercial.regla).not.toContain("$0");
    expect(comercial.detalles.some((d) => d.includes("no tiene fijo mensual"))).toBe(true);
  });

  it("avisa cuando el extra de onboarding está apagado", () => {
    const settings = {
      ...DEFAULT_AGENCY_SETTINGS,
      rates: { ...DEFAULT_AGENCY_SETTINGS.rates, onboarding_extra_pct: 0 },
    };
    const onboarding = payModelRules(settings).find((r) => r.key === "onboarding")!;
    expect(onboarding.regla).toContain("Desactivado");
    // Y la CM no promete un extra que no existe.
    const cm = payModelRules(settings).find((r) => r.key === "cm")!;
    expect(cm.detalles.some((d) => d.includes("más por el arranque"))).toBe(false);
  });
});

describe("packPayoutBreakdown", () => {
  it("reparte el pack entre puestos y deja el resto para la agencia", () => {
    const [presencia] = packPayoutBreakdown(DEFAULT_AGENCY_SETTINGS);
    const r = DEFAULT_AGENCY_SETTINGS.rates;

    expect(presencia.cm).toBe(50000);
    expect(presencia.diseno).toBe(4 * r.diseno_pieza + 4 * r.portada_reel);
    expect(presencia.edicion).toBe(4 * r.edicion_reel);
    expect(presencia.pauta).toBe(50000);
    expect(presencia.coordinacion).toBe(35000); // 10% de 350.000
    expect(presencia.total).toBe(
      presencia.cm +
        presencia.diseno +
        presencia.edicion +
        presencia.pauta +
        presencia.coordinacion +
        presencia.coordDiseno
    );
    expect(presencia.queda).toBe(presencia.precio - presencia.total);
  });
});
