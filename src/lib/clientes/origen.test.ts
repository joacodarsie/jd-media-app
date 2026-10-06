import { describe, expect, it } from "vitest";
import { esOrigen, labelOrigen, origenDeLead, resumenOrigenes } from "./origen";

describe("origenDeLead", () => {
  it("lleva el texto libre del lead a la lista", () => {
    expect(origenDeLead("web")).toBe("web");
    expect(origenDeLead("Instagram")).toBe("redes");
    expect(origenDeLead("Referido de Juan")).toBe("referido");
    expect(origenDeLead("anuncio de Meta")).toBe("pauta");
    expect(origenDeLead("feria")).toBe("otro");
    expect(origenDeLead("")).toBeNull();
    expect(origenDeLead(null)).toBeNull();
  });
});

describe("esOrigen / labelOrigen", () => {
  it("solo acepta los de la lista", () => {
    expect(esOrigen("pauta")).toBe(true);
    expect(esOrigen("cualquiera")).toBe(false);
    expect(labelOrigen(null)).toBe("Sin dato");
    expect(labelOrigen("contacto_propio")).toBe("Contacto propio");
  });
});

describe("resumenOrigenes", () => {
  it("agrupa por origen, el que más factura primero y sin dato al final", () => {
    const r = resumenOrigenes([
      { origen: "pauta", monto_mensual: 400000 },
      { origen: "referido", monto_mensual: 300000 },
      { origen: "referido", monto_mensual: 350000 },
      { origen: null, monto_mensual: 900000 },
      { origen: "raro", monto_mensual: 100000 },
    ]);
    expect(r.map((f) => [f.label, f.cuentas, f.monto])).toEqual([
      ["Referido", 2, 650000],
      ["Pauta (anuncios)", 1, 400000],
      ["Sin dato", 2, 1000000],
    ]);
  });
});
