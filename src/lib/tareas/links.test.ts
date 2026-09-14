import { describe, it, expect } from "vitest";
import { normalizarLinks } from "./links";

describe("normalizarLinks", () => {
  it("descarta las filas vacías", () => {
    expect(normalizarLinks([{ label: "", url: "" }, { label: "Algo", url: "  " }]).links).toEqual([]);
  });

  it("agrega https y usa el dominio como nombre si falta", () => {
    const { links } = normalizarLinks([{ label: "", url: "www.instagram.com/wowitoss" }]);
    expect(links).toEqual([{ label: "instagram.com", url: "https://www.instagram.com/wowitoss" }]);
  });

  it("respeta el nombre que se escribió", () => {
    const { links } = normalizarLinks([{ label: "Referencia de reel", url: "https://drive.google.com/x" }]);
    expect(links[0].label).toBe("Referencia de reel");
  });

  it("no guarda dos veces el mismo link", () => {
    const { links } = normalizarLinks([
      { label: "A", url: "https://ejemplo.com/a" },
      { label: "B", url: "ejemplo.com/a" },
    ]);
    expect(links).toHaveLength(1);
  });

  it("avisa con la dirección que no se entiende", () => {
    const r = normalizarLinks([{ label: "", url: "esto no es un link" }]);
    expect(r.error).toContain("esto no es un link");
    expect(r.links).toEqual([]);
  });
});
