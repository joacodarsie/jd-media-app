import { describe, expect, it } from "vitest";
import { enHitoTresMeses, frase, limiteHito, mensajeHito, tareaHito } from "./hito-tres-meses";

describe("hito de los 3 meses", () => {
  it("se activa entre el día 75 y el 100", () => {
    expect(enHitoTresMeses("2026-07-23", "2026-10-22")).toBe(true); // 91 días (Impertek)
    expect(enHitoTresMeses("2026-08-08", "2026-10-22")).toBe(true); // 75
    expect(enHitoTresMeses("2026-08-09", "2026-10-22")).toBe(false); // 74
    expect(enHitoTresMeses("2026-07-05", "2026-10-22")).toBe(false); // 109
    expect(enHitoTresMeses(null, "2026-10-22")).toBe(false);
  });

  it("vence el día 90, o en 3 días si ya pasó", () => {
    expect(limiteHito("2026-08-08", "2026-10-22")).toBe("2026-11-06");
    expect(limiteHito("2026-07-23", "2026-10-22")).toBe("2026-10-25");
  });

  it("los números solo si creció", () => {
    expect(frase(62, 67)).toBe("pasó de 62 a 67 seguidores (+8%)");
    expect(frase(67, 62)).toBeNull();
    expect(frase(null, 67)).toBeNull();
  });

  it("el mensaje y la tarea", () => {
    const m = mensajeHito({ contacto: "Alonso Cuevas", cuenta: "Impertek", crecimiento: frase(62, 67), link: "https://x/c/t#crecimiento" });
    expect(m).toContain("¡Hola Alonso! 🎉 Se cumplen 3 meses");
    expect(m).toContain("Impertek pasó de 62 a 67 seguidores (+8%)");
    expect(m).toContain("https://x/c/t#crecimiento");
    expect(mensajeHito({ contacto: "Catch", cuenta: "CATCH", crecimiento: null, link: null })).not.toContain("plataforma podés");
    const t = tareaHito({ cuenta: "Impertek", clienteId: "abc", mensaje: m });
    expect(t.titulo).toBe("🎉 3 meses con Impertek: mostrale cuánto creció");
    expect(t.descripcion).toContain("/clientes/abc/crecimiento");
  });
});
