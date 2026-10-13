import { describe, expect, it } from "vitest";
import { corresponderPedirResena, mensajeResena } from "./resena";

describe("pedido de reseña en Google", () => {
  it("solo a quien puntuó 4 o 5", () => {
    expect(corresponderPedirResena(5)).toBe(true);
    expect(corresponderPedirResena(4)).toBe(true);
    expect(corresponderPedirResena(3)).toBe(false);
    expect(corresponderPedirResena(null)).toBe(false);
  });
  it("el mensaje lleva el link, el nombre del contacto y la firma", () => {
    const m = mensajeResena({ contactoNombre: "Maiki Pérez", deParte: "Luz Torres" });
    expect(m).toContain("¡Hola Maiki!");
    expect(m).toContain("https://g.page/r/CbfZnUkNWAtNECE/review");
    expect(m).toContain("Luz de JD Media");
  });
  it("sin nombre ni firma, igual se entiende", () => {
    const m = mensajeResena({});
    expect(m.startsWith("¡Hola! Gracias")).toBe(true);
    expect(m).toContain("Equipo de JD Media");
  });
});
