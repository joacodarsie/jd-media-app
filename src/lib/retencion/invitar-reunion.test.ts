import { describe, expect, it } from "vitest";
import { estadoReunion, linkReunion, mensajeInvitacion, rangoDias, saludo } from "./invitar-reunion";

describe("invitar a la reunión mensual", () => {
  it("el estado: hecha gana a agendada, agendada a invitada", () => {
    expect(estadoReunion({ hecha: true, agendada: "x", invitadaEl: "y" })).toBe("hecha");
    expect(estadoReunion({ hecha: false, agendada: "x", invitadaEl: "y" })).toBe("agendada");
    expect(estadoReunion({ hecha: false, agendada: null, invitadaEl: "y" })).toBe("invitada");
    expect(estadoReunion({ hecha: false, agendada: null, invitadaEl: null })).toBe("sin_invitar");
  });

  it("saluda por el nombre, sin razones sociales ni el nombre de la cuenta", () => {
    expect(saludo("Tamara Daniela Becerra", "Magic")).toBe("¡Hola Tamara!");
    expect(saludo("GIORDANO ADRIAN EMILIO", "Global Business Lab")).toBe("¡Hola Giordano!");
    expect(saludo("Seguimiento Satelital SAS", "Warrior")).toBe("¡Hola!");
    expect(saludo("Catch", "CATCH")).toBe("¡Hola!");
    expect(saludo(null, "Magic")).toBe("¡Hola!");
  });

  it("los días del portal, en palabras", () => {
    expect(rangoDias(["2026-11-02", "2026-11-03", "2026-11-07"])).toBe("del 2 al 7 de noviembre");
    expect(rangoDias(["2026-11-07"])).toBe("el 7 de noviembre");
    expect(rangoDias([])).toBeNull();
  });

  it("el mensaje lleva el mes, la cuenta, los días y el link que abre en la reunión", () => {
    const link = linkReunion("https://jd-media-app.vercel.app/", "abc");
    expect(link).toBe("https://jd-media-app.vercel.app/c/abc#reunion");
    const m = mensajeInvitacion({ contacto: "Alonso Cuevas", cuenta: "Impertek", periodo: "2026-10", link, dias: "del 2 al 7 de noviembre", deParte: "Santiago Reinaldi" });
    expect(m).toContain("¡Hola Alonso!");
    expect(m).toContain("repasar octubre de Impertek");
    expect(m).toContain("(del 2 al 7 de noviembre)");
    expect(m).toContain(link);
    expect(m.endsWith("Santiago — JD Media")).toBe(true);
  });
});
