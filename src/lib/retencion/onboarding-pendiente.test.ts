import { describe, it, expect } from "vitest";
import {
  cuentasSinOnboarding,
  diasEntre,
  type CuentaParaOnboarding,
} from "./onboarding-pendiente";

const tituloDe = (n: string) => `Onboarding 15 días — ${n}`;

const cuenta = (over: Partial<CuentaParaOnboarding> = {}): CuentaParaOnboarding => ({
  id: "c1",
  nombre: "Blasco",
  estado: "activo",
  es_interno: false,
  fecha_inicio: "2026-09-14",
  ...over,
});

const base = {
  cuentas: [cuenta()],
  titulosExistentes: [] as string[],
  tituloDe,
  hoy: "2026-09-20",
};

describe("diasEntre", () => {
  it("cuenta los días sin enredarse con la zona horaria", () => {
    expect(diasEntre("2026-09-14", "2026-09-20")).toBe(6);
    expect(diasEntre("2026-09-20", "2026-09-20")).toBe(0);
    expect(diasEntre("2026-09-25", "2026-09-20")).toBe(-5);
  });
});

describe("cuentasSinOnboarding", () => {
  it("agarra la cuenta nueva que no tiene su ticket", () => {
    expect(cuentasSinOnboarding(base).map((c) => c.nombre)).toEqual(["Blasco"]);
  });

  it("no lo vuelve a crear si el ticket ya existe", () => {
    expect(
      cuentasSinOnboarding({ ...base, titulosExistentes: [tituloDe("Blasco")] })
    ).toHaveLength(0);
  });

  it("deja afuera lo que no es una cuenta activa de cliente", () => {
    for (const over of [
      { estado: "propuesta" },
      { estado: "perdido" },
      { estado: "en_pausa" },
      { es_interno: true },
    ]) {
      expect(cuentasSinOnboarding({ ...base, cuentas: [cuenta(over)] })).toHaveLength(0);
    }
  });

  it("sin fecha de inicio no se puede fechar el plan: se saltea", () => {
    expect(
      cuentasSinOnboarding({ ...base, cuentas: [cuenta({ fecha_inicio: null })] })
    ).toHaveLength(0);
  });

  it("a una cuenta vieja no se le arma un arranque: sería ruido", () => {
    expect(
      cuentasSinOnboarding({ ...base, cuentas: [cuenta({ fecha_inicio: "2026-06-01" })] })
    ).toHaveLength(0);
  });

  it("justo en el límite todavía entra, un día después no", () => {
    expect(
      cuentasSinOnboarding({ ...base, cuentas: [cuenta({ fecha_inicio: "2026-08-21" })] })
    ).toHaveLength(1);
    expect(
      cuentasSinOnboarding({ ...base, cuentas: [cuenta({ fecha_inicio: "2026-08-20" })] })
    ).toHaveLength(0);
  });

  it("una cuenta que arranca la semana que viene también cuenta", () => {
    expect(
      cuentasSinOnboarding({ ...base, cuentas: [cuenta({ fecha_inicio: "2026-09-28" })] })
    ).toHaveLength(1);
  });

  it("con varias cuentas devuelve solo las que faltan", () => {
    const out = cuentasSinOnboarding({
      ...base,
      cuentas: [
        cuenta({ id: "a", nombre: "Blasco" }),
        cuenta({ id: "b", nombre: "CATCH" }),
        cuenta({ id: "c", nombre: "Magic", fecha_inicio: "2026-07-05" }),
      ],
      titulosExistentes: [tituloDe("CATCH")],
    });
    expect(out.map((c) => c.nombre)).toEqual(["Blasco"]);
  });
});
