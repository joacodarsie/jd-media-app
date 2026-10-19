import { describe, expect, it } from "vitest";
import { mostrarArranque, pasosArranque } from "./tu-arranque";

const nada = {
  accesosCompletos: false,
  materialAvisado: false,
  materialOrdenado: false,
  diagnosticoHecho: false,
  calendarioAprobado: false,
  tieneLogo: false,
  primeraPublicada: false,
};

describe("Tu arranque", () => {
  it("seis pasos, tres le tocan al cliente", () => {
    const p = pasosArranque({ ...nada, diagnosticoHecho: true, materialOrdenado: true });
    expect(p).toHaveLength(6);
    expect(p.filter((x) => x.teToca).map((x) => x.clave)).toEqual(["accesos", "material", "calendario"]);
    expect(p.filter((x) => x.hecho).map((x) => x.clave)).toEqual(["diagnostico", "material"]);
  });
  it("se muestra el primer mes y medio, mientras falte algo", () => {
    const p = pasosArranque(nada);
    expect(mostrarArranque("2026-10-01", "2026-10-19", p)).toBe(true);
    expect(mostrarArranque("2026-08-01", "2026-10-19", p)).toBe(false);
    expect(mostrarArranque(null, "2026-10-19", p)).toBe(false);
    const todo = pasosArranque({ ...nada, accesosCompletos: true, materialAvisado: true, diagnosticoHecho: true, calendarioAprobado: true, tieneLogo: true, primeraPublicada: true });
    expect(mostrarArranque("2026-09-10", "2026-10-19", todo)).toBe(false);
    expect(mostrarArranque("2026-10-10", "2026-10-19", todo)).toBe(true);
  });
});
