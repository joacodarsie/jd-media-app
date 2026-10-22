import { describe, expect, it } from "vitest";
import { lineasDeMarca } from "./iconos";

describe("el nombre de la marca en el círculo del ecosistema", () => {
  it("corto, en una línea grande", () => {
    expect(lineasDeMarca("Catch")).toEqual({ lineas: ["Catch"], tam: 24 });
  });
  it("largo, partido en dos líneas parejas", () => {
    const r = lineasDeMarca("Parrilla en Floresta");
    expect(r.lineas).toEqual(["Parrilla en", "Floresta"]);
    expect(r.tam).toBeLessThanOrEqual(18);
  });
  it("una sola palabra larga no se parte", () => {
    expect(lineasDeMarca("Supercalifragilístico").lineas).toHaveLength(1);
  });
});
