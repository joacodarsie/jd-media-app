import { describe, expect, it } from "vitest";
import { cadenciaDe, lunesDe, puestaAPunto, rutinasDeDireccion } from "./rutina";

describe("rutina de la dirección", () => {
  it("sin dueño no se genera nada", () => {
    expect(rutinasDeDireccion("2026-10-12", null)).toEqual([]);
  });

  it("octubre empieza trimestre: semana + mes + trimestre", () => {
    const t = rutinasDeDireccion("2026-10-14", "yo");
    expect(t.map((x) => x.rutina_key)).toEqual([
      "dir:2026-10-12:ronda",
      "dir:2026-10:revisar-mes",
      "dir:2026-10:rrhh",
      "dir:2026-10:objetivos",
      "dir:2026-T4:evaluacion",
      "dir:2026-T4:clima",
      "dir:2026-T4:sueldos",
    ]);
    expect(t.every((x) => x.asignado_a_id === "yo" && x.area === "Estrategia/Dirección")).toBe(true);
    // La ronda vence el martes de esa semana.
    expect(t[0].fecha_limite).toBe("2026-10-13");
  });

  it("noviembre no es inicio de trimestre", () => {
    expect(rutinasDeDireccion("2026-11-03", "yo")).toHaveLength(4);
  });

  it("el domingo pertenece a la semana que empezó el lunes anterior", () => {
    expect(lunesDe("2026-10-18")).toBe("2026-10-12");
    expect(lunesDe("2026-10-12")).toBe("2026-10-12");
  });

  it("la cadencia se lee de la clave", () => {
    expect(cadenciaDe("dir:2026-10-12:ronda")).toBe("semana");
    expect(cadenciaDe("dir:2026-10:rrhh")).toBe("mes");
    expect(cadenciaDe("dir:2026-T4:clima")).toBe("trimestre");
    expect(cadenciaDe("2026-10:cobrar")).toBeNull();
  });

  it("la puesta a punto es de una vez y va al dueño", () => {
    const t = puestaAPunto("yo");
    expect(t.length).toBe(5);
    expect(t.every((x) => cadenciaDe(x.rutina_key) === "una_vez")).toBe(true);
    expect(puestaAPunto(null)).toEqual([]);
  });

  it("febrero corto: el día 28/30 se recorta", () => {
    const f = rutinasDeDireccion("2027-02-02", "yo").find((x) => x.rutina_key.endsWith("objetivos"));
    expect(f?.fecha_limite).toBe("2027-02-28");
  });
});
