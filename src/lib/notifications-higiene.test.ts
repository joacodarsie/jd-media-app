import { describe, it, expect } from "vitest";
import { avisoVencido, cortesDeHigiene } from "./notifications-higiene";

const AHORA = "2026-09-20T12:00:00.000Z";
const haceDias = (d: number) =>
  new Date(Date.parse(AHORA) - d * 86_400_000).toISOString();

describe("avisoVencido", () => {
  it("un aviso de hoy nunca se borra, ni siquiera un recordatorio", () => {
    expect(
      avisoVencido({ tipo: "recordatorio", leida: false, created_at: haceDias(0.5) }, AHORA)
    ).toBe(false);
  });

  it("el recordatorio sin leer de la semana pasada se va: hay uno nuevo de hoy", () => {
    expect(
      avisoVencido({ tipo: "recordatorio", leida: false, created_at: haceDias(8) }, AHORA)
    ).toBe(true);
    for (const tipo of ["vencida", "proxima_a_vencer"]) {
      expect(avisoVencido({ tipo, leida: false, created_at: haceDias(8) }, AHORA)).toBe(true);
    }
  });

  it("el de hace cinco días todavía aguanta", () => {
    expect(
      avisoVencido({ tipo: "vencida", leida: false, created_at: haceDias(5) }, AHORA)
    ).toBe(false);
  });

  it("una asignación sin leer espera un mes, no una semana", () => {
    expect(
      avisoVencido({ tipo: "asignacion", leida: false, created_at: haceDias(8) }, AHORA)
    ).toBe(false);
    expect(
      avisoVencido({ tipo: "asignacion", leida: false, created_at: haceDias(31) }, AHORA)
    ).toBe(true);
  });

  it("una mención también es un hecho", () => {
    expect(
      avisoVencido({ tipo: "mencion", leida: false, created_at: haceDias(20) }, AHORA)
    ).toBe(false);
  });

  it("lo leído vive 60 días, sea del tipo que sea", () => {
    expect(
      avisoVencido({ tipo: "recordatorio", leida: true, created_at: haceDias(30) }, AHORA)
    ).toBe(false);
    expect(
      avisoVencido({ tipo: "asignacion", leida: true, created_at: haceDias(61) }, AHORA)
    ).toBe(true);
  });
});

describe("cortesDeHigiene", () => {
  it("devuelve las tres fechas ordenadas de más vieja a más nueva", () => {
    const c = cortesDeHigiene(new Date(AHORA));
    expect(c.leidosAntesDe < c.hechosAntesDe).toBe(true);
    expect(c.hechosAntesDe < c.regenerablesAntesDe).toBe(true);
    expect(c.tiposRegenerables).toContain("recordatorio");
  });
});
