import { describe, expect, it } from "vitest";
import { sinVacios } from "./sin-vacios";

describe("sinVacios", () => {
  it("saca solo los null: false, 0 y texto vacío se quedan", () => {
    const [f] = sinVacios([{ a: null, b: false, c: 0, d: "", e: "x" }]);
    expect(f).toEqual({ b: false, c: 0, d: "", e: "x" });
  });
  it("no toca la fila original", () => {
    const fila = { a: null };
    sinVacios([fila]);
    expect(fila).toEqual({ a: null });
  });
});
