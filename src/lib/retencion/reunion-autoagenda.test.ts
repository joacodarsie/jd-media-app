import { describe, expect, it } from "vitest";
import { esTurnoValido, etiquetaTurno, turnoDe, turnosLibres } from "./reunion-autoagenda";

describe("turnos para la reunión mensual", () => {
  it("desde mañana, solo días hábiles, en hora de Córdoba", () => {
    const t = turnosLibres("2026-10-24", []); // sábado
    expect(t[0].dia).toBe("2026-10-26"); // lunes
    expect(t[0].inicio).toBe("2026-10-26T13:00:00.000Z"); // 10 h Córdoba
    expect(new Set(t.map((x) => x.dia)).size).toBe(6);
    expect(t.some((x) => ["2026-10-31", "2026-11-01"].includes(x.dia))).toBe(false);
  });
  it("no pisa lo que ya tiene agendado", () => {
    const ocupado = turnoDe("2026-10-20", 15);
    const t = turnosLibres("2026-10-19", [{ inicio: ocupado.inicio, fin: ocupado.fin }]);
    expect(t.find((x) => x.dia === "2026-10-20" && x.hora === 15)).toBeUndefined();
    expect(t.find((x) => x.dia === "2026-10-20" && x.hora === 16)).toBeDefined();
  });
  it("valida el turno elegido y lo nombra", () => {
    const t = turnosLibres("2026-10-19", []);
    expect(esTurnoValido(t[2].inicio, t)).toEqual(t[2]);
    expect(esTurnoValido("2026-10-20T03:00:00.000Z", t)).toBeNull();
    expect(etiquetaTurno({ dia: "2026-10-23", hora: 15 })).toBe("viernes 23/10 a las 15 h");
  });
});
