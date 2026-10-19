import { describe, expect, it } from "vitest";
import { cuandoVence } from "./dates";

describe("cuándo vence, en palabras", () => {
  it("dice la fecha como una persona", () => {
    const hoy = "2026-10-19"; // lunes
    expect(cuandoVence("2026-10-13", hoy)).toBe("Venció hace 6 días");
    expect(cuandoVence("2026-10-18", hoy)).toBe("Venció ayer");
    expect(cuandoVence("2026-10-19", hoy)).toBe("Hoy");
    expect(cuandoVence("2026-10-20", hoy)).toBe("Mañana");
    expect(cuandoVence("2026-10-23", hoy)).toBe("Viernes");
    expect(cuandoVence("2026-10-28", hoy)).toBe("mié 28/10");
    expect(cuandoVence(null, hoy)).toBe("Sin fecha");
  });
});
