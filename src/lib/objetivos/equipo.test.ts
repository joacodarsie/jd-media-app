import { describe, expect, it } from "vitest";
import { avance, mesDe, metricasDe, pctCumplido, semanaDe, type DatosObjetivos } from "./equipo";

describe("períodos", () => {
  it("la semana va de lunes a domingo", () => {
    expect(semanaDe("2026-10-05")).toEqual({ desde: "2026-10-05", hasta: "2026-10-12", dias: 5, transcurridos: 1, hoy: "2026-10-05" });
    // El domingo ya pasaron los 5 hábiles.
    expect(semanaDe("2026-10-11")).toMatchObject({ desde: "2026-10-05", hasta: "2026-10-12", dias: 5, transcurridos: 5 });
  });
  it("el mes calendario", () => {
    // Octubre 2026: 22 hábiles; del 1 (jueves) al 5 (lunes) van 3.
    expect(mesDe("2026-10-05")).toEqual({ desde: "2026-10-01", hasta: "2026-11-01", dias: 22, transcurridos: 3, hoy: "2026-10-05" });
  });
});

describe("metricasDe", () => {
  it("cada rol con lo suyo", () => {
    expect(metricasDe({ id: "m", nombre: "Mati", rol: "comercial", area: "Comercial" })).toContain("leads_contactados");
    expect(metricasDe({ id: "b", nombre: "Brisa", rol: "diseno", area: "Diseño" })).toEqual(["piezas_diseno"]);
    expect(metricasDe({ id: "a", nombre: "Ailen", rol: "audiovisual" })).toEqual(["piezas_edicion"]);
    expect(metricasDe({ id: "l", nombre: "Luz", rol: "coordinador", area: "Coordinación" })).toEqual(["reuniones_mensuales"]);
    const santi = metricasDe({
      id: "s",
      nombre: "Santi",
      rol: "coordinador",
      rol_secundario: "comercial",
      area: "Comercial",
      area_secundaria: "Coordinación de Diseño",
    });
    expect(santi).toContain("calendario_aprobado");
    expect(santi).toContain("cierres");
  });
});

const base: DatosObjetivos = {
  contactos: [],
  propuestas: [],
  clientes: [],
  publicaciones: [],
  tareasCerradas: [],
  reunionesMensuales: [],
};

describe("avance", () => {
  const semana = semanaDe("2026-10-07"); // miércoles: van 3 de 5 hábiles
  it("leads de la semana contra la meta, con proyección", () => {
    const d = {
      ...base,
      contactos: [
        ...Array.from({ length: 150 }, () => ({ asignado_a: "mati", contactado_at: "2026-10-06T15:00:00Z", reunion_at: null })),
        { asignado_a: "otro", contactado_at: "2026-10-06T15:00:00Z", reunion_at: null },
        { asignado_a: "mati", contactado_at: "2026-10-02T15:00:00Z", reunion_at: null },
      ],
    };
    const a = avance("leads_contactados", "mati", d, semana, 600);
    expect(a).toEqual({ valor: 150, meta: 600, proyeccion: 250 });
    expect(pctCumplido(a)).toBe(25);
  });

  it("conversión: cierres sobre propuestas del mes", () => {
    const mes = mesDe("2026-10-20");
    const d = {
      ...base,
      propuestas: [
        { creada_por_id: "mati", created_at: "2026-10-02T10:00:00Z" },
        { creada_por_id: "mati", created_at: "2026-10-09T10:00:00Z" },
        { creada_por_id: "mati", created_at: "2026-10-10T10:00:00Z" },
        { creada_por_id: "mati", created_at: "2026-10-11T10:00:00Z" },
      ],
      clientes: [
        { id: "c1", estado: "activo", cm_id: null, disenador_id: null, audiovisual_id: null, cerrado_por_id: "mati", fecha_activado: "2026-10-15T10:00:00Z" },
      ],
    };
    expect(avance("conversion_propuestas", "mati", d, mes, 25).valor).toBe(25);
  });

  it("diseño: la meta sale sola de los posteos y carruseles de sus cuentas", () => {
    const mes = mesDe("2026-10-20");
    const d = {
      ...base,
      clientes: [
        { id: "c1", estado: "activo", cm_id: null, disenador_id: "bri", audiovisual_id: null },
        { id: "c2", estado: "perdido", cm_id: null, disenador_id: "bri", audiovisual_id: null },
      ],
      publicaciones: [
        { cliente_id: "c1", tipo: "carrusel", estado: "idea", fecha_publicacion: "2026-10-10T13:00:00Z" },
        { cliente_id: "c1", tipo: "post", estado: "publicado", fecha_publicacion: "2026-10-03T13:00:00Z" },
        { cliente_id: "c1", tipo: "reel", estado: "idea", fecha_publicacion: "2026-10-10T13:00:00Z" },
        { cliente_id: "c2", tipo: "carrusel", estado: "idea", fecha_publicacion: "2026-10-10T13:00:00Z" },
      ],
      tareasCerradas: [{ asignado_a_id: "bri", area: "Diseño", fecha_completada: "2026-10-02T10:00:00Z" }],
    };
    expect(avance("piezas_diseno", "bri", d, mes, null)).toEqual({ valor: 1, meta: 2, proyeccion: null });
  });

  it("PM: reuniones del mes sobre cuentas activas", () => {
    const mes = mesDe("2026-10-20");
    const d = {
      ...base,
      clientes: [
        { id: "c1", estado: "activo", cm_id: null, disenador_id: null, audiovisual_id: null },
        { id: "c2", estado: "activo", cm_id: null, disenador_id: null, audiovisual_id: null },
        { id: "jd", estado: "activo", es_interno: true, cm_id: null, disenador_id: null, audiovisual_id: null },
      ],
      reunionesMensuales: [
        { cliente_id: "c1", fecha: "2026-10-04" },
        { cliente_id: "c1", fecha: "2026-10-18" },
      ],
    };
    expect(avance("reuniones_mensuales", "luz", d, mes, null)).toEqual({ valor: 1, meta: 2, proyeccion: null });
  });
});

describe("piezas publicadas", () => {
  it("se compara contra lo que ya tenía que salir", () => {
    const mes = mesDe("2026-10-10");
    const d = {
      ...base,
      clientes: [{ id: "c1", estado: "activo", cm_id: "belu", disenador_id: null, audiovisual_id: null }],
      publicaciones: [
        { cliente_id: "c1", tipo: "post", estado: "publicado", fecha_publicacion: "2026-10-03T13:00:00Z" },
        { cliente_id: "c1", tipo: "reel", estado: "en_diseno", fecha_publicacion: "2026-10-08T13:00:00Z" },
        { cliente_id: "c1", tipo: "reel", estado: "idea", fecha_publicacion: "2026-10-25T13:00:00Z" },
      ],
    };
    expect(avance("piezas_publicadas", "belu", d, mes, null)).toEqual({ valor: 1, meta: 2, proyeccion: null });
  });
});
