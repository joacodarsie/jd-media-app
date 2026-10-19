import { describe, expect, it } from "vitest";
import { agruparNotificaciones } from "./notificaciones-grupos";

const n = (id: string, mensaje: string, created_at: string, extra: Partial<{ tipo: string; task_id: string | null; leida: boolean }> = {}) => ({
  id, mensaje, created_at, tipo: "recordatorio", task_id: null, leida: false, ...extra,
});

describe("agruparNotificaciones", () => {
  it("junta el mismo aviso aunque cambien los números y muestra el más nuevo", () => {
    const g = agruparNotificaciones([
      n("a", "💰 Finanzas: 9 cobros atrasados por $2.809.355", "2026-10-15T10:00:00Z"),
      n("b", "💰 Finanzas: 11 cobros atrasados por $3.100.000", "2026-10-18T10:00:00Z", { leida: true }),
      n("c", "Luz agendó una reunión", "2026-10-17T10:00:00Z"),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0].principal.id).toBe("b");
    expect(g[0].ids).toEqual(["b", "a"]);
    expect(g[0].veces).toBe(2);
    expect(g[0].sinLeer).toBe(1);
  });

  it("no junta avisos de tareas distintas ni de tipos distintos", () => {
    const g = agruparNotificaciones([
      n("a", "Te asignaron una tarea", "2026-10-18T10:00:00Z", { tipo: "asignacion", task_id: "t1" }),
      n("b", "Te asignaron una tarea", "2026-10-18T11:00:00Z", { tipo: "asignacion", task_id: "t2" }),
      n("c", "Te asignaron una tarea", "2026-10-18T12:00:00Z", { tipo: "vencida", task_id: "t2" }),
    ]);
    expect(g).toHaveLength(3);
  });
});
