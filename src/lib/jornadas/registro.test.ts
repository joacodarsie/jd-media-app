import { describe, expect, it } from "vitest";
import { avisoCompletar } from "./aviso-run";
import { avisoJornadaLista, estadoJornada, repartoJornada, resumenJornadas, type JornadaRegistro } from "./registro";

const j = (extra: Partial<JornadaRegistro> = {}): JornadaRegistro => ({
  id: "j1",
  fecha: "2026-10-20",
  horaInicio: "10:00",
  horas: 2,
  monto: 105000, // $70.000 + 1 hora extra de $35.000
  viaticos: 30000,
  viaticosDetalle: { carlos: 20000, belen: 10000 },
  viaticosLosPaga: "cliente",
  asistentes: ["carlos", "belen"],
  cobrado: null,
  cobradoAt: null,
  pagos: {},
  confirmadaAt: "2026-10-21T10:00:00Z",
  ...extra,
});

describe("registro de jornadas", () => {
  it("cada uno cobra su parte del trabajo más SUS viáticos", () => {
    const r = repartoJornada(j());
    expect(r.partes).toEqual([
      { userId: "carlos", rol: "dirige", trabajo: 52500, viaticos: 20000, total: 72500, pagado: 0, debe: 72500 },
      { userId: "belen", rol: "acompaña", trabajo: 31500, viaticos: 10000, total: 41500, pagado: 0, debe: 41500 },
    ]);
    // Al cliente: el trabajo más los viáticos, que los paga él.
    expect(r.aCobrar).toBe(135000);
    expect(r.agencia).toBe(21000);
  });

  it("las jornadas viejas sin detalle reparten los viáticos en partes iguales", () => {
    const r = repartoJornada(j({ viaticosDetalle: {} }));
    expect(r.partes.map((p) => p.viaticos)).toEqual([15000, 15000]);
  });

  it("el estado avanza: agendada → completar → cobrar → pagar → cerrada", () => {
    const hoy = "2026-10-23";
    expect(estadoJornada(j({ fecha: "2026-10-25", confirmadaAt: null }), hoy)).toBe("agendada");
    expect(estadoJornada(j({ confirmadaAt: null }), hoy)).toBe("completar");
    expect(estadoJornada(j(), hoy)).toBe("cobrar");
    expect(estadoJornada(j({ cobrado: 135000 }), hoy)).toBe("pagar");
    expect(estadoJornada(j({ cobrado: 135000, pagos: { carlos: { monto: 72500, fecha: hoy }, belen: { monto: 41500, fecha: hoy } } }), hoy)).toBe("cerrada");
  });

  it("un pago parcial deja la diferencia como deuda", () => {
    const r = repartoJornada(j({ pagos: { carlos: { monto: 50000, fecha: "2026-10-23" } } }));
    expect(r.partes[0]).toMatchObject({ pagado: 50000, debe: 22500 });
    expect(r.faltaPagar).toBe(22500 + 41500);
  });

  it("el resumen suma lo que falta y no cuenta las que todavía no se completaron", () => {
    const res = resumenJornadas([j(), j({ id: "j2", confirmadaAt: null }), j({ id: "j3", cobrado: 135000, pagos: { carlos: { monto: 72500, fecha: "x" } } })], "2026-10-23");
    expect(res.faltaCobrar).toBe(135000);
    expect(res.completar).toBe(1);
    expect(res.debePorPersona.get("carlos")).toBe(72500);
    expect(res.debePorPersona.get("belen")).toBe(83000);
  });

  it("el aviso al dueño dice cuánto cobrar y cuánto pagarle a cada uno", () => {
    const fmt = (n: number) => `$${n.toLocaleString("es-AR")}`;
    expect(avisoJornadaLista("Dalhan", j(), (id) => (id === "carlos" ? "Carlos" : "Belén"), fmt)).toBe(
      "🎬 Jornada de Dalhan lista: cobrar $135.000 · pagar a Carlos $72.500, Belén $41.500."
    );
  });
});

describe("aviso a la PM", () => {
  it("una jornada o varias, con cliente y fecha", () => {
    expect(avisoCompletar([])).toBeNull();
    expect(avisoCompletar([{ cliente: "Dalhan", fecha: "2026-10-22" }])).toContain("Completá la jornada de Dalhan (22/10)");
    const m = avisoCompletar(["A", "B", "C", "D"].map((c) => ({ cliente: c, fecha: "2026-10-01" })));
    expect(m).toContain("4 jornadas para completar: A (01/10), B (01/10), C (01/10) y 1 más");
  });
});
