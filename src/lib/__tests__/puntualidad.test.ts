/**
 * Tests de la puntualidad de contenido. Calibrado contra los datos reales de
 * julio 2026: Lubricentro (0 de 16 publicadas) tiene que dar rojo y Desafío
 * Ansenuza (11 de 11) verde, sin que una cuenta recién arrancada quede en rojo
 * por tener dos piezas pendientes.
 */
import { describe, it, expect } from "vitest";
import {
  clasificarPieza,
  computePuntualidadCuenta,
  computePuntualidad,
  scorePuntualidad,
} from "../contenidos/puntualidad";

const HOY = "2026-07-29";
const pub = (estado: string, fecha: string | null) => ({
  cliente_id: "c1",
  estado,
  fecha_publicacion: fecha,
});

describe("clasificarPieza", () => {
  it("publicada gana aunque la fecha haya pasado", () => {
    expect(clasificarPieza(pub("publicado", "2026-07-01"), HOY)).toBe("publicada");
  });
  it("idea con fecha pasada = nunca arrancó", () => {
    expect(clasificarPieza(pub("idea", "2026-07-10"), HOY)).toBe("nunca_arranco");
  });
  it("en revisión NUESTRA con fecha pasada = trabada", () => {
    expect(clasificarPieza(pub("revision_creativa", "2026-07-10"), HOY)).toBe("trabada");
    expect(clasificarPieza(pub("edicion", "2026-07-10"), HOY)).toBe("trabada");
  });
  it("esperando la aprobación del cliente NO es atraso nuestro", () => {
    expect(clasificarPieza(pub("revision_cliente", "2026-07-10"), HOY)).toBe(
      "esperando_cliente"
    );
  });
  it("marcada a mano como frenada por el cliente gana sobre el estado", () => {
    expect(
      clasificarPieza({ ...pub("idea", "2026-07-10"), frenado_cliente: true }, HOY)
    ).toBe("esperando_cliente");
  });
  it("una pieza frenada pero ya publicada sigue siendo publicada", () => {
    expect(
      clasificarPieza({ ...pub("publicado", "2026-07-10"), frenado_cliente: true }, HOY)
    ).toBe("publicada");
  });
  it("con fecha de hoy o futura todavía no está atrasada", () => {
    expect(clasificarPieza(pub("idea", HOY), HOY)).toBe("pendiente_futura");
    expect(clasificarPieza(pub("idea", "2026-08-05"), HOY)).toBe("pendiente_futura");
  });
  it("sin fecha no se juzga", () => {
    expect(clasificarPieza(pub("idea", null), HOY)).toBe("sin_fecha");
  });
});

describe("computePuntualidadCuenta", () => {
  it("caso Lubricentro: nada publicado y 13 vencidas → mal", () => {
    const pubs = [
      ...Array.from({ length: 13 }, () => pub("idea", "2026-07-10")),
      ...Array.from({ length: 3 }, () => pub("idea", "2026-08-02")),
    ];
    const r = computePuntualidadCuenta("c1", pubs, HOY);
    expect(r.publicadas).toBe(0);
    expect(r.nuncaArrancaron).toBe(13);
    expect(r.porVenir).toBe(3);
    expect(r.ejecucionPct).toBe(0);
    expect(r.semaforo).toBe("mal");
    expect(scorePuntualidad(r)).toBe(2);
  });

  it("caso Ansenuza: todo publicado → bien y no suma riesgo", () => {
    const r = computePuntualidadCuenta(
      "c1",
      Array.from({ length: 11 }, () => pub("publicado", "2026-07-05")),
      HOY
    );
    expect(r.ejecucionPct).toBe(100);
    expect(r.semaforo).toBe("bien");
    expect(scorePuntualidad(r)).toBe(0);
    expect(r.alertas).toHaveLength(0);
  });

  it("caso La Azotea: 4 de 12 → mal, separando las trabadas de las que no arrancaron", () => {
    const pubs = [
      ...Array.from({ length: 4 }, () => pub("publicado", "2026-07-05")),
      ...Array.from({ length: 5 }, () => pub("idea", "2026-07-08")),
      ...Array.from({ length: 3 }, () => pub("revision_creativa", "2026-07-08")),
    ];
    const r = computePuntualidadCuenta("c1", pubs, HOY);
    expect(r.ejecucionPct).toBe(33);
    expect(r.semaforo).toBe("mal");
    expect(r.alertas.some((a) => a.includes("sin producir"))).toBe(true);
    expect(r.alertas.some((a) => a.includes("trabada"))).toBe(true);
  });

  it("entre 50 y 80 queda en regular", () => {
    const pubs = [
      ...Array.from({ length: 7 }, () => pub("publicado", "2026-07-05")),
      ...Array.from({ length: 3 }, () => pub("idea", "2026-07-08")),
    ];
    expect(computePuntualidadCuenta("c1", pubs, HOY).semaforo).toBe("regular");
  });

  it("con menos de 3 piezas vencidas no se opina en rojo", () => {
    const pubs = [pub("idea", "2026-07-28"), pub("publicado", "2026-08-10")];
    const r = computePuntualidadCuenta("c1", pubs, HOY);
    expect(r.ejecucionPct).toBeNull();
    expect(r.semaforo).toBe("regular"); // hay un atraso, pero no es rojo
  });

  it("lo que espera al cliente no baja el % ni pinta de rojo al equipo", () => {
    const pubs = [
      ...Array.from({ length: 4 }, () => pub("publicado", "2026-07-05")),
      // 6 frenadas por el cliente: sin esto, el equipo quedaba en 40% (rojo).
      ...Array.from({ length: 6 }, () => ({
        ...pub("idea", "2026-07-08"),
        frenado_cliente: true,
      })),
    ];
    const r = computePuntualidadCuenta("c1", pubs, HOY);
    expect(r.esperandoCliente).toBe(6);
    expect(r.nuncaArrancaron).toBe(0);
    expect(r.ejecucionPct).toBe(100);
    expect(r.semaforo).toBe("bien");
    expect(scorePuntualidad(r)).toBe(0);
    // Igual hay que reclamarlo: aparece como alerta, no se esconde.
    expect(r.alertas.some((a) => a.includes("esperando al cliente"))).toBe(true);
  });

  it("cuenta pausada por el cliente: no se le mide atraso", () => {
    const pubs = Array.from({ length: 10 }, () => pub("idea", "2026-07-08"));
    const r = computePuntualidadCuenta("c1", pubs, HOY, true);
    expect(r.semaforo).toBe("pausada");
    expect(scorePuntualidad(r)).toBe(0);
    expect(r.alertas[0]).toContain("pausada");
  });

  it("cuenta activa sin calendario del mes: avisa y pesa como atraso grave", () => {
    const r = computePuntualidadCuenta("c1", [], HOY);
    expect(r.semaforo).toBe("sin_datos");
    expect(r.alertas[0]).toContain("No tiene calendario cargado");
    expect(scorePuntualidad(r)).toBe(2);
  });
});

describe("computePuntualidad (varias cuentas)", () => {
  it("incluye a las cuentas que no tienen ninguna pieza", () => {
    const m = computePuntualidad(
      ["c1", "c2"],
      [{ cliente_id: "c1", estado: "publicado", fecha_publicacion: "2026-07-01" }],
      HOY
    );
    expect(m.get("c1")?.publicadas).toBe(1);
    expect(m.get("c2")?.planificadas).toBe(0);
  });

  it("ignora piezas de clientes que no se pidieron", () => {
    const m = computePuntualidad(
      ["c1"],
      [{ cliente_id: "otro", estado: "publicado", fecha_publicacion: "2026-07-01" }],
      HOY
    );
    expect(m.get("c1")?.planificadas).toBe(0);
    expect(m.size).toBe(1);
  });
});
