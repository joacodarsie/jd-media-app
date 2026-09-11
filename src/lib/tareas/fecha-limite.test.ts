import { describe, expect, it } from "vitest";
import {
  DIAS_POR_DEFECTO,
  diasSinFecha,
  fechaParaTareaDeIA,
  ordenarParaTriage,
  validarFechaLimite,
} from "./fecha-limite";

describe("validarFechaLimite", () => {
  it("acepta una fecha bien formada", () => {
    expect(validarFechaLimite("2026-09-30")).toEqual({ ok: true, fecha: "2026-09-30" });
  });

  it("recorta los espacios", () => {
    expect(validarFechaLimite("  2026-09-30 ")).toEqual({ ok: true, fecha: "2026-09-30" });
  });

  it("rechaza que no haya fecha", () => {
    for (const v of ["", "   ", null, undefined]) {
      const r = validarFechaLimite(v);
      expect(r.ok, `con ${JSON.stringify(v)}`).toBe(false);
      expect(r.error).toMatch(/fecha límite/i);
    }
  });

  it("rechaza lo que no tiene forma de fecha", () => {
    expect(validarFechaLimite("30/09/2026").ok).toBe(false);
    expect(validarFechaLimite("pronto").ok).toBe(false);
  });

  it("rechaza un día que no existe aunque tenga el formato", () => {
    // 2026 no es bisiesto y septiembre tiene 30.
    expect(validarFechaLimite("2026-02-30").ok).toBe(false);
    expect(validarFechaLimite("2026-13-01").ok).toBe(false);
    expect(validarFechaLimite("2026-09-31").ok).toBe(false);
  });

  it("deja pasar una fecha vieja: corregir el pasado es válido", () => {
    // Poner fecha a algo que ya debía estar hecho es exactamente el caso de uso
    // del triage; si lo rechazáramos, esas tareas seguirían sin fecha.
    expect(validarFechaLimite("2026-07-08").ok).toBe(true);
  });
});

describe("fechaParaTareaDeIA", () => {
  it("respeta la fecha que puso el modelo", () => {
    expect(fechaParaTareaDeIA("2026-09-20", "2026-09-11")).toBe("2026-09-20");
  });

  it("si el modelo no puso fecha, le da una semana", () => {
    expect(fechaParaTareaDeIA(null, "2026-09-11")).toBe("2026-09-18");
    expect(fechaParaTareaDeIA("", "2026-09-11")).toBe("2026-09-18");
    expect(DIAS_POR_DEFECTO).toBe(7);
  });

  it("con una fecha inválida tampoco deja la tarea sin fecha", () => {
    expect(fechaParaTareaDeIA("la semana que viene", "2026-09-11")).toBe("2026-09-18");
  });

  it("cruza bien el fin de mes", () => {
    expect(fechaParaTareaDeIA(null, "2026-09-28")).toBe("2026-10-05");
    expect(fechaParaTareaDeIA(null, "2026-12-29")).toBe("2027-01-05");
  });

  it("tolera que le pasen un timestamp completo", () => {
    expect(fechaParaTareaDeIA(null, "2026-09-11T22:30:00.000Z")).toBe("2026-09-18");
  });
});

describe("ordenarParaTriage", () => {
  const t = (id: string, created_at: string, asignado_a_id: string | null = "u1") => ({
    id,
    titulo: id,
    created_at,
    cliente_id: null,
    asignado_a_id,
  });

  it("pone primero lo más viejo", () => {
    const r = ordenarParaTriage([
      t("nueva", "2026-09-01T00:00:00Z"),
      t("vieja", "2026-06-04T00:00:00Z"),
      t("media", "2026-07-08T00:00:00Z"),
    ]);
    expect(r.map((x) => x.id)).toEqual(["vieja", "media", "nueva"]);
  });

  it("a igual antigüedad, primero lo que no tiene dueño", () => {
    const r = ordenarParaTriage([
      t("conDueño", "2026-07-08T00:00:00Z", "u1"),
      t("sinDueño", "2026-07-08T00:00:00Z", null),
    ]);
    expect(r.map((x) => x.id)).toEqual(["sinDueño", "conDueño"]);
  });

  it("no toca el array original", () => {
    const orig = [t("b", "2026-09-01T00:00:00Z"), t("a", "2026-06-01T00:00:00Z")];
    ordenarParaTriage(orig);
    expect(orig.map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("diasSinFecha", () => {
  it("cuenta por día calendario", () => {
    expect(diasSinFecha("2026-07-08T05:00:00Z", "2026-09-11T22:00:00Z")).toBe(65);
  });

  it("una tarea de hoy da 0, nunca negativo", () => {
    expect(diasSinFecha("2026-09-11T01:00:00Z", "2026-09-11T23:00:00Z")).toBe(0);
    expect(diasSinFecha("2026-09-20T00:00:00Z", "2026-09-11T00:00:00Z")).toBe(0);
  });
});
