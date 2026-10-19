import { describe, expect, it } from "vitest";
import { diasDeReunion, esTurnoValido, etiquetaTurno, turnoDe, turnosLibres } from "./reunion-autoagenda";

describe("turnos para la reunión mensual", () => {
  it("del 1 al 7 del mes que viene, sin domingos", () => {
    // 1/11/2026 es domingo.
    expect(diasDeReunion("2026-10-19")).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]);
    expect(diasDeReunion("2026-12-20")[0]).toBe("2027-01-01");
  });
  it("si ya estamos en la semana del cierre, lo que queda de esa semana", () => {
    expect(diasDeReunion("2026-11-04")).toEqual(["2026-11-05", "2026-11-06", "2026-11-07"]);
  });
  it("de 9 a 21 h de Córdoba, sin pisar lo agendado", () => {
    const t = turnosLibres("2026-10-19", []);
    expect(t[0]).toMatchObject({ dia: "2026-11-02", hora: 9, inicio: "2026-11-02T12:00:00.000Z" });
    expect(t.filter((x) => x.dia === "2026-11-02").map((x) => x.hora)).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    const ocupado = turnoDe("2026-11-03", 15);
    const libres = turnosLibres("2026-10-19", [{ inicio: ocupado.inicio, fin: ocupado.fin }]);
    expect(libres.find((x) => x.dia === "2026-11-03" && x.hora === 15)).toBeUndefined();
  });
  it("valida el turno elegido y lo nombra", () => {
    const t = turnosLibres("2026-10-19", []);
    expect(esTurnoValido(t[2].inicio, t)).toEqual(t[2]);
    expect(esTurnoValido("2026-10-20T03:00:00.000Z", t)).toBeNull();
    expect(etiquetaTurno({ dia: "2026-11-05", hora: 19 })).toBe("jueves 5/11 a las 19 h");
  });
});
