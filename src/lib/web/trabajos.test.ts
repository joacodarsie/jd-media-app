import { describe, expect, it } from "vitest";
import { elegirTrabajos, type PiezaIg } from "./trabajos";

const p = (id: string, fecha: string, tipo = "IMAGE", img: string | null = "https://img/" + id): PiezaIg => ({
  id,
  media_type: tipo,
  permalink: "https://instagram.com/p/" + id,
  thumbnail_url: img,
  timestamp: `${fecha}T15:00:00+0000`,
});

describe("trabajo real para la web", () => {
  it("solo lo publicado desde que la cuenta trabaja con nosotros", () => {
    const t = elegirTrabajos([
      { nombre: "A", usuario: "a", desde: "2026-09-01", piezas: [p("viejo", "2026-08-20"), p("nuevo", "2026-09-10")] },
    ]);
    expect(t.map((x) => x.id)).toEqual(["nuevo"]);
  });

  it("intercala cuentas y respeta el máximo", () => {
    const t = elegirTrabajos(
      [
        { nombre: "A", usuario: "a", desde: null, piezas: [p("a1", "2026-10-01"), p("a2", "2026-10-05")] },
        { nombre: "B", usuario: "b", desde: null, piezas: [p("b1", "2026-10-02")] },
      ],
      3
    );
    expect(t.map((x) => x.id)).toEqual(["a2", "b1", "a1"]);
  });

  it("descarta lo que no tiene imagen y traduce el tipo", () => {
    const t = elegirTrabajos([
      { nombre: "A", usuario: "a", desde: null, piezas: [p("sin", "2026-10-01", "IMAGE", null), p("r", "2026-10-02", "VIDEO")] },
    ]);
    expect(t).toHaveLength(1);
    expect(t[0].tipo).toBe("reel");
  });
});
