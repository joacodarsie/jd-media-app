import { describe, expect, it } from "vitest";
import { hrefDeAviso, pestanaValida, PESTANAS } from "./pestanas";

describe("pestañas del portal", () => {
  it("el calendario va primero y es la que se abre por defecto", () => {
    expect(PESTANAS[0].clave).toBe("calendario");
    expect(pestanaValida(undefined)).toBe("calendario");
    expect(pestanaValida("cualquiera")).toBe("calendario");
    expect(pestanaValida("reunion")).toBe("reunion");
    expect(pestanaValida(["cuenta"])).toBe("cuenta");
  });

  it("cada aviso lleva a la pestaña donde está lo que hay que hacer", () => {
    expect(hrefDeAviso("#revisar")).toBe("?ver=calendario#revisar");
    expect(hrefDeAviso("#reunion")).toBe("?ver=reunion#reunion");
    expect(hrefDeAviso("#accesos")).toBe("?ver=cuenta#accesos");
    expect(hrefDeAviso("/contrato/cliente/1?token=x")).toBe("/contrato/cliente/1?token=x");
    expect(hrefDeAviso(null)).toBeNull();
  });
});
