import { describe, expect, it } from "vitest";
import { esCelularUsable, esContactable, ordenarPorContactabilidad } from "./shared";

describe("esContactable", () => {
  it("con celular sirve", () => {
    expect(esContactable({ telefono: "+54 9 351 331 9555" })).toBe(true);
    expect(esContactable({ telefono: "+54 351 15 237 3494" })).toBe(true);
  });

  it("con Instagram sirve, aunque no haya teléfono", () => {
    expect(esContactable({ telefono: null, instagram: "gimnasioolimpo" })).toBe(true);
  });

  it("un fijo solo NO sirve: el WhatsApp no anda y no hay otra vía (5/10)", () => {
    expect(esContactable({ telefono: "+54 351 422 3152" })).toBe(false);
    expect(esContactable({ telefono: "+54 261 471-3299", instagram: null, sitio_web: null })).toBe(false);
  });

  it("un fijo con web sí: desde la web se encuentra otra forma de contacto", () => {
    expect(esContactable({ telefono: "+54 351 422 3152", sitio_web: "https://estudio.com.ar" })).toBe(true);
  });

  it("solo un link NO sirve", () => {
    expect(esContactable({ telefono: null, instagram: null, sitio_web: "https://x.com" })).toBe(false);
    expect(esContactable({ telefono: "  ", instagram: "  " })).toBe(false);
  });
});

describe("esCelularUsable", () => {
  it("un celular argentino bien formado", () => {
    expect(esCelularUsable("+54 9 351 856-2788")).toBe(true);
  });

  it("un número con dígitos de menos o de más no da para WhatsApp", () => {
    expect(esCelularUsable("+54 9 351 856")).toBe(false);
    expect(esCelularUsable("+54 9 351 856 27881")).toBe(false);
  });

  it("un fijo no", () => {
    expect(esCelularUsable("+54 351 4518481")).toBe(false);
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
