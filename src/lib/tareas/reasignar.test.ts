import { describe, it, expect } from "vitest";
import { calcularReasignaciones, agruparPorPersona } from "./reasignar";

const ACTIVAS = new Set(["ana", "carlos", "mile", "dario"]);
const EQUIPO = { disenador_id: "ana", cm_id: "mile", audiovisual_id: "carlos", media_buyer_id: null };

describe("calcularReasignaciones", () => {
  it("mueve la tarea al responsable actual del área", () => {
    const r = calcularReasignaciones([{ id: "t1", area: "Diseño", asignado_a_id: "dario" }], EQUIPO, ACTIVAS);
    expect(r).toEqual([{ id: "t1", asignado_a_id: "ana", anterior: "dario" }]);
  });

  it("le pone dueño a la tarea que no tenía", () => {
    const r = calcularReasignaciones([{ id: "t1", area: "Community Manager", asignado_a_id: null }], EQUIPO, ACTIVAS);
    expect(r[0]).toMatchObject({ asignado_a_id: "mile", anterior: null });
  });

  it("no toca la que ya está bien", () => {
    expect(calcularReasignaciones([{ id: "t1", area: "Diseño", asignado_a_id: "ana" }], EQUIPO, ACTIVAS)).toEqual([]);
  });

  it("no toca la tarea de un área sin responsable cargado", () => {
    expect(calcularReasignaciones([{ id: "t1", area: "Paid Media", asignado_a_id: "dario" }], EQUIPO, ACTIVAS)).toEqual([]);
  });

  it("no le manda trabajo a alguien que ya no está en la agencia", () => {
    const equipo = { ...EQUIPO, disenador_id: "exempleado" };
    expect(calcularReasignaciones([{ id: "t1", area: "Diseño", asignado_a_id: "dario" }], equipo, ACTIVAS)).toEqual([]);
  });

  it("ignora áreas que no son de la cuenta", () => {
    expect(calcularReasignaciones([{ id: "t1", area: "Comercial", asignado_a_id: "dario" }], EQUIPO, ACTIVAS)).toEqual([]);
    expect(calcularReasignaciones([{ id: "t1", area: null, asignado_a_id: "dario" }], EQUIPO, ACTIVAS)).toEqual([]);
  });

  it("agrupa por destinatario para aplicar y avisar de una", () => {
    const rs = calcularReasignaciones(
      [
        { id: "t1", area: "Diseño", asignado_a_id: "dario" },
        { id: "t2", area: "Diseño", asignado_a_id: null },
        { id: "t3", area: "Community Manager", asignado_a_id: "dario" },
      ],
      EQUIPO,
      ACTIVAS,
    );
    const g = agruparPorPersona(rs);
    expect(g.get("ana")).toEqual(["t1", "t2"]);
    expect(g.get("mile")).toEqual(["t3"]);
  });
});
