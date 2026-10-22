import { describe, expect, it } from "vitest";
import { avance, mesDe, metricasDe, objetivosDePersona, pctCumplido, semaforoObjetivo, semanaDe, type DatosObjetivos } from "./equipo";

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
    expect(metricasDe({ id: "l", nombre: "Luz", rol: "coordinador", area: "Coordinación" })).toEqual(["reuniones_mensuales", "tareas_a_tiempo", "cambios_de_fecha", "piezas_al_dia"]);
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

describe("objetivos de coordinación y dirección (21/10/2026)", () => {
  const mes = mesDe("2026-10-21");
  const clientes = [
    { id: "a", estado: "activo", cm_id: null, disenador_id: null, audiovisual_id: null, responsable_id: "santi" },
    { id: "b", estado: "activo", cm_id: null, disenador_id: null, audiovisual_id: null, responsable_id: "otro" },
    { id: "x", estado: "perdido", cm_id: null, disenador_id: null, audiovisual_id: null, fecha_inactivado: "2026-10-13" },
  ];

  it("aprobación creativa: % de diseño y edición cerrado que pasó por revisión", () => {
    const d = {
      ...base,
      clientes,
      tareasCerradas: [
        { id: "t1", asignado_a_id: "x", area: "Diseño", fecha_completada: "2026-10-05T10:00:00Z" },
        { id: "t2", asignado_a_id: "x", area: "Edición Audiovisual", fecha_completada: "2026-10-06T10:00:00Z" },
        { id: "t3", asignado_a_id: "x", area: "Coordinación", fecha_completada: "2026-10-06T10:00:00Z" },
      ],
      revisadas: ["t1", "t3"],
    };
    expect(avance("aprobacion_creativa", "santi", d, mes, null)).toMatchObject({ valor: 50, meta: 100 });
  });

  it("tareas a tiempo y cambios de fecha (menos es mejor)", () => {
    const d = {
      ...base,
      tareasCerradas: [
        { asignado_a_id: "x", area: "Diseño", fecha_completada: "2026-10-10T12:00:00Z", fecha_limite: "2026-10-10" },
        { asignado_a_id: "x", area: "Diseño", fecha_completada: "2026-10-12T12:00:00Z", fecha_limite: "2026-10-10" },
      ],
      cambiosFecha: [{ fecha: "2026-10-02T10:00:00Z" }, { fecha: "2026-10-20T10:00:00Z" }, { fecha: "2026-09-30T10:00:00Z" }],
    };
    expect(avance("tareas_a_tiempo", "luz", d, mes, null).valor).toBe(50);
    expect(avance("cambios_de_fecha", "luz", d, mes, 60).valor).toBe(2);
  });

  it("reuniones de SUS cuentas, bajas del mes y cuentas activas", () => {
    const d = { ...base, clientes, reunionesMensuales: [{ cliente_id: "a", fecha: "2026-10-08" }] };
    expect(avance("reuniones_mis_cuentas", "santi", d, mes, null)).toMatchObject({ valor: 1, meta: 1 });
    expect(avance("bajas", "joaco", d, mes, null)).toMatchObject({ valor: 1, meta: 0 });
    expect(avance("cuentas_activas", "joaco", d, mes, null)).toMatchObject({ valor: 2, meta: 18 });
  });

  it("la meta del mes se baja a la semana y al día por días hábiles", () => {
    const d = { ...base, contactos: [{ asignado_a: "mati", contactado_at: "2026-10-21T15:00:00Z", reunion_at: null }] };
    const filas = objetivosDePersona(
      { id: "mati", nombre: "Mati", rol: "comercial", area: "Comercial" },
      d,
      new Map([["mati:leads_contactados", { semanal: null, mensual: 1320 }]]),
      "2026-10-21"
    );
    const leads = filas.find((f) => f.id === "leads_contactados")!;
    expect(leads.mes.meta).toBe(1320);
    expect(leads.semana?.meta).toBe(300); // 5 hábiles de 22
    expect(leads.hoy?.meta).toBe(60);
    expect(leads.hoy?.valor).toBe(1);
  });

  it("los seguimientos se cuentan aparte de los contactos nuevos, por quien los mandó", () => {
    const d = {
      ...base,
      contactos: [{ asignado_a: "mati", contactado_at: "2026-10-21T15:00:00Z", reunion_at: null }],
      seguimientos: [
        { user_id: "mati", created_at: "2026-10-21T16:00:00Z" },
        { user_id: "mati", created_at: "2026-10-22T16:00:00Z" },
        { user_id: "santi", created_at: "2026-10-21T16:00:00Z" },
      ],
    };
    const filas = objetivosDePersona({ id: "mati", nombre: "Mati", rol: "comercial", area: "Comercial" }, d, new Map(), "2026-10-22");
    expect(filas.find((f) => f.id === "seguimientos")?.mes.valor).toBe(2);
    expect(filas.find((f) => f.id === "leads_contactados")?.mes.valor).toBe(1);
    // Sin la tabla (0215) no rompe: da 0.
    expect(avance("seguimientos", "mati", { ...base }, mes, null).valor).toBe(0);
  });

  it("semáforo: con «menos es mejor» la meta es un techo", () => {
    expect(semaforoObjetivo({ valor: 10, meta: 60, proyeccion: null }, true, mes)).toBe("bien");
    expect(semaforoObjetivo({ valor: 70, meta: 60, proyeccion: null }, true, mes)).toBe("mal");
    expect(semaforoObjetivo({ valor: 20, meta: 100, proyeccion: 95 }, false, mes)).toBe("bien");
  });
});

describe("Coordinación General (Leo)", () => {
  const mes = mesDe("2026-10-21");
  it("cobros marcados hasta el 5 y sueldos del mes anterior pagados hasta el 7", () => {
    const d = {
      ...base,
      facturas: [
        { periodo: "2026-10", fecha_cobro: "2026-10-03" },
        { periodo: "2026-10", fecha_cobro: "2026-10-12" },
        { periodo: "2026-10", fecha_cobro: null },
        { periodo: "2026-09", fecha_cobro: "2026-09-02" },
      ],
      pagosEquipo: [
        { periodo: "2026-09", fecha_pago: "2026-10-07" },
        { periodo: "2026-09", fecha_pago: null },
        { periodo: "2026-10", fecha_pago: null },
      ],
      perfiles: [true, false, true],
    };
    expect(avance("cobros_a_tiempo", "leo", d, mes, null)).toMatchObject({ valor: 1, meta: 3 });
    expect(avance("sueldos_a_tiempo", "leo", d, mes, null)).toMatchObject({ valor: 1, meta: 2 });
    expect(avance("perfiles_completos", "leo", d, mes, null)).toMatchObject({ valor: 2, meta: 3 });
    expect(metricasDe({ id: "leo", nombre: "Leo", rol: "admin", area: "Coordinación General" })).toEqual(["cobros_a_tiempo", "sueldos_a_tiempo", "perfiles_completos"]);
  });
});
