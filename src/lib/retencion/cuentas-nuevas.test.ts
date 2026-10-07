import { describe, expect, it } from "vitest";
import {
  armarCuentaNueva,
  avisoCuentasEnRiesgo,
  esCuentaNueva,
  reunionesAAgendar,
  tableroCuentasNuevas,
  type CuentaNuevaCruda,
} from "./cuentas-nuevas";

const base = (o: Partial<CuentaNuevaCruda> = {}): CuentaNuevaCruda => ({
  id: "c1",
  nombre: "Warrior",
  fechaInicio: "2026-09-23",
  monto: 500000,
  cmId: "cm",
  disenadorId: "d",
  audiovisualId: "e",
  arranque: { hechos: 13, total: 13, atrasados: 0, terminado: true },
  primeraPublicada: "2026-10-01",
  reunionHecha: false,
  reunionAgendada: "2026-10-20",
  facturas: 2,
  mesesSinCobrar: [],
  salud: "bien",
  alertasSalud: [],
  ...o,
});

describe("esCuentaNueva", () => {
  it("los primeros 90 días", () => {
    expect(esCuentaNueva("2026-09-23", "2026-10-06")).toBe(true);
    expect(esCuentaNueva("2026-07-08", "2026-10-06")).toBe(false);
    expect(esCuentaNueva(null, "2026-10-06")).toBe(false);
  });
});

describe("armarCuentaNueva", () => {
  it("todo en orden es ok", () => {
    const c = armarCuentaNueva(base(), "2026-10-06");
    expect(c.estado).toBe("ok");
    expect(c.dia).toBe(14);
    expect(c.mes).toBe(1);
  });

  it("día 21 sin nada publicado es mal", () => {
    const c = armarCuentaNueva(base({ primeraPublicada: null }), "2026-10-13");
    expect(c.chequeos.find((x) => x.clave === "pieza")!.estado).toBe("mal");
    expect(c.estado).toBe("mal");
  });

  it("sin CM es mal; sin edición solo atento", () => {
    expect(armarCuentaNueva(base({ cmId: null }), "2026-10-06").estado).toBe("mal");
    const e = armarCuentaNueva(base({ audiovisualId: null }), "2026-10-06");
    expect(e.estado).toBe("atento");
    expect(e.chequeos.find((x) => x.clave === "equipo")!.detalle).toBe("Falta edición");
  });

  it("cobro por mes: dos meses sin marcar es mal", () => {
    const c = armarCuentaNueva(base({ mesesSinCobrar: ["2026-10", "2026-09"] }), "2026-10-06");
    const x = c.chequeos.find((y) => y.clave === "cobro")!;
    expect(x.estado).toBe("mal");
    expect(x.detalle).toBe("Sin marcar como cobrado: septiembre y octubre");
  });

  it("muestra las ideas sin aprobar cuando no salió nada", () => {
    const c = armarCuentaNueva(base({ primeraPublicada: null, ideasSinAprobar: 16 }), "2026-10-13");
    expect(c.chequeos.find((y) => y.clave === "pieza")!.detalle).toBe("Todavía nada, día 21 · 16 sin aprobar");
  });

  it("mes 2 sin reunión: atento hasta el 10, mal después", () => {
    const b = base({ fechaInicio: "2026-08-20", reunionAgendada: null });
    expect(armarCuentaNueva(b, "2026-10-06").chequeos.find((y) => y.clave === "reunion")!.estado).toBe("atento");
    expect(armarCuentaNueva(b, "2026-10-11").chequeos.find((y) => y.clave === "reunion")!.estado).toBe("mal");
  });

  it("sin plan de arranque pasado el primer mes no se mide", () => {
    const c = armarCuentaNueva(base({ fechaInicio: "2026-07-23", arranque: null }), "2026-10-06");
    expect(c.chequeos.some((y) => y.clave === "arranque")).toBe(false);
  });

  it("una cuenta sin redes no tiene chequeo de pieza ni de equipo", () => {
    const c = armarCuentaNueva(base({ conRedes: false, cmId: null, primeraPublicada: null }), "2026-10-20");
    expect(c.chequeos.map((x) => x.clave)).toEqual(["arranque", "reunion", "cobro"]);
    expect(c.estado).toBe("ok");
  });

  it("una reunión agendada que pasó sin registrarse es mal", () => {
    const c = armarCuentaNueva(base({ reunionAgendada: "2026-10-03" }), "2026-10-06");
    expect(c.chequeos.find((x) => x.clave === "reunion")!.estado).toBe("mal");
    expect(c.chequeos.find((x) => x.clave === "reunion")!.reunionSinRegistrar).toBe("2026-10-03");
  });

  it("no repite la alerta de reunión del semáforo", () => {
    const c = armarCuentaNueva(
      base({ salud: "regular", alertasSalud: ["Falta la reunión mensual de seguimiento", "3 tareas vencidas"] }),
      "2026-10-06"
    );
    expect(c.alertas).toEqual(["3 tareas vencidas"]);
  });
});

describe("tableroCuentasNuevas", () => {
  it("peor primero y deja afuera las viejas", () => {
    const filas = tableroCuentasNuevas(
      [
        base({ id: "a", nombre: "A" }),
        base({ id: "b", nombre: "B", cmId: null }),
        base({ id: "v", nombre: "Vieja", fechaInicio: "2026-05-20" }),
      ],
      "2026-10-06"
    );
    expect(filas.map((f) => f.id)).toEqual(["b", "a"]);
  });
});

describe("reunionesAAgendar", () => {
  it("mes 1: el día 28 de la cuenta, en día hábil", () => {
    const r = reunionesAAgendar([base({ reunionAgendada: null })], "2026-10-06");
    // 23/9 + 27 = 20/10 (martes)
    expect(r).toEqual([
      { clienteId: "c1", titulo: "Reunión de cierre del primer mes — Warrior", fecha: "2026-10-20" },
    ]);
  });

  it("mes 2: el 10, o pasado mañana si ya pasó", () => {
    const r = reunionesAAgendar([base({ fechaInicio: "2026-08-20", reunionAgendada: null })], "2026-10-12");
    expect(r[0].titulo).toBe("Reunión mensual — Warrior");
    expect(r[0].fecha).toBe("2026-10-14");
  });

  it("el sábado pasa al lunes", () => {
    // 10/10/2026 es sábado
    const r = reunionesAAgendar([base({ fechaInicio: "2026-08-20", reunionAgendada: null })], "2026-10-01");
    expect(r[0].fecha).toBe("2026-10-12");
  });

  it("no agenda si ya hay una de este mes o ya se dio", () => {
    expect(reunionesAAgendar([base()], "2026-10-06")).toEqual([]);
    expect(reunionesAAgendar([base({ reunionAgendada: null, reunionHecha: true })], "2026-10-06")).toEqual([]);
  });

  it("una agendada el mes pasado no cuenta para este", () => {
    const r = reunionesAAgendar(
      [base({ fechaInicio: "2026-08-20", reunionAgendada: "2026-09-18" })],
      "2026-10-06"
    );
    expect(r).toHaveLength(1);
  });
});

describe("avisoCuentasEnRiesgo", () => {
  it("solo las cuentas en riesgo y solo lo que está mal", () => {
    const filas = tableroCuentasNuevas(
      [
        base({ id: "a", nombre: "Nazar", fechaInicio: "2026-09-16", primeraPublicada: null, ideasSinAprobar: 16 }),
        base({ id: "b", nombre: "Bien" }),
      ],
      "2026-10-06"
    );
    expect(avisoCuentasEnRiesgo(filas)).toBe(
      "🚦 Cuentas nuevas en riesgo (1): Nazar (día 21) → publicado: todavía nada, día 21 · 16 sin aprobar."
    );
  });

  it("sin cuentas en riesgo no hay aviso", () => {
    expect(avisoCuentasEnRiesgo(tableroCuentasNuevas([base()], "2026-10-06"))).toBeNull();
  });

  it("primero la que tiene más cosas mal", () => {
    const filas = tableroCuentasNuevas(
      [
        base({ id: "n", nombre: "Nueva", fechaInicio: "2026-10-01", cmId: null }),
        base({ id: "v", nombre: "Vieja", fechaInicio: "2026-09-14", cmId: null, primeraPublicada: null }),
      ],
      "2026-10-07"
    );
    expect(avisoCuentasEnRiesgo(filas)!.indexOf("Vieja")).toBeLessThan(avisoCuentasEnRiesgo(filas)!.indexOf("Nueva"));
  });

  it("corta en cuatro", () => {
    const muchas = ["A", "B", "C", "D", "E", "F"].map((n) => base({ id: n, nombre: n, cmId: null }));
    const t = avisoCuentasEnRiesgo(tableroCuentasNuevas(muchas, "2026-10-06"))!;
    expect(t).toContain("(6)");
    expect(t.endsWith("· y 2 más.")).toBe(true);
  });
});
