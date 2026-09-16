import { describe, expect, it } from "vitest";
import { esContactable, ordenarPorContactabilidad } from "./shared";

describe("esContactable", () => {
  it("con celular sirve", () => {
    expect(esContactable({ telefono: "+54 9 351 331 9555" })).toBe(true);
  });

  it("con Instagram sirve, aunque no haya teléfono", () => {
    expect(esContactable({ telefono: null, instagram: "gimnasioolimpo" })).toBe(true);
  });

  it("un fijo también sirve: se puede llamar", () => {
    expect(esContactable({ telefono: "+54 351 422 3152" })).toBe(true);
  });

  it("solo un link NO sirve: es el caso que se filtró mal", () => {
    expect(esContactable({ telefono: null, instagram: null })).toBe(false);
    expect(esContactable({ telefono: "  ", instagram: "  " })).toBe(false);
  });
});

describe("ordenarPorContactabilidad", () => {
  it("primero celular con Instagram, último el fijo solo", () => {
    const orden = ordenarPorContactabilidad([
      { empresa: "fijo", telefono: "+54 351 422 3152", instagram: null },
      { empresa: "ig", telefono: null, instagram: "cuenta" },
      { empresa: "completo", telefono: "+54 9 351 331 9555", instagram: "cuenta" },
      { empresa: "celu", telefono: "+54 9 351 331 9556", instagram: null },
    ]).map((c) => c.empresa);
    expect(orden).toEqual(["completo", "celu", "ig", "fijo"]);
  });
});
