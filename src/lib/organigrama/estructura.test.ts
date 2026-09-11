import { describe, expect, it } from "vitest";
import {
  ORGANIGRAMA,
  agruparPorArea,
  aplanar,
  calcularCarga,
  iniciales,
  resolverOrganigrama,
} from "./estructura";

const USUARIOS = [
  { id: "joaco", nombre: "Joaquín Darsie", rol: "admin", area: "Estrategia/Dirección", area_secundaria: null },
  { id: "luz", nombre: "Luz Torres", rol: "coordinador", area: "Coordinación", area_secundaria: null },
  { id: "brisa", nombre: "Brisa Tejada", rol: "coordinador_diseno", area: "Coordinación de Diseño", area_secundaria: "Diseño" },
  { id: "dario", nombre: "Darío", rol: "diseno", area: "Diseño", area_secundaria: null },
  { id: "guille", nombre: "Guillermo García", rol: "coordinador", area: "Coordinación de Paid Media", area_secundaria: "Paid Media" },
  { id: "santi", nombre: "Santiago Reinaldi", rol: "coordinador", area: "Comercial", area_secundaria: null },
];

function resolver() {
  return resolverOrganigrama(ORGANIGRAMA, agruparPorArea(USUARIOS));
}

describe("agruparPorArea", () => {
  it("pone a la persona en su área y también en la secundaria", () => {
    const mapa = agruparPorArea(USUARIOS);
    expect(mapa.get("Coordinación de Diseño")?.map((p) => p.id)).toEqual(["brisa"]);
    expect(mapa.get("Diseño")?.map((p) => p.id)).toEqual(["brisa", "dario"]);
  });

  it("ignora las áreas vacías y no duplica a nadie", () => {
    const mapa = agruparPorArea([
      ...USUARIOS,
      { id: "dario", nombre: "Darío", rol: "diseno", area: "Diseño", area_secundaria: "Diseño" },
      { id: "sin", nombre: "Sin Área", rol: null, area: null, area_secundaria: null },
    ]);
    expect(mapa.get("Diseño")?.filter((p) => p.id === "dario")).toHaveLength(1);
    expect(mapa.has("null")).toBe(false);
  });
});

describe("resolverOrganigrama", () => {
  it("cuelga a cada uno de su puesto", () => {
    const raiz = resolver();
    const porId = new Map(aplanar(raiz).map((n) => [n.id, n]));
    expect(porId.get("direccion")!.gente.map((p) => p.id)).toEqual(["joaco"]);
    expect(porId.get("operaciones")!.gente.map((p) => p.id)).toEqual(["luz"]);
    expect(porId.get("estrategia")!.gente.map((p) => p.id)).toEqual(["brisa"]);
    expect(porId.get("paid-media")!.gente.map((p) => p.id)).toEqual(["guille"]);
    expect(porId.get("comercial")!.gente.map((p) => p.id)).toEqual(["santi"]);
  });

  it("no repite a quien coordina dentro del área que coordina", () => {
    // Brisa tiene "Diseño" como área secundaria, pero ya figura arriba en
    // Estrategia y calidad: si apareciera también como diseñadora, el
    // organigrama mentiría sobre quién ejecuta.
    const raiz = resolver();
    const diseno = aplanar(raiz).find((n) => n.id === "diseno")!;
    expect(diseno.gente.map((p) => p.id)).toEqual(["dario"]);
  });

  it("deja el puesto vacío cuando nadie tiene esa área", () => {
    const raiz = resolverOrganigrama(ORGANIGRAMA, agruparPorArea([]));
    expect(aplanar(raiz).every((n) => n.gente.length === 0)).toBe(true);
  });
});

describe("la estructura en sí", () => {
  const nodos = aplanar(resolver());

  it("no repite ids: se usan en la URL", () => {
    const ids = nodos.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo puesto responde por algo y tiene al menos un link", () => {
    for (const n of nodos) {
      expect(n.respondePor.length, `${n.id} sin respondePor`).toBeGreaterThan(0);
      expect(n.tareas.length, `${n.id} sin tareas`).toBeGreaterThan(0);
    }
  });

  it("los links son rutas internas de la app", () => {
    for (const n of nodos) {
      for (const t of n.tareas) expect(t.href, `${n.id} → ${t.label}`).toMatch(/^\//);
    }
  });

  it("producción cuelga de Operaciones, no de Dirección", () => {
    const operaciones = nodos.find((n) => n.id === "operaciones")!;
    expect(operaciones.hijos?.map((h) => h.id)).toEqual(["community", "diseno", "edicion"]);
  });

  it("las responsabilidades permanentes viven en el puesto, no en tareas", () => {
    // Eran once tareas `[Función]` sin fecha límite en `tasks`, donde no las
    // veía nadie y ensuciaban la cola de pendientes.
    const cg = nodos.find((n) => n.id === "coordinacion-general")!;
    expect(cg.responsabilidades).toHaveLength(11);
    expect(cg.responsabilidades).toContain("Llevar las finanzas de la agencia");
    expect(cg.responsabilidades).toContain("Cobrar a clientes en tiempo y forma");
    // Ninguna se coló como si fuera una tarea con pantalla propia.
    for (const r of cg.responsabilidades!) {
      expect(cg.tareas.some((t) => t.label === r)).toBe(false);
    }
  });

  it("Paid Media va en paralelo: no cuelga de Operaciones", () => {
    const operaciones = nodos.find((n) => n.id === "operaciones")!;
    expect(operaciones.hijos?.some((h) => h.id === "paid-media")).toBe(false);
    expect(nodos.find((n) => n.id === "paid-media")!.paralelo).toBe(true);
  });
});

describe("calcularCarga", () => {
  const VIVOS = new Set(["c1"]);
  const HOY = "2026-09-10";

  it("cuenta lo abierto y marca lo vencido", () => {
    const carga = calcularCarga(
      [
        { asignado_a_id: "dario", estado: "pendiente", fecha_limite: "2026-09-01", cliente_id: "c1" },
        { asignado_a_id: "dario", estado: "en_progreso", fecha_limite: "2026-09-20", cliente_id: "c1" },
      ],
      VIVOS,
      HOY
    );
    expect(carga.get("dario")).toEqual({ abiertas: 2, vencidas: 1 });
  });

  it("lo que vence hoy todavía no está vencido", () => {
    const carga = calcularCarga(
      [{ asignado_a_id: "dario", estado: "pendiente", fecha_limite: "2026-09-10", cliente_id: "c1" }],
      VIVOS,
      HOY
    );
    expect(carga.get("dario")).toEqual({ abiertas: 1, vencidas: 0 });
  });

  it("no cuenta lo cerrado ni lo archivado", () => {
    const carga = calcularCarga(
      [
        { asignado_a_id: "dario", estado: "completada", fecha_limite: "2026-09-01", cliente_id: "c1" },
        { asignado_a_id: "dario", estado: "archivada", fecha_limite: "2026-09-01", cliente_id: "c1" },
      ],
      VIVOS,
      HOY
    );
    expect(carga.has("dario")).toBe(false);
  });

  it("descarta las tareas de clientes que ya no están", () => {
    // El caso real: 44 de las 89 vencidas eran de Alonso y Power Collections,
    // dos cuentas perdidas. Contarlas hacía ver una deuda que no existe.
    const carga = calcularCarga(
      [{ asignado_a_id: "sol", estado: "pendiente", fecha_limite: "2026-08-01", cliente_id: "perdido" }],
      VIVOS,
      HOY
    );
    expect(carga.has("sol")).toBe(false);
  });

  it("las tareas internas (sin cliente) sí cuentan", () => {
    const carga = calcularCarga(
      [{ asignado_a_id: "luz", estado: "pendiente", fecha_limite: null, cliente_id: null }],
      VIVOS,
      HOY
    );
    expect(carga.get("luz")).toEqual({ abiertas: 1, vencidas: 0 });
  });

  it("ignora lo que no tiene dueño", () => {
    const carga = calcularCarga(
      [{ asignado_a_id: null, estado: "pendiente", fecha_limite: "2026-08-01", cliente_id: "c1" }],
      VIVOS,
      HOY
    );
    expect(carga.size).toBe(0);
  });
});

describe("iniciales", () => {
  it("toma las dos primeras", () => {
    expect(iniciales("Luz Torres")).toBe("LT");
    expect(iniciales("Carlos David Perlo")).toBe("CD");
  });

  it("aguanta un nombre solo y los espacios de más", () => {
    expect(iniciales("Darío")).toBe("D");
    expect(iniciales("  Brisa   Tejada ")).toBe("BT");
  });
});
