import { describe, expect, it } from "vitest";
import { separarCuentasDelMes } from "./cuentas-del-mes";

const lubricentro = { id: "lub", estado: "perdido", fecha_inactivado: "2026-10-13T15:00:00+00:00" };
const resonar = { id: "res", estado: "activo", fecha_inactivado: null };
const powerViejo = { id: "pow", estado: "perdido", fecha_inactivado: "2026-08-08T10:00:00+00:00" };
const propuesta = { id: "pro", estado: "propuesta", fecha_inactivado: null };

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("separarCuentasDelMes", () => {
  const todas = [lubricentro, resonar, powerViejo, propuesta];

  it("un mes antes de la baja la cuenta se liquida entera", () => {
    const r = separarCuentasDelMes(todas, "2026-09");
    expect(ids(r.activas)).toEqual(["lub", "res"]);
    expect(r.bajas).toEqual([]);
  });

  it("el mes de la baja queda aparte (solo contenido publicado)", () => {
    const r = separarCuentasDelMes(todas, "2026-10");
    expect(ids(r.activas)).toEqual(["res"]);
    expect(ids(r.bajas)).toEqual(["lub"]);
  });

  it("después de la baja no aparece", () => {
    const r = separarCuentasDelMes(todas, "2026-11");
    expect(ids(r.activas)).toEqual(["res"]);
    expect(r.bajas).toEqual([]);
  });

  it("sin fecha de baja y sin estar activa, nunca entra", () => {
    const r = separarCuentasDelMes([propuesta, { id: "pau", estado: "en_pausa", fecha_inactivado: null }], "2026-10");
    expect(r.activas).toEqual([]);
    expect(r.bajas).toEqual([]);
  });

  it("una cuenta en pausa usa su fecha de pausa", () => {
    const blasco = { id: "bla", estado: "en_pausa", fecha_inactivado: null, fecha_pausa: "2026-10-20T22:37:45+00:00" };
    expect(ids(separarCuentasDelMes([blasco], "2026-09").activas)).toEqual(["bla"]);
    expect(ids(separarCuentasDelMes([blasco], "2026-10").bajas)).toEqual(["bla"]);
  });

  it("reactivada: el mes de la pausa solo contenido, el del medio nada, la vuelta entera", () => {
    const vuelta = {
      id: "vue",
      estado: "activo",
      fecha_inactivado: null,
      fecha_pausa: "2026-10-20T10:00:00+00:00",
      fecha_reactivacion: "2026-12-03T10:00:00+00:00",
    };
    expect(ids(separarCuentasDelMes([vuelta], "2026-09").activas)).toEqual(["vue"]);
    expect(ids(separarCuentasDelMes([vuelta], "2026-10").bajas)).toEqual(["vue"]);
    const nov = separarCuentasDelMes([vuelta], "2026-11");
    expect([...nov.activas, ...nov.bajas]).toEqual([]);
    expect(ids(separarCuentasDelMes([vuelta], "2026-12").activas)).toEqual(["vue"]);
  });

  it("pausada y reactivada en el mismo mes: se liquida normal", () => {
    const corta = { id: "cor", estado: "activo", fecha_pausa: "2026-10-05", fecha_reactivacion: "2026-10-20" };
    expect(ids(separarCuentasDelMes([corta], "2026-10").activas)).toEqual(["cor"]);
  });
});
