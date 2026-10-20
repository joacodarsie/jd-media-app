import { describe, expect, it } from "vitest";
import { avisoTrabada, etiquetaTrabada, fechaAlReanudar } from "./trabada";

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
    expect(etiquetaTrabada("cliente", null)).toBe("En pausa: espera al cliente");
    expect(etiquetaTrabada("persona", "Guillermo Pérez")).toBe("Esperando a Guillermo");
    expect(etiquetaTrabada(null, null)).toBeNull();
  });
});

describe("fechaAlReanudar", () => {
  it("corre la fecha los días que estuvo en pausa", () => {
    expect(fechaAlReanudar("2026-10-22", "2026-10-20", "2026-10-25")).toBe("2026-10-27");
  });
  it("cruza de mes", () => {
    expect(fechaAlReanudar("2026-10-30", "2026-10-28", "2026-11-02")).toBe("2026-11-04");
  });
  it("el mismo día no la mueve, ni tampoco sin fecha o sin inicio de pausa", () => {
    expect(fechaAlReanudar("2026-10-22", "2026-10-20", "2026-10-20")).toBe("2026-10-22");
    expect(fechaAlReanudar(null, "2026-10-20", "2026-10-25")).toBeNull();
    expect(fechaAlReanudar("2026-10-22", null, "2026-10-25")).toBe("2026-10-22");
  });
  it("una vencida también se corre: suma los días de pausa", () => {
    expect(fechaAlReanudar("2026-10-15", "2026-10-18", "2026-10-21")).toBe("2026-10-18");
  });
});
