import { describe, it, expect } from "vitest";
import {
  normalizeMonthlyDiagnostic,
  normalizeClientReport,
  hasMonthlyContent,
  hasClientReport,
  periodoDeReunion,
  EMPTY_MONTHLY_DIAGNOSTIC,
} from "./schema";
import { monthlyDiagnosticToText } from "./prompt";

describe("periodoDeReunion", () => {
  it("los primeros días del mes la reunión habla del mes anterior", () => {
    expect(periodoDeReunion("2026-08-04")).toBe("2026-07");
    expect(periodoDeReunion("2026-08-09")).toBe("2026-07");
  });

  it("del 10 en adelante habla del mes que corre", () => {
    expect(periodoDeReunion("2026-08-10")).toBe("2026-08");
    expect(periodoDeReunion("2026-08-31")).toBe("2026-08");
  });

  it("cruza el año hacia atrás", () => {
    expect(periodoDeReunion("2026-01-03")).toBe("2025-12");
  });
});

describe("normalizeMonthlyDiagnostic", () => {
  it("devuelve la estructura vacía cuando no hay nada", () => {
    const out = normalizeMonthlyDiagnostic(null);
    expect(out.resumen).toEqual([]);
    expect(out.semaforo).toBe("atencion");
    expect(out.riesgo.nivel).toBe("bajo");
    expect(out.acciones_proximo_mes).toEqual([]);
  });

  it("parsea los subobjetos que el modelo serializó como string", () => {
    const out = normalizeMonthlyDiagnostic({
      semaforo: "riesgo",
      resumen: ["a", "b"],
      negocio_del_cliente: JSON.stringify({
        como_le_fue: "Bajaron las consultas",
        hitos: ["Abrió el local nuevo"],
        lo_que_se_viene: [],
      }),
      publico_objetivo: JSON.stringify({
        hubo_cambio: true,
        detalle: "Ahora le vende a empresas",
        publico_actual: "PyMEs de Córdoba",
      }),
      riesgo: JSON.stringify({ nivel: "alto", señales: ["Dijo que está evaluando"] }),
    });

    expect(out.semaforo).toBe("riesgo");
    expect(out.negocio_del_cliente.como_le_fue).toBe("Bajaron las consultas");
    expect(out.negocio_del_cliente.hitos).toEqual(["Abrió el local nuevo"]);
    expect(out.publico_objetivo.hubo_cambio).toBe(true);
    expect(out.publico_objetivo.publico_actual).toBe("PyMEs de Córdoba");
    expect(out.riesgo.nivel).toBe("alto");
    expect(out.riesgo.señales).toEqual(["Dijo que está evaluando"]);
  });

  it("parsea arrays serializados como string", () => {
    const out = normalizeMonthlyDiagnostic({
      funciono: JSON.stringify([{ que: "Los reels", por_que: "Muestran la cara" }]),
      citas_del_cliente: JSON.stringify(["Estoy contento con los reels"]),
    });
    expect(out.funciono).toEqual([{ que: "Los reels", por_que: "Muestran la cara" }]);
    expect(out.citas_del_cliente).toEqual(["Estoy contento con los reels"]);
  });

  it("fuerza a array lo que no lo es, para que el render nunca rompa", () => {
    const out = normalizeMonthlyDiagnostic({
      resumen: "no soy un array",
      funciono: { que: "tampoco" },
      aprendizajes: 42,
    });
    expect(out.resumen).toEqual([]);
    expect(out.funciono).toEqual([]);
    expect(out.aprendizajes).toEqual([]);
  });

  it("cae a un valor válido cuando el enum viene mal", () => {
    const out = normalizeMonthlyDiagnostic({
      semaforo: "excelente",
      riesgo: { nivel: "altísimo", señales: [] },
      frustraciones: [{ titulo: "Tiempos", detalle: "x", gravedad: "urgente" }],
      necesidades: [{ titulo: "Web", detalle: "x", area_sugerida: "programacion" }],
      acciones_proximo_mes: [
        { titulo: "Hacer X", descripcion: "y", area_sugerida: "diseno", prioridad: "ALTA" },
      ],
    });
    expect(out.semaforo).toBe("atencion");
    expect(out.riesgo.nivel).toBe("bajo");
    expect(out.frustraciones[0].gravedad).toBe("media");
    expect(out.necesidades[0].area_sugerida).toBe("otro");
    expect(out.acciones_proximo_mes[0].prioridad).toBe("alta");
    expect(out.acciones_proximo_mes[0].area_sugerida).toBe("diseno");
  });

  it("descarta ítems sin título y strings vacíos", () => {
    const out = normalizeMonthlyDiagnostic({
      resumen: ["real", "  ", ""],
      frustraciones: [{ titulo: "", detalle: "x", gravedad: "alta" }],
      funciono: [{ que: "", por_que: "x" }],
    });
    expect(out.resumen).toEqual(["real"]);
    expect(out.frustraciones).toEqual([]);
    expect(out.funciono).toEqual([]);
  });

  it("acepta 'senales' sin ñ, que es como a veces lo devuelve el modelo", () => {
    const out = normalizeMonthlyDiagnostic({
      riesgo: { nivel: "medio", senales: ["se quejó del precio"] },
    });
    expect(out.riesgo.señales).toEqual(["se quejó del precio"]);
  });

  it("marca los reclamos que se repiten", () => {
    const out = normalizeMonthlyDiagnostic({
      frustraciones: [
        {
          titulo: "Tiempos de entrega",
          detalle: "Otra vez llegaron tarde",
          gravedad: "alta",
          ya_venia_del_mes_pasado: true,
        },
      ],
    });
    expect(out.frustraciones[0].ya_venia_del_mes_pasado).toBe(true);
  });
});

describe("hasMonthlyContent", () => {
  it("distingue el JSON vacío del diagnóstico real", () => {
    expect(hasMonthlyContent(null)).toBe(false);
    expect(hasMonthlyContent({})).toBe(false);
    expect(hasMonthlyContent({ resumen: [] })).toBe(true);
    expect(hasMonthlyContent(EMPTY_MONTHLY_DIAGNOSTIC)).toBe(true);
  });
});

describe("normalizeClientReport", () => {
  it("devuelve todo vacío cuando no hay nada", () => {
    const r = normalizeClientReport(null);
    expect(r.titular).toBe("");
    expect(r.logros).toEqual([]);
    expect(r.numeros).toEqual([]);
  });

  it("descarta números sin cifra o sin etiqueta", () => {
    const r = normalizeClientReport({
      numeros: [
        { valor: "12.400", etiqueta: "personas que vieron tu contenido", detalle: "+2.100" },
        { valor: "", etiqueta: "algo" },
        { valor: "99", etiqueta: "" },
      ],
    });
    expect(r.numeros).toHaveLength(1);
    expect(r.numeros[0]).toEqual({
      valor: "12.400",
      etiqueta: "personas que vieron tu contenido",
      detalle: "+2.100",
    });
  });

  it("deja el detalle en undefined si vino vacío", () => {
    const r = normalizeClientReport({
      numeros: [{ valor: "500", etiqueta: "seguidores nuevos", detalle: "  " }],
    });
    expect(r.numeros[0].detalle).toBeUndefined();
  });

  it("descarta bloques sin título y strings vacíos", () => {
    const r = normalizeClientReport({
      logros: [
        { titulo: "Más gente te encontró", detalle: "x" },
        { titulo: "", detalle: "y" },
      ],
      te_escuchamos: ["Necesitás el contenido antes", "", "   "],
    });
    expect(r.logros).toHaveLength(1);
    expect(r.te_escuchamos).toEqual(["Necesitás el contenido antes"]);
  });

  it("tolera que los arrays vengan como cualquier otra cosa", () => {
    const r = normalizeClientReport({
      logros: "no soy un array",
      numeros: 7,
      te_escuchamos: { a: 1 },
    });
    expect(r.logros).toEqual([]);
    expect(r.numeros).toEqual([]);
    expect(r.te_escuchamos).toEqual([]);
  });
});

describe("hasClientReport", () => {
  it("solo da true cuando hay algo que mostrarle al cliente", () => {
    expect(hasClientReport(null)).toBe(false);
    expect(hasClientReport({})).toBe(false);
    expect(hasClientReport({ apertura: "hola" })).toBe(false);
    expect(hasClientReport({ titular: "El mes del despegue" })).toBe(true);
    expect(hasClientReport({ logros: [{ titulo: "x", detalle: "y" }] })).toBe(true);
  });
});

describe("monthlyDiagnosticToText", () => {
  it("resume el mes anterior con lo que le importa al modelo", () => {
    const texto = monthlyDiagnosticToText("Julio 2026", {
      ...EMPTY_MONTHLY_DIAGNOSTIC,
      semaforo: "atencion",
      resumen: ["El cliente está tibio"],
      frustraciones: [
        { titulo: "Tiempos de entrega", detalle: "Llegan tarde", gravedad: "alta" },
      ],
      acciones_proximo_mes: [
        {
          titulo: "Adelantar la entrega a la semana 1",
          descripcion: "x",
          area_sugerida: "community",
          prioridad: "alta",
        },
      ],
      riesgo: { nivel: "medio", señales: ["Preguntó por el contrato"] },
    });

    expect(texto).toContain("Julio 2026");
    expect(texto).toContain("Tiempos de entrega");
    expect(texto).toContain("Adelantar la entrega");
    expect(texto).toContain("Riesgo de perder la cuenta: medio");
  });

  it("omite los bloques vacíos", () => {
    const texto = monthlyDiagnosticToText("Junio 2026", EMPTY_MONTHLY_DIAGNOSTIC);
    expect(texto).not.toContain("Frustraciones");
    expect(texto).not.toContain("Riesgo de perder");
  });
});
