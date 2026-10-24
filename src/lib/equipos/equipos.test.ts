import { describe, expect, it } from "vitest";
import { capacidad, cargaPorPersona, diferencias, equipoSugerido, equiposDePersona, lugares, miembrosDe, type CuentaDeEquipo, type EquipoBase } from "./equipos";

const eq = (id: string, cm: string, dis: string, av: string, extra: string[] = [], tope = 8): EquipoBase => ({
  id,
  nombre: `Equipo ${id}`,
  tope,
  cm_id: cm,
  disenador_id: dis,
  audiovisual_id: av,
  media_buyer_id: "guille",
  extra_ids: extra,
});
const cta = (id: string, team: string | null, cm = "sol", dis = "alejo", av = "ailen"): CuentaDeEquipo => ({
  id,
  nombre: id,
  team_id: team,
  cm_id: cm,
  disenador_id: dis,
  audiovisual_id: av,
  media_buyer_id: "guille",
});

const equipos = [eq("1", "sol", "alejo", "ailen", ["dario"]), eq("4", "sofia", "ana", "carlos"), eq("5", "ana", "dario", "nico")];
const cuentas = [cta("Boxescar", "1"), cta("Impertek", "1", "sol", "dario"), cta("Warrior", "4", "sofia", "ana", "carlos"), cta("Moffa", "5", "ana", "dario", "nico"), cta("Dionisi", null, "luz", "luz", "luz")];

describe("equipos", () => {
  it("los miembros incluyen al segundo integrante", () => {
    expect(miembrosDe(equipos[0])).toEqual(["sol", "alejo", "ailen", "guille", "dario"]);
  });

  it("lugares y el equipo sugerido para la próxima cuenta", () => {
    const l = lugares(equipos, cuentas);
    expect(l.map((x) => [x.nombre, x.cuentas, x.libres])).toEqual([
      ["Equipo 1", 2, 6],
      ["Equipo 4", 1, 7],
      ["Equipo 5", 1, 7],
    ]);
    expect(equipoSugerido(l)?.nombre).toBe("Equipo 4");
    expect(equipoSugerido(l.map((x) => ({ ...x, libres: 0 })))).toBeNull();
  });

  it("capacidad contra la meta: con 6 equipos de 8 y 4 cuentas fuera se llega a 52", () => {
    const l = Array.from({ length: 6 }, (_, i) => ({ id: String(i), nombre: String(i), cuentas: 3, tope: 8, libres: 5 }));
    const c = capacidad(l, 22, 50);
    expect(c).toMatchObject({ enEquipos: 18, capacidad: 48, fueraDeEquipo: 4, maximo: 52, faltanParaMeta: 28, lugaresQueFaltan: 0, equiposQueFaltan: 0 });
    expect(capacidad(l.slice(0, 4), 22, 50)).toMatchObject({ maximo: 42, lugaresQueFaltan: 8, equiposQueFaltan: 1 });
  });

  it("quien está en varios equipos se satura primero", () => {
    const c = cargaPorPersona(equipos, lugares(equipos, cuentas));
    expect(c[0]).toMatchObject({ userId: "guille", conEquiposLlenos: 24, hoy: 4 });
    expect(c.find((x) => x.userId === "ana")).toMatchObject({ equipos: ["Equipo 4", "Equipo 5"], conEquiposLlenos: 16, hoy: 2 });
  });

  it("avisa lo que la cuenta tiene distinto de su equipo, sin contar al segundo integrante", () => {
    const n = (id: string) => id;
    expect(diferencias(cuentas[1], equipos[0], n)).toEqual([]); // Darío es del Equipo 1
    expect(diferencias(cta("X", "4", "belen", "ana", "carlos"), equipos[1], n)).toEqual(["CM: belen no es del equipo (el equipo tiene a sofia)"]);
    expect(diferencias({ ...cta("Y", "4", "sofia", "ana", "carlos"), audiovisual_id: null }, equipos[1], n)).toEqual(["Edición: sin asignar (el equipo tiene a carlos)"]);
    // Una cuenta sin pauta contratada no es una diferencia.
    expect(diferencias({ ...cta("Z", "4", "sofia", "ana", "carlos"), media_buyer_id: null }, equipos[1], n)).toEqual([]);
  });

  it("los equipos de una persona", () => {
    expect(equiposDePersona("ana", equipos).map((e) => e.id)).toEqual(["4", "5"]);
    expect(equiposDePersona("luz", equipos)).toEqual([]);
  });
});
