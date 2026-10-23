import { describe, expect, it } from "vitest";
import { avisoCongeladas, mensajeAvisoPersona, piezasCongeladas, porResponsable, type PiezaParaCongelar } from "./congeladas";

const pieza = (p: Partial<PiezaParaCongelar>): PiezaParaCongelar => ({
  taskId: "t",
  titulo: "Reel",
  cuenta: "CATCH",
  fecha: "2026-10-23",
  responsableId: "carlos",
  responsable: "Carlos David Perlo",
  ultimoMovimiento: "2026-10-04T12:00:00Z",
  bloqueada: false,
  ...p,
});

describe("piezas congeladas", () => {
  const hoy = "2026-10-22";

  it("5 días o más sin moverse y con la fecha cerca o pasada", () => {
    const r = piezasCongeladas(
      [
        pieza({ taskId: "a" }), // 18 días quieta, sale mañana
        pieza({ taskId: "b", ultimoMovimiento: "2026-10-19T12:00:00Z" }), // 3 días: no
        pieza({ taskId: "c", fecha: "2026-11-15" }), // sale en 24 días: no
        pieza({ taskId: "d", fecha: "2026-10-10" }), // atrasada
        pieza({ taskId: "e", bloqueada: true }), // ya avisó qué falta: no
      ],
      hoy
    );
    expect(r.map((p) => p.taskId)).toEqual(["a", "d"]);
    expect(r[0].diasQuieta).toBe(18);
    expect(r.find((p) => p.taskId === "d")?.atrasada).toBe(true);
  });

  it("agrupa por persona y arma un solo aviso", () => {
    const c = piezasCongeladas(
      [
        pieza({ taskId: "1" }),
        pieza({ taskId: "2", cuenta: "Magic" }),
        pieza({ taskId: "3", responsableId: "belen", responsable: "Belén Gastardelli" }),
      ],
      hoy
    );
    const g = porResponsable(c);
    expect(g[0]).toMatchObject({ responsable: "Carlos David Perlo", maxDias: 18 });
    expect(g[0].piezas).toHaveLength(2);
    expect(avisoCongeladas(g)).toBe("🧊 3 piezas sin moverse hace 5 días o más: Carlos 2, Belén 1.");
    expect(avisoCongeladas([])).toBeNull();
    expect(mensajeAvisoPersona("Luz Torres", g[0])).toContain("Luz te pregunta por 2 piezas");
  });
});
