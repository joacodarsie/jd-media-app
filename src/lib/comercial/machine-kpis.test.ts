/**
 * Tests del tablero "Máquina de clientes". Lo que importa que no mienta:
 * el ritmo necesario vs el real (define si llegamos a 50), las tasas del embudo
 * (que descuentan los datos malos) y los avisos de datos sucios.
 */
import { describe, it, expect } from "vitest";
import {
  computeMachineKpis,
  lunesDe,
  fechaAlta,
  META_CLIENTES,
  type ClienteRow,
  type ContactoRow,
} from "./machine-kpis";

const AHORA = new Date("2026-07-26T12:00:00Z");
const diasAtras = (n: number) => new Date(AHORA.getTime() - n * 86_400_000).toISOString();

function cliente(p: Partial<ClienteRow> = {}): ClienteRow {
  return {
    id: Math.random().toString(36).slice(2),
    nombre: "Cuenta",
    estado: "activo",
    monto_mensual: 350000,
    fecha_inicio: null,
    fecha_activado: null,
    fecha_inactivado: null,
    es_interno: false,
    cerrado_por_id: null,
    created_at: null,
    ...p,
  };
}

function contacto(p: Partial<ContactoRow> = {}): ContactoRow {
  return {
    id: Math.random().toString(36).slice(2),
    estado: "nuevo",
    contactable: null,
    created_at: diasAtras(1),
    contactado_at: null,
    reunion_at: null,
    asignado_a: null,
    ...p,
  };
}

const base = {
  clientes: [] as ClienteRow[],
  contactos: [] as ContactoRow[],
  usuarios: [{ id: "u1", nombre: "Guille" }],
  costoIaMesUsd: 0,
  ahora: AHORA,
};

describe("lunesDe", () => {
  it("un domingo pertenece a la semana que arrancó el lunes anterior", () => {
    expect(lunesDe(new Date("2026-07-26T12:00:00Z"))).toBe("2026-07-20");
  });
  it("un lunes es su propio inicio de semana", () => {
    expect(lunesDe(new Date("2026-07-20T00:30:00Z"))).toBe("2026-07-20");
  });
});

describe("fechaAlta", () => {
  it("prefiere fecha_inicio sobre la activación en la app", () => {
    expect(fechaAlta(cliente({ fecha_inicio: "2026-06-01", fecha_activado: "2026-05-20T00:00:00Z" }))).toBe(
      "2026-06-01"
    );
  });
  it("cae a fecha_activado si no hay fecha_inicio", () => {
    expect(fechaAlta(cliente({ fecha_activado: "2026-05-20T02:00:00Z" }))).toBe("2026-05-20");
  });
});

describe("meta de 50 clientes", () => {
  it("calcula cuántas faltan y el ritmo necesario por semana", () => {
    const k = computeMachineKpis({
      ...base,
      clientes: Array.from({ length: 17 }, () => cliente({ fecha_inicio: "2026-03-01" })),
    });
    expect(k.meta.objetivo).toBe(META_CLIENTES);
    expect(k.meta.activos).toBe(17);
    expect(k.meta.faltan).toBe(33);
    // Del 26/07 al 31/12 hay ~22,7 semanas → ~1,45 altas netas por semana.
    expect(k.meta.semanasRestantes).toBeGreaterThan(22);
    expect(k.meta.ritmoNecesario).toBeGreaterThan(1.4);
    expect(k.meta.ritmoNecesario).toBeLessThan(1.6);
  });

  it("las bajas descuentan del ritmo real (ritmo NETO)", () => {
    const k = computeMachineKpis({
      ...base,
      clientes: [
        cliente({ fecha_inicio: diasAtras(10).slice(0, 10) }),
        cliente({ fecha_inicio: diasAtras(20).slice(0, 10) }),
        cliente({
          estado: "perdido",
          fecha_inicio: "2026-01-01",
          fecha_inactivado: diasAtras(15),
        }),
      ],
    });
    // 2 altas y 1 baja en 8 semanas → 0,125 netas por semana (redondeado a 0,13).
    expect(k.meta.ritmoActual).toBe(0.13);
    expect(k.meta.semaforo).toBe("rojo");
  });

  it("no cuenta las cuentas internas (JD Media) como clientes", () => {
    const k = computeMachineKpis({
      ...base,
      clientes: [cliente(), cliente({ es_interno: true })],
    });
    expect(k.meta.activos).toBe(1);
  });
});

describe("embudo de 30 días", () => {
  it("la tasa de agenda descuenta los contactos con dato malo", () => {
    const k = computeMachineKpis({
      ...base,
      contactos: [
        // 10 contactados, 2 con el dato mal cargado → 8 alcanzados.
        ...Array.from({ length: 8 }, () => contacto({ estado: "contactado", contactado_at: diasAtras(5) })),
        ...Array.from({ length: 2 }, () =>
          contacto({ estado: "contactado", contactado_at: diasAtras(5), contactable: false })
        ),
        contacto({ estado: "reunion", contactado_at: diasAtras(6), reunion_at: diasAtras(3) }),
      ],
    });
    expect(k.embudo.contactados).toBe(11);
    expect(k.embudo.alcanzados).toBe(9);
    expect(k.embudo.reuniones).toBe(1);
    // 1 de 9 alcanzados ≈ 11,1%
    expect(k.embudo.agendaPct).toBeCloseTo(11.1, 1);
  });

  it("deja las tasas en null si todavía no hay base (sin dividir por cero)", () => {
    const k = computeMachineKpis(base);
    expect(k.embudo.agendaPct).toBeNull();
    expect(k.embudo.cierrePct).toBeNull();
    expect(k.embudo.contactosPorCliente).toBeNull();
  });

  it("ignora lo que pasó fuera de la ventana de 30 días", () => {
    const k = computeMachineKpis({
      ...base,
      contactos: [contacto({ estado: "contactado", contactado_at: diasAtras(45) })],
    });
    expect(k.embudo.contactados).toBe(0);
  });
});

describe("semanas", () => {
  it("devuelve 8 semanas, la más nueva primero, con el neto de altas y bajas", () => {
    const k = computeMachineKpis({
      ...base,
      clientes: [
        cliente({ fecha_inicio: "2026-07-21" }),
        cliente({ estado: "perdido", fecha_inicio: "2026-01-01", fecha_inactivado: "2026-07-22T10:00:00Z" }),
      ],
    });
    expect(k.semanas).toHaveLength(8);
    expect(k.semanas[0].inicio).toBe("2026-07-20");
    expect(k.semanas[0].altas).toBe(1);
    expect(k.semanas[0].bajas).toBe(1);
    expect(k.semanas[0].neto).toBe(0);
  });
});

describe("por persona", () => {
  it("suma contactados y reuniones al dueño del contacto", () => {
    const k = computeMachineKpis({
      ...base,
      contactos: [
        contacto({ estado: "contactado", contactado_at: diasAtras(2), asignado_a: "u1" }),
        contacto({ estado: "reunion", contactado_at: diasAtras(9), reunion_at: diasAtras(8), asignado_a: "u1" }),
      ],
      clientes: [cliente({ cerrado_por_id: "u1", fecha_inicio: "2026-06-01" })],
    });
    expect(k.personas).toHaveLength(1);
    expect(k.personas[0].nombre).toBe("Guille");
    expect(k.personas[0].contactados7).toBe(1);
    expect(k.personas[0].contactados30).toBe(2);
    expect(k.personas[0].reuniones30).toBe(1);
    expect(k.personas[0].cierresTotales).toBe(1);
  });
});

describe("plata", () => {
  it("el ticket promedio ignora las cuentas sin monto cargado", () => {
    const k = computeMachineKpis({
      ...base,
      clientes: [
        cliente({ monto_mensual: 300000 }),
        cliente({ monto_mensual: 500000 }),
        cliente({ monto_mensual: null }),
      ],
    });
    expect(k.plata.mrr).toBe(800000);
    expect(k.plata.ticketPromedio).toBe(400000);
    expect(k.plata.mrrObjetivo).toBe(400000 * 50);
  });
});

describe("avisos de datos sucios", () => {
  it("avisa de contactos trabajados sin dueño y de cuentas sin monto", () => {
    const k = computeMachineKpis({
      ...base,
      contactos: [contacto({ estado: "contactado", contactado_at: diasAtras(1) })],
      clientes: [cliente({ monto_mensual: null })],
    });
    expect(k.avisos.some((a) => a.includes("sin dueño"))).toBe(true);
    expect(k.avisos.some((a) => a.includes("sin monto mensual"))).toBe(true);
  });

  it("avisa si hubo actividad pero ninguna reunión agendada", () => {
    const k = computeMachineKpis({
      ...base,
      contactos: [contacto({ estado: "contactado", contactado_at: diasAtras(1), asignado_a: "u1" })],
    });
    expect(k.avisos.some((a) => a.includes("Ninguna reunión"))).toBe(true);
  });

  it("sin actividad no inventa avisos de reuniones", () => {
    const k = computeMachineKpis(base);
    expect(k.avisos.some((a) => a.includes("Ninguna reunión"))).toBe(false);
  });

  it("detecta las bajas cargadas todas el mismo día (carga inicial, no churn real)", () => {
    const baja = (fecha: string) =>
      cliente({ estado: "perdido", fecha_inicio: "2026-01-01", fecha_inactivado: fecha });
    const k = computeMachineKpis({
      ...base,
      clientes: [
        baja("2026-05-21T19:09:36Z"),
        baja("2026-05-21T19:09:36Z"),
        baja("2026-05-21T19:09:36Z"),
      ],
    });
    expect(k.avisos.some((a) => a.includes("el mismo día"))).toBe(true);
  });

  it("dos bajas sueltas el mismo día no disparan el aviso", () => {
    const baja = (fecha: string) =>
      cliente({ estado: "perdido", fecha_inicio: "2026-01-01", fecha_inactivado: fecha });
    const k = computeMachineKpis({
      ...base,
      clientes: [baja("2026-06-08T10:00:00Z"), baja("2026-06-08T18:00:00Z")],
    });
    expect(k.avisos.some((a) => a.includes("el mismo día"))).toBe(false);
  });
});
