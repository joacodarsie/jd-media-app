import { describe, expect, it } from "vitest";
import { etiquetaPlazo, mas24Habiles, plazoAprobacion } from "./aprobacion-tacita";

describe("aprobación tácita", () => {
  it("el plazo de la carta: las piezas del 16 en adelante se aprueban el 15", () => {
    // Enviada con tiempo (el 10): manda la carta.
    const p = plazoAprobacion("2026-10-20", "2026-10-10T15:00:00Z");
    expect(etiquetaPlazo(p)).toBe("el jueves 15/10 a las 23:59");
  });
  it("las del 1 al 15 se aprueban el 30 del mes anterior", () => {
    expect(etiquetaPlazo(plazoAprobacion("2026-11-05", "2026-10-20T15:00:00Z"))).toBe("el viernes 30/10 a las 23:59");
  });
  it("si la mandamos tarde, el cliente igual tiene 24 horas hábiles", () => {
    // Mandada el viernes 16/10 a las 10 (13 UTC): vence el lunes 19 a las 10.
    const p = plazoAprobacion("2026-10-20", "2026-10-16T13:00:00Z");
    expect(etiquetaPlazo(p)).toBe("el lunes 19/10 a las 10:00");
  });
  it("las 24 horas hábiles saltan el fin de semana", () => {
    const sab = Date.parse("2026-10-17T13:00:00Z"); // sábado 10 h
    expect(new Date(mas24Habiles(sab)).toISOString()).toBe("2026-10-20T03:00:00.000Z"); // martes 00 h
  });
});

describe("a dónde va la pieza cuando la aprueba Santi", () => {
  it("con tiempo, al cliente; sobre la hora o sin fecha, directo a programada", async () => {
    const { destinoConCliente } = await import("./aprobacion-tacita");
    // Sale el lunes 2/11 a la tarde; se aprueba el martes 27/10: el cliente tiene hasta el 30/10.
    expect(destinoConCliente("2026-11-02T18:00:00+00:00", Date.parse("2026-10-27T15:00:00Z"))).toBe("revision_cliente");
    // Se aprueba el martes a las 22 h y sale el miércoles a las 15 h: no llega a verla.
    expect(destinoConCliente("2026-10-28T18:00:00+00:00", Date.parse("2026-10-28T01:00:00Z"))).toBe("aprobado");
    expect(destinoConCliente(null, Date.parse("2026-10-27T15:00:00Z"))).toBe("aprobado");
  });
});
