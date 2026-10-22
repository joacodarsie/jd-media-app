import { describe, expect, it } from "vitest";
import { agruparAvisos, type AvisoTarea } from "./notificaciones-agrupar";

const aviso = (user: string, tipo: string, i: number): AvisoTarea => ({
  user_id: user,
  task_id: `t${i}`,
  tipo,
  mensaje: `Tarea vencida: "Tarea ${i}"`,
  titulo: `Tarea ${i}`,
});

describe("avisos agrupados", () => {
  it("hasta 3 del mismo tipo siguen yendo de a uno, con su tarea", () => {
    const r = agruparAvisos([1, 2, 3].map((i) => aviso("luz", "vencida", i)));
    expect(r).toHaveLength(3);
    expect(r[0].task_id).toBe("t1");
  });

  it("más de 3 van en un solo aviso que lleva a Tareas", () => {
    const r = agruparAvisos([1, 2, 3, 4, 5, 6].map((i) => aviso("luz", "vencida", i)));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ task_id: null, link: "/tareas", tipo: "vencida" });
    expect(r[0].mensaje).toBe("⏰ Tenés 6 tareas vencidas: «Tarea 1», «Tarea 2» y 4 más.");
  });

  it("agrupa por persona y por tipo", () => {
    const avisos = [
      ...[1, 2, 3, 4].map((i) => aviso("luz", "vencida", i)),
      ...[5, 6].map((i) => aviso("luz", "proxima_a_vencer", i)),
      ...[7, 8, 9, 10, 11].map((i) => aviso("santi", "proxima_a_vencer", i)),
    ];
    const r = agruparAvisos(avisos);
    expect(r.filter((a) => a.user_id === "luz")).toHaveLength(3); // 1 resumen + 2 sueltos
    expect(r.filter((a) => a.user_id === "santi")).toHaveLength(1);
    expect(r.find((a) => a.user_id === "santi")?.mensaje).toContain("5 tareas vencen hoy o mañana");
  });
});
