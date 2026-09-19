import { describe, it, expect } from "vitest";
import {
  tituloReunion,
  periodoDe,
  sumarDias,
  fechaLimiteReunion,
  reunionesFaltantes,
  reunionesAtrasadas,
  avisoAtrasadas,
  DIA_LIMITE_REUNION,
  type ClienteParaReunion,
} from "./reunion-mensual";

const LUZ = "luz-id";

const cli = (over: Partial<ClienteParaReunion> = {}): ClienteParaReunion => ({
  id: "c1",
  nombre: "Impermax",
  estado: "activo",
  es_interno: false,
  cm_id: null,
  ...over,
});

const base = {
  clientes: [cli()],
  registradas: [],
  titulosExistentes: [],
  responsable: LUZ,
  hoy: "2026-09-02",
};

describe("quién da la reunión", () => {
  it("la da el RESPONSABLE de la cuenta cuando lo hay: es quien cobra el 5% de cartera", () => {
    const out = reunionesFaltantes({ ...base, clientes: [cli({ responsable_id: "santi" })] });
    expect(out[0].asignado_a_id).toBe("santi");
  });

  it("sin responsable, la da la Project Manager", () => {
    const out = reunionesFaltantes(base);
    expect(out[0].asignado_a_id).toBe(LUZ);
  });
});

describe("tituloReunion", () => {
  it("es estable: el mismo cliente y mes dan el mismo título", () => {
    expect(tituloReunion("Impermax", "2026-09")).toBe("Reunión mensual — Impermax — 2026-09");
  });
});

describe("periodoDe y sumarDias", () => {
  it("saca el período de una fecha", () => {
    expect(periodoDe("2026-09-13")).toBe("2026-09");
  });

  it("suma días cruzando el fin de mes", () => {
    expect(sumarDias("2026-09-30", 3)).toBe("2026-10-03");
  });
});

describe("fechaLimiteReunion", () => {
  it("vence el 10 del mes cuando todavía no pasó", () => {
    expect(fechaLimiteReunion("2026-09", "2026-09-02")).toBe(
      `2026-09-${String(DIA_LIMITE_REUNION).padStart(2, "0")}`
    );
  });

  it("da 3 días cuando el 10 ya pasó, para que no nazca vencida", () => {
    expect(fechaLimiteReunion("2026-09", "2026-09-13")).toBe("2026-09-16");
  });

  it("el mismo día 10 todavía vale como límite", () => {
    expect(fechaLimiteReunion("2026-09", "2026-09-10")).toBe("2026-09-10");
  });
});

describe("reunionesFaltantes", () => {
  it("pide la reunión de una cuenta activa sin registrar", () => {
    const r = reunionesFaltantes(base);
    expect(r).toHaveLength(1);
    expect(r[0].titulo).toBe("Reunión mensual — Impermax — 2026-09");
    expect(r[0].fecha_limite).toBe("2026-09-10");
    expect(r[0].prioridad).toBe("alta");
  });

  it("la da la PM aunque la cuenta tenga CM: la reunión no se reparte", () => {
    const r = reunionesFaltantes({ ...base, clientes: [cli({ cm_id: "sol-id" })] });
    expect(r[0].asignado_a_id).toBe(LUZ);
  });

  it("nombra al CM en la descripción para que prepare el material", () => {
    const r = reunionesFaltantes({
      ...base,
      clientes: [cli({ cm_id: "sol-id" })],
      nombrePorId: { "sol-id": "Sol Britos" },
    });
    expect(r[0].descripcion).toContain("Sol Britos");
  });

  it("la da siempre la PM, no el CM de la cuenta", () => {
    expect(reunionesFaltantes(base)[0].asignado_a_id).toBe(LUZ);
  });

  it("no pide la reunión si ya está registrada ese mes", () => {
    const r = reunionesFaltantes({
      ...base,
      registradas: [{ cliente_id: "c1", periodo: "2026-09" }],
    });
    expect(r).toHaveLength(0);
  });

  it("la de un mes anterior no cuenta como dada", () => {
    const r = reunionesFaltantes({
      ...base,
      registradas: [{ cliente_id: "c1", periodo: "2026-08" }],
    });
    expect(r).toHaveLength(1);
  });

  it("es idempotente: si el ticket ya existe no lo vuelve a crear", () => {
    const r = reunionesFaltantes({
      ...base,
      titulosExistentes: ["Reunión mensual — Impermax — 2026-09"],
    });
    expect(r).toHaveLength(0);
  });

  it("saltea las cuentas que no están activas", () => {
    const r = reunionesFaltantes({ ...base, clientes: [cli({ estado: "perdido" })] });
    expect(r).toHaveLength(0);
  });

  it("saltea la cuenta interna de la agencia", () => {
    const r = reunionesFaltantes({ ...base, clientes: [cli({ es_interno: true })] });
    expect(r).toHaveLength(0);
  });

  it("la descripción manda a la pantalla de la reunión de ESE cliente", () => {
    const r = reunionesFaltantes({ ...base, clientes: [cli({ id: "abc-123" })] });
    expect(r[0].descripcion).toContain("/clientes/abc-123/reunion");
  });
});

describe("reunionesAtrasadas", () => {
  it("antes del día 15 no escala nada", () => {
    expect(reunionesAtrasadas({ clientes: [cli()], registradas: [], hoy: "2026-09-14" })).toHaveLength(0);
  });

  it("del 15 en adelante lista las que siguen sin darse", () => {
    const r = reunionesAtrasadas({ clientes: [cli()], registradas: [], hoy: "2026-09-15" });
    expect(r.map((c) => c.nombre)).toEqual(["Impermax"]);
  });

  it("no lista las que ya se dieron", () => {
    const r = reunionesAtrasadas({
      clientes: [cli()],
      registradas: [{ cliente_id: "c1", periodo: "2026-09" }],
      hoy: "2026-09-20",
    });
    expect(r).toHaveLength(0);
  });
});

describe("avisoAtrasadas", () => {
  it("nombra las primeras y resume el resto", () => {
    const cs = ["A", "B", "C", "D", "E", "F"].map((n) => cli({ id: n, nombre: n }));
    const t = avisoAtrasadas(cs, "2026-09");
    expect(t).toContain("6 cuentas");
    expect(t).toContain("A, B, C, D");
    expect(t).toContain("y 2 más");
  });

  it("con una sola cuenta habla en singular", () => {
    expect(avisoAtrasadas([cli()], "2026-09")).toContain("1 cuenta (");
  });
});
