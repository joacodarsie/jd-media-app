/**
 * Las features "estrictas" son las que ni el admin tiene solo: hay que
 * otorgarlas a dedo porque gastan tokens. Si alguien suma una función cara y se
 * olvida de marcarla acá, se le habilita sola a todos los admin.
 */
import { describe, it, expect } from "vitest";
import { FEATURES, STRICT_FEATURES, isStrictFeature } from "../permissions";

describe("STRICT_FEATURES", () => {
  it("todas son features válidas", () => {
    for (const f of STRICT_FEATURES) expect(FEATURES).toContain(f);
  });

  it("las tres funciones de IA son estrictas", () => {
    expect(isStrictFeature("leads_ia")).toBe(true);
    expect(isStrictFeature("contactos_ia")).toBe(true);
    expect(isStrictFeature("jdmedia_live")).toBe(true);
  });

  it("los accesos a secciones NO son estrictos (el admin las tiene por rol)", () => {
    expect(isStrictFeature("finanzas")).toBe(false);
    expect(isStrictFeature("global")).toBe(false);
    expect(isStrictFeature("comercial")).toBe(false);
  });
});
