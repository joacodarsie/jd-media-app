import { describe, expect, it } from "vitest";
import { elegirCandidatas, handlesDelTexto, leerRespuestaIA, tasaDeInteraccion } from "./sugerir";

describe("referencias automáticas", () => {
  it("saca los @ que nombró el cliente, sin mails", () => {
    expect(handlesDelTexto("Me gusta mucho @Placeok y también @cabanas.delsol. Escribime a juan@gmail.com")).toEqual(["placeok", "cabanas.delsol"]);
    expect(handlesDelTexto(null)).toEqual([]);
  });
  it("elige activas, con público y la mejor interacción primero", () => {
    const ahora = Date.parse("2026-10-19T12:00:00Z");
    const reciente = "2026-10-01T12:00:00Z";
    const c = (usuario: string, seguidores: number, likes: number, ts = reciente) => ({
      usuario,
      seguidores,
      media: [{ timestamp: ts, like_count: likes, comments_count: 0 }],
    });
    const r = elegirCandidatas([c("chica", 500, 100), c("muerta", 9000, 900, "2026-01-01T00:00:00Z"), c("buena", 10_000, 800), c("mejor", 5000, 600)], ahora);
    expect(r.map((x) => x.usuario)).toEqual(["mejor", "buena"]);
    expect(tasaDeInteraccion(c("x", 1000, 50))).toBe(0.05);
  });
  it("lee la respuesta de la IA aunque venga con texto alrededor", () => {
    expect(leerRespuestaIA('Acá van: {"cuentas": ["@PlaceOK", "no vale!", "cabanas_sol"]} listo')).toEqual(["placeok", "cabanas_sol"]);
    expect(leerRespuestaIA("nada")).toEqual([]);
  });
});
