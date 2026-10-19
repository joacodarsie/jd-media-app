import { describe, expect, it } from "vitest";
import { mostrarPrimeraSemana, pasosPrimeraSemana } from "./primera-semana";

const base = { tieneFoto: false, tienePush: false, secciones: new Set<string>(), cerroUnaTarea: false, escribioEnElChat: false, rol: "diseno" };

describe("Tu primera semana", () => {
  it("cada paso se marca solo con lo que ya hizo", () => {
    const p = pasosPrimeraSemana({ ...base, tieneFoto: true, secciones: new Set(["Ayuda", "Contenidos"]) });
    expect(p.filter((x) => x.hecho).map((x) => x.clave)).toEqual(["foto", "ayuda", "calendario"]);
    expect(p.at(-1)?.clave).toBe("tarea");
  });
  it("paid media ve su paso propio y no el del calendario", () => {
    const claves = pasosPrimeraSemana({ ...base, rol: "paid_media" }).map((x) => x.clave);
    expect(claves).toContain("pauta");
    expect(claves).not.toContain("calendario");
  });
  it("se muestra 14 días o hasta completarlo", () => {
    const ahora = Date.parse("2026-10-19T12:00:00Z");
    const p = pasosPrimeraSemana(base);
    expect(mostrarPrimeraSemana("2026-10-17T12:00:00Z", ahora, p)).toBe(true);
    expect(mostrarPrimeraSemana("2026-09-01T12:00:00Z", ahora, p)).toBe(false);
    expect(mostrarPrimeraSemana("2026-10-17T12:00:00Z", ahora, p.map((x) => ({ ...x, hecho: true })))).toBe(false);
  });
});
