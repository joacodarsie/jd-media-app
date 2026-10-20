import { describe, expect, it } from "vitest";
import { cuentaParaPm, esPregunta, ordenarPm, resumenPm, textoPregunta, tipoPregunta } from "./tablero";
import type { ArranqueEnCurso, PasoDelArranque } from "@/lib/retencion/onboarding-panorama";
import type { CuentaNueva } from "@/lib/retencion/cuentas-nuevas";

const paso = (o: Partial<PasoDelArranque>): PasoDelArranque => ({
  id: o.id ?? Math.random().toString(36).slice(2),
  numero: 1,
  titulo: "Paso",
  estado: "pendiente",
  area: "Coordinación",
  fecha_limite: "2026-10-20",
  asignado_nombre: "Sofía",
  asignado_a_id: "u1",
  dia: 3,
  hecho: false,
  atrasado: false,
  ...o,
});

const cuenta = (o: Partial<CuentaNueva> = {}): CuentaNueva => ({
  id: "c1",
  nombre: "Dalhan",
  fechaInicio: "2026-10-01",
  dia: 20,
  mes: 1,
  estado: "atento",
  chequeos: [
    { clave: "arranque", label: "Arranque", estado: "mal", detalle: "x" },
    { clave: "pieza", label: "Primera pieza", estado: "ok", detalle: "El 16/10" },
  ],
  alertas: [],
  ...o,
});

const arranque = (pasos: PasoDelArranque[]): ArranqueEnCurso => ({
  ticketId: "t",
  numero: 1,
  clienteId: "c1",
  clienteNombre: "Dalhan",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-15",
  diaActual: 20,
  pct: 0.5,
  hechos: pasos.filter((p) => p.hecho).length,
  total: pasos.length,
  atrasados: pasos.filter((p) => p.atrasado).length,
  vencido: true,
  terminado: false,
  pasos,
});

describe("preguntas del arranque", () => {
  it("reconoce y tipifica los hitos", () => {
    expect(esPregunta("Día 5: ¿ya hay contenido?")).toBe(true);
    expect(esPregunta("Kit de marca")).toBe(false);
    expect(tipoPregunta("Día 7: ¿llegó el material?")).toBe("material");
    expect(tipoPregunta("Día 5: ¿ya hay contenido?")).toBe("material");
    expect(tipoPregunta("¿Hace falta jornada de producción?")).toBe("jornada");
    expect(tipoPregunta("¿El cliente abrió el portal?")).toBe("general");
    expect(textoPregunta("Día 7: ¿llegó el material?")).toBe("¿Llegó el material?");
  });
});

describe("cuentaParaPm", () => {
  it("separa preguntas del día, atrasados, pausados y lo que viene", () => {
    const pasos = [
      paso({ id: "q", titulo: "Día 5: ¿ya hay contenido?", fecha_limite: "2026-10-06", atrasado: true }),
      paso({ id: "q-futura", titulo: "¿Hace falta jornada de producción?", fecha_limite: "2026-10-25" }),
      paso({ id: "a", titulo: "Kit de marca", fecha_limite: "2026-10-10", atrasado: true }),
      paso({ id: "p", titulo: "Videos de los 15 días", fecha_limite: "2026-10-12", atrasado: true, bloqueo: "cliente", bloqueo_detalle: "los videos del local" }),
      paso({ id: "n1", titulo: "Entrega del arranque", fecha_limite: "2026-10-24" }),
      paso({ id: "h", titulo: "Hecho", hecho: true, estado: "completada" }),
    ];
    const r = cuentaParaPm(cuenta(), arranque(pasos), "2026-10-20");
    expect(r.preguntas.map((p) => [p.id, p.pregunta, p.tipo])).toEqual([["q", "¿Ya hay contenido?", "material"]]);
    expect(r.atrasados.map((p) => p.id)).toEqual(["a"]);
    expect(r.pausados.map((p) => [p.id, p.detallePausa])).toEqual([["p", "los videos del local"]]);
    expect(r.proximos.map((p) => p.id)).toEqual(["n1"]);
    expect(r.pendientesHoy).toBe(2);
    // El arranque ya no se repite como chequeo: está en la barra.
    expect(r.chequeos.map((c) => c.clave)).toEqual(["pieza"]);
  });

  it("una cuenta sin arranque no rompe", () => {
    const r = cuentaParaPm(cuenta(), null, "2026-10-20");
    expect(r.arranque).toBeNull();
    expect(r.pendientesHoy).toBe(0);
  });

  it("orden: primero lo que hay para hacer hoy, después el riesgo", () => {
    const tranquila = cuentaParaPm(cuenta({ id: "a", estado: "mal" }), null, "2026-10-20");
    const conTrabajo = cuentaParaPm(cuenta({ id: "b", estado: "ok" }), arranque([paso({ atrasado: true, titulo: "Kit" })]), "2026-10-20");
    expect(ordenarPm([tranquila, conTrabajo]).map((c) => c.id)).toEqual(["b", "a"]);
    expect(resumenPm([tranquila, conTrabajo])).toMatchObject({ cuentas: 2, atrasados: 1, enRiesgo: 1 });
  });
});
