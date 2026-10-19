import { describe, expect, it } from "vitest";
import { fraseDelDia, momentoDelDia } from "./saludo-del-dia";

describe("saludo del día", () => {
  it("elige el momento por la hora", () => {
    expect([3, 9, 15, 19, 22].map(momentoDelDia)).toEqual(["madrugada", "manana", "tarde", "atardecer", "noche"]);
  });

  it("resume lo importante en una frase", () => {
    expect(fraseDelDia({ vencidas: 2, hoy: 1, reunion: { titulo: "Semanal", hora: "13:00" }, piezasHoy: 0 })).toBe(
      "Lo importante: 2 tareas vencidas para ponerte al día, 1 que vence hoy y la reunión «Semanal» a las 13:00."
    );
    expect(fraseDelDia({ vencidas: 0, hoy: 0, reunion: null, piezasHoy: 3 })).toBe("Lo importante: 3 piezas que salen hoy.");
    expect(fraseDelDia({ vencidas: 0, hoy: 0, reunion: null, piezasHoy: 0 })).toMatch(/^Día tranquilo/);
  });
});
