import { describe, it, expect } from "vitest";
import {
  armarPlan,
  mensajeReactivacion,
  mensajeReferido,
  mesesEntre,
  primerNombre,
  ritmoNecesario,
  type ClienteParaPedir,
} from "./plan";

const HOY = "2026-07-30";

const activo = (over: Partial<ClienteParaPedir> = {}): ClienteParaPedir => ({
  id: "a1",
  nombre: "Magic",
  contacto_nombre: "Ana Pérez",
  contacto_telefono: "+5493511234567",
  rubro: "Indumentaria",
  monto_mensual: 350000,
  fecha: "2026-01-05",
  ...over,
});

describe("mesesEntre", () => {
  it("cuenta meses enteros", () => {
    expect(mesesEntre("2026-01-30", HOY)).toBe(6);
    expect(mesesEntre("2026-07-01", HOY)).toBe(0);
  });
  it("tolera datos faltantes o rotos", () => {
    expect(mesesEntre(null, HOY)).toBe(0);
    expect(mesesEntre("no es fecha", HOY)).toBe(0);
  });
  it("nunca da negativo", () => {
    expect(mesesEntre("2027-01-01", HOY)).toBe(0);
  });
});

describe("primerNombre", () => {
  it("toma el primero y lo capitaliza", () => {
    expect(primerNombre("ana maría pérez")).toBe("Ana");
    expect(primerNombre("  JUAN  ")).toBe("JUAN");
  });
  it("devuelve null si no hay nombre", () => {
    expect(primerNombre(null)).toBeNull();
    expect(primerNombre("   ")).toBeNull();
  });
});

describe("mensajeReferido", () => {
  it("pide UNA persona concreta y usa el rubro como ejemplo", () => {
    const m = mensajeReferido({
      empresa: "Magic",
      persona: "Ana",
      rubro: "Indumentaria",
      meses: 6,
    });
    expect(m).toContain("Hola Ana!");
    expect(m).toContain("6 meses");
    expect(m).toContain("UNA persona");
    expect(m).toContain("indumentaria");
  });

  it("sin persona no deja el saludo colgado", () => {
    const m = mensajeReferido({ empresa: "Magic", persona: null, rubro: null, meses: 0 });
    expect(m.startsWith("Hola! ")).toBe(true);
    expect(m).not.toContain("undefined");
    expect(m).not.toContain("null");
  });

  it("el incentivo es opcional y solo aparece si se pasa", () => {
    const base = { empresa: "Magic", persona: "Ana", rubro: null, meses: 3 };
    expect(mensajeReferido(base)).not.toContain("Y si cierra");
    expect(mensajeReferido({ ...base, incentivo: "te regalo un mes" })).toContain(
      "Y si cierra, te regalo un mes."
    );
  });

  it("cambia el texto para un cliente nuevo", () => {
    const m = mensajeReferido({ empresa: "Magic", persona: "Ana", rubro: null, meses: 1 });
    expect(m).toContain("Arrancamos hace poco");
    expect(m).not.toContain("1 meses");
  });
});

describe("mensajeReactivacion", () => {
  it("ofrece algo concreto y no reclama nada", () => {
    const m = mensajeReactivacion({ empresa: "Alonso", persona: "Christian", mesesDesdeBaja: 3 });
    expect(m).toContain("Hola Christian");
    expect(m).toContain("revisión gratis");
    expect(m.toLowerCase()).not.toContain("perdón");
  });
});

describe("armarPlan", () => {
  const perdido: ClienteParaPedir = {
    id: "p1",
    nombre: "Alonso",
    contacto_nombre: "Christian",
    contacto_telefono: "+5493513268609",
    rubro: "Panadería",
    monto_mensual: 500000,
    fecha: "2026-07-02",
  };

  it("junta referidos y reactivaciones", () => {
    const plan = armarPlan({ activos: [activo()], perdidos: [perdido], yaHechos: [], hoy: HOY });
    expect(plan).toHaveLength(2);
    expect(plan.map((a) => a.tipo).sort()).toEqual(["reactivacion", "referido"]);
  });

  it("saca a los que ya se trabajaron, sin confundir los tipos", () => {
    const plan = armarPlan({
      activos: [activo({ id: "x" })],
      perdidos: [{ ...perdido, id: "x" }],
      // Mismo id, distinto tipo: solo debe sacar el referido.
      yaHechos: [{ tipo: "referido", targetId: "x" }],
      hoy: HOY,
    });
    expect(plan).toHaveLength(1);
    expect(plan[0].tipo).toBe("reactivacion");
  });

  it("pone primero al cliente de más meses y último al que no tiene teléfono", () => {
    const plan = armarPlan({
      activos: [
        activo({ id: "nuevo", nombre: "Nuevo", fecha: "2026-07-20" }),
        activo({ id: "viejo", nombre: "Viejo", fecha: "2025-07-01" }),
        activo({ id: "sintel", nombre: "SinTel", fecha: "2025-07-01", contacto_telefono: null }),
      ],
      perdidos: [],
      yaHechos: [],
      hoy: HOY,
    });
    expect(plan.map((a) => a.empresa)).toEqual(["Viejo", "Nuevo", "SinTel"]);
  });

  it("el motivo del perdido muestra cuánto pagaba", () => {
    const plan = armarPlan({ activos: [], perdidos: [perdido], yaHechos: [], hoy: HOY });
    expect(plan[0].motivo).toContain("$500.000");
  });
});

describe("ritmoNecesario", () => {
  it("dice la verdad cuando el ritmo histórico no alcanza", () => {
    // 10 clientes en 7 días hábiles contra un histórico de 5,7 por mes.
    const r = ritmoNecesario({
      meta: 10,
      yaConseguidos: 0,
      diasHabilesRestantes: 7,
      altasPorMesHistorico: 5.7,
    });
    expect(r.faltan).toBe(10);
    expect(r.porDia).toBeCloseTo(1.43, 2);
    expect(r.ritmoHistoricoPorDia).toBeCloseTo(0.26, 2);
    expect(r.alcanza).toBe(false);
  });

  it("no pide nada si ya se llegó", () => {
    const r = ritmoNecesario({
      meta: 10,
      yaConseguidos: 12,
      diasHabilesRestantes: 5,
      altasPorMesHistorico: 5.7,
    });
    expect(r.faltan).toBe(0);
    expect(r.alcanza).toBe(true);
  });

  it("no divide por cero si se acabó el plazo", () => {
    const r = ritmoNecesario({
      meta: 10,
      yaConseguidos: 0,
      diasHabilesRestantes: 0,
      altasPorMesHistorico: 5.7,
    });
    expect(Number.isFinite(r.porDia)).toBe(true);
  });
});
