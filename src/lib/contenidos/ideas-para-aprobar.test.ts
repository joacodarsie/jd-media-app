import { describe, it, expect } from "vitest";
import { avisoIdeasParaAprobar } from "./ideas-para-aprobar";

const HOY = "2026-09-29";
const cuentas = [
  { id: "catch", nombre: "CATCH", estado: "activo" },
  { id: "nazar", nombre: "Nazar Hogar", estado: "activo" },
  { id: "baja", nombre: "Se fue", estado: "perdido" },
];
const idea = (cliente_id: string, fecha_publicacion: string) => ({ cliente_id, fecha_publicacion });

describe("avisoIdeasParaAprobar", () => {
  it("cuenta las ideas de las próximas dos semanas, por cuenta, la que más tiene primero", () => {
    const m = avisoIdeasParaAprobar(
      [idea("nazar", "2026-10-01"), idea("catch", "2026-09-29"), idea("catch", "2026-10-13T13:00:00Z")],
      cuentas,
      HOY
    );
    expect(m).toBe(
      "📅 Calendarios para aprobar: 3 ideas de las próximas dos semanas (CATCH 2, Nazar Hogar 1). Sin tu OK no se producen."
    );
  });

  it("deja afuera lo que ya pasó, lo muy lejano y las cuentas que no están activas", () => {
    expect(
      avisoIdeasParaAprobar(
        [idea("catch", "2026-09-28"), idea("catch", "2026-10-20"), idea("baja", "2026-10-01")],
        cuentas,
        HOY
      )
    ).toBeNull();
  });

  it("con muchas cuentas nombra cuatro y suma el resto", () => {
    const muchas = ["a", "b", "c", "d", "e"].map((id) => ({ id, nombre: id.toUpperCase(), estado: "activo" }));
    const m = avisoIdeasParaAprobar(
      muchas.map((c) => idea(c.id, "2026-10-01")),
      muchas,
      HOY
    );
    expect(m).toContain("y 1 cuenta más");
  });
});
