import { describe, expect, it } from "vitest";
import { avisoTrabada, etiquetaTrabada } from "./trabada";

describe("tarea trabada", () => {
  it("el aviso dice quién espera qué", () => {
    expect(avisoTrabada({ quien: "Sofía", tarea: "Reel 3", cuenta: "Magic", tipo: "cliente", detalle: "falta el video" })).toBe(
      "🧱 Sofía no puede avanzar con «Reel 3» (Magic): espera al cliente. Dice: «falta el video» Apurá al cliente."
    );
    expect(avisoTrabada({ quien: "Sofía", tarea: "Reel 3", cuenta: null, tipo: "persona", detalle: null })).toBe(
      "🧱 Sofía te está esperando para avanzar con «Reel 3»."
    );
  });
  it("la etiqueta de la fila", () => {
    expect(etiquetaTrabada("cliente", null)).toBe("Esperando al cliente");
    expect(etiquetaTrabada("persona", "Guillermo Pérez")).toBe("Esperando a Guillermo");
    expect(etiquetaTrabada(null, null)).toBeNull();
  });
});
