import { describe, expect, it } from "vitest";
import { claveRojo, tareaRojo } from "./cuentas-rojo";

describe("cuentas en rojo", () => {
  it("una tarea por cuenta y por mes, con los motivos", () => {
    expect(claveRojo("abc", "2026-10")).toBe("rojo:abc:2026-10");
    const t = tareaRojo("Magic", ["3 tareas vencidas", "Falta la reunión mensual de seguimiento"]);
    expect(t.titulo).toBe("🚦 Magic está en rojo");
    expect(t.descripcion).toContain("- 3 tareas vencidas\n- Falta la reunión mensual");
    expect(t.descripcion).toContain("**Está hecho cuando:**");
  });
});
