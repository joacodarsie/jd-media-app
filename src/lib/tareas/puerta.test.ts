import { describe, expect, it } from "vitest";
import {
  avisosDeAprobacionVencida,
  estadoAprobacion,
  motivoParaNoReasignar,
  papelEnTicket,
  pasosDelTicket,
  responsableAlCrear,
  venceAprobacion,
  type TicketParaGuia,
} from "./puerta";

const LUZ = "luz";
const BRISA = "brisa";
const SOL = { id: "sol", rol: "community_manager" };
const JOAQUIN = { id: "joaquin", rol: "admin" };

describe("responsableAlCrear", () => {
  it("un pedido de diseño de una CM le llega a la PM, aunque haya elegido a otro", () => {
    expect(responsableAlCrear({ area: "Diseño", elegido: "dario", actor: SOL, pmId: LUZ })).toBe(LUZ);
  });

  it("la PM reparte directo", () => {
    expect(
      responsableAlCrear({ area: "Diseño", elegido: "dario", actor: { id: LUZ, rol: "coordinador" }, pmId: LUZ })
    ).toBe("dario");
  });

  it("la dirección también puede asignar directo", () => {
    expect(responsableAlCrear({ area: "Edición Audiovisual", elegido: "carlos", actor: JOAQUIN, pmId: LUZ })).toBe(
      "carlos"
    );
  });

  it("las áreas que no son de la PM no se tocan", () => {
    expect(responsableAlCrear({ area: "Paid Media", elegido: "guille", actor: SOL, pmId: LUZ })).toBe("guille");
  });

  it("sin PM cargada se respeta lo elegido", () => {
    expect(responsableAlCrear({ area: "Diseño", elegido: "dario", actor: SOL, pmId: null })).toBe("dario");
  });
});

describe("motivoParaNoReasignar", () => {
  const base = { area: "Community Manager", antes: LUZ, pmId: LUZ, pmNombre: "Luz Torres" };

  it("una CM no puede pasarle un ticket de la PM a otra persona", () => {
    expect(motivoParaNoReasignar({ ...base, despues: "belen", actor: SOL })).toContain("los reparte Luz");
  });

  it("devolvérselo a la PM siempre se puede", () => {
    expect(motivoParaNoReasignar({ ...base, antes: "belen", despues: LUZ, actor: SOL })).toBeNull();
  });

  it("la PM reasigna sin problema", () => {
    expect(motivoParaNoReasignar({ ...base, despues: "belen", actor: { id: LUZ, rol: "coordinador" } })).toBeNull();
  });

  it("si no cambió el responsable no hay nada que frenar", () => {
    expect(motivoParaNoReasignar({ ...base, despues: LUZ, actor: SOL })).toBeNull();
  });
});

describe("venceAprobacion (24 horas hábiles)", () => {
  // Córdoba = UTC-3. 15/9/2026 es martes.
  it("entre semana vence a la misma hora del día siguiente", () => {
    // martes 15/9 10:00 Cba → miércoles 16/9 10:00 Cba
    expect(venceAprobacion("2026-09-15T13:00:00Z").toISOString()).toBe("2026-09-16T13:00:00.000Z");
  });

  it("lo del viernes a las 17 vence el lunes a las 17", () => {
    // viernes 18/9 17:00 Cba = 20:00Z → lunes 21/9 17:00 Cba
    expect(venceAprobacion("2026-09-18T20:00:00Z").toISOString()).toBe("2026-09-21T20:00:00.000Z");
  });

  it("lo que entra el sábado arranca el lunes a las 9 y vence el martes a las 9", () => {
    // sábado 19/9 11:00 Cba → martes 22/9 09:00 Cba = 12:00Z
    expect(venceAprobacion("2026-09-19T14:00:00Z").toISOString()).toBe("2026-09-22T12:00:00.000Z");
  });

  it("el domingo a la noche también arranca el lunes a las 9", () => {
    // domingo 20/9 23:30 Cba = lunes 02:30Z
    expect(venceAprobacion("2026-09-21T02:30:00Z").toISOString()).toBe("2026-09-22T12:00:00.000Z");
  });

  it("el viernes a las 23:59 Cba (sábado en UTC) sigue siendo viernes", () => {
    // viernes 18/9 23:00 Cba = sábado 19/9 02:00Z → lunes 21/9 23:00 Cba
    expect(venceAprobacion("2026-09-19T02:00:00Z").toISOString()).toBe("2026-09-22T02:00:00.000Z");
  });
});

describe("estadoAprobacion", () => {
  it("dentro del plazo dice cuándo vence", () => {
    const e = estadoAprobacion("2026-09-15T13:00:00Z", new Date("2026-09-15T20:00:00Z"));
    expect(e.vencida).toBe(false);
    expect(e.texto).toBe("vence mié 16/9 10:00");
  });

  it("el mismo día dice hoy", () => {
    const e = estadoAprobacion("2026-09-15T13:00:00Z", new Date("2026-09-16T12:00:00Z"));
    expect(e.texto).toBe("vence hoy 10:00");
  });

  it("pasado el plazo dice hace cuánto venció", () => {
    const e = estadoAprobacion("2026-09-15T13:00:00Z", new Date("2026-09-16T18:10:00Z"));
    expect(e.vencida).toBe(true);
    expect(e.texto).toBe("vencida hace 5 h");
  });
});

describe("avisosDeAprobacionVencida", () => {
  const ahora = new Date("2026-09-17T15:00:00Z");
  const nombre = () => "Brisa Tejada";

  it("no avisa lo que sigue en plazo", () => {
    const t = { id: "t1", titulo: "Carrusel", aprobador_id: BRISA, revision_desde: "2026-09-17T12:00:00Z" };
    expect(avisosDeAprobacionVencida([t], { pmId: LUZ, adminIds: ["joaquin"] }, nombre, ahora)).toEqual([]);
  });

  it("vencida: le avisa a la directora, a la PM y a la dirección, una vez a cada una", () => {
    const t = { id: "t1", titulo: "Carrusel", aprobador_id: BRISA, revision_desde: "2026-09-15T12:00:00Z" };
    const avisos = avisosDeAprobacionVencida([t], { pmId: LUZ, adminIds: ["joaquin", LUZ] }, nombre, ahora);
    expect(avisos.map((a) => a.userId)).toEqual([BRISA, LUZ, "joaquin"]);
    expect(avisos[1].mensaje).toContain("Brisa tiene \"Carrusel\"");
    expect(avisos[0].link).toBe("/tareas/t1");
  });
});

describe("qué te toca", () => {
  const pieza = (cambios: Partial<TicketParaGuia> = {}): TicketParaGuia => ({
    area: "Diseño",
    estado: "pendiente",
    asignado_a_id: "dario",
    creado_por_id: "sol",
    aprobador_id: null,
    parent_id: "ticket",
    ...cambios,
  });
  const nombres = { pm: "Luz", directora: "Brisa" };

  it("a la directora le toca aprobar cuando la pieza está en revisión", () => {
    const t = pieza({ estado: "en_revision", aprobador_id: BRISA });
    expect(papelEnTicket(t, BRISA, LUZ, BRISA)).toBe("directora");
    expect(pasosDelTicket(t, "directora", nombres)!.titulo).toBe("Te toca aprobar");
  });

  it("a la PM le toca repartir lo que le llegó", () => {
    const t = pieza({ asignado_a_id: LUZ });
    expect(papelEnTicket(t, LUZ, LUZ, BRISA)).toBe("pm");
  });

  it("quien diseña ve que tiene que mandar a revisión, no cerrar", () => {
    const t = pieza({ estado: "en_progreso" });
    const guia = pasosDelTicket(t, papelEnTicket(t, "dario", LUZ, BRISA), nombres)!;
    expect(guia.titulo).toBe("Te toca producir");
    expect(guia.pasos[0].hecho).toBe(true);
    expect(guia.pasos[1].actual).toBe(true);
    expect(guia.pasos.some((p) => p.texto.includes("le llega a Brisa"))).toBe(true);
  });

  it("alguien que solo mira no recibe guía", () => {
    expect(papelEnTicket(pieza(), "guille", LUZ, BRISA)).toBe("otro");
    expect(pasosDelTicket(pieza(), "otro", nombres)).toBeNull();
  });
});
