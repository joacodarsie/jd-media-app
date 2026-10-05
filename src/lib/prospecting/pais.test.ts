import { describe, expect, it } from "vitest";
import { paisDeZona, telefonoDeOtroPais, zonaConPais } from "./pais";

describe("zonaConPais", () => {
  it("Córdoba es Córdoba, Argentina", () => {
    expect(zonaConPais("Córdoba")).toBe("Córdoba, Argentina");
    expect(zonaConPais("Nueva Córdoba, Córdoba")).toBe("Nueva Córdoba, Córdoba, Argentina");
    expect(zonaConPais(null)).toBe("Argentina");
  });
  it("no repite el país ni pisa otro", () => {
    expect(zonaConPais("Mendoza, Argentina")).toBe("Mendoza, Argentina");
    expect(zonaConPais("Madrid")).toBe("Madrid");
    expect(paisDeZona("Madrid").codigo).toBe("34");
  });
});

describe("telefonoDeOtroPais", () => {
  it("un +34 en una búsqueda argentina es de otro país", () => {
    expect(telefonoDeOtroPais("+34 957 12 34 56", "54")).toBe(true);
    expect(telefonoDeOtroPais("0034 957 123456", "54")).toBe(true);
  });
  it("los argentinos y los que no traen código pasan", () => {
    expect(telefonoDeOtroPais("+54 9 351 386 5433", "54")).toBe(false);
    expect(telefonoDeOtroPais("0351 15 386 5433", "54")).toBe(false);
    expect(telefonoDeOtroPais("351 386 5433", "54")).toBe(false);
    expect(telefonoDeOtroPais(null, "54")).toBe(false);
  });
});
