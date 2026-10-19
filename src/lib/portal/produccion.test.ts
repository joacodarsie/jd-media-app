import { describe, expect, it } from "vitest";
import { etapaDe, lineaDeProduccion } from "./produccion";

describe("línea de producción del portal", () => {
  it("cada estado cae en su etapa", () => {
    expect(["idea", "en_diseno", "edicion", "revision_creativa", "aprobado", "publicado"].map(etapaDe)).toEqual([0, 1, 1, 2, 3, -1]);
  });
  it("solo lo que viene y sin publicar, la más cercana primero", () => {
    const p = (id: string, fecha: string, estado: string) => ({ id, titulo: id, tipo: "reel", fecha_publicacion: fecha, estado });
    const r = lineaDeProduccion(
      [p("c", "2026-10-25", "aprobado"), p("a", "2026-10-20", "en_diseno"), p("viejo", "2026-10-10", "idea"), p("pub", "2026-10-21", "publicado")],
      "2026-10-19"
    );
    expect(r.piezas.map((x) => x.id)).toEqual(["a", "c"]);
    expect(r).toMatchObject({ enProduccion: 1, listas: 1 });
  });
});
