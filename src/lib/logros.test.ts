import { describe, expect, it } from "vitest";
import { logrosDelDia } from "./logros";

describe("logrosDelDia", () => {
  it("solo muestra lo que se ganó", () => {
    expect(logrosDelDia({ vencidas: 3, hechasHoy: 0, pendientesHoy: 2, hechasSemana: 1 })).toEqual([]);
  });
  it("día completo reemplaza a arrancaste, y suma al día y racha", () => {
    expect(logrosDelDia({ vencidas: 0, hechasHoy: 4, pendientesHoy: 0, hechasSemana: 9 }).map((x) => x.clave)).toEqual(["completo", "al-dia", "racha"]);
    expect(logrosDelDia({ vencidas: 2, hechasHoy: 1, pendientesHoy: 3, hechasSemana: 2 }).map((x) => x.texto)).toEqual(["Arrancaste: 1 hecha hoy"]);
  });
});
