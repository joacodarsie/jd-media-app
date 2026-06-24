import { describe, it, expect } from "vitest";
import {
  computeAutoPayroll,
  computeContentPayroll,
  computeCoordinationPayroll,
  closerVolumeBonusPct,
  selectFirstMonthCommissions,
  encodeCommissionNote,
  decodeCommissionNote,
  type PayrollClient,
  type PayrollService,
  type PayrollPublication,
} from "@/lib/payroll";
import { DEFAULT_AGENCY_SETTINGS } from "@/lib/coordinacion";

const r = DEFAULT_AGENCY_SETTINGS.rates;

function cliente(over: Partial<PayrollClient> = {}): PayrollClient {
  return {
    id: "c1",
    nombre: "Cliente",
    cm_id: null,
    disenador_id: null,
    audiovisual_id: null,
    media_buyer_id: null,
    coordinador_id: null,
    cerrado_por_id: null,
    fecha_inicio: null,
    ...over,
  };
}
function servicio(over: Partial<PayrollService> = {}): PayrollService {
  return {
    cliente_id: "c1",
    tipo: "gestion_redes",
    pack: "Presencia",
    pack_detalle: { posts: 4, reels: 4 },
    costo_override: null,
    costo_override_user: null,
    media_buyer_user_id: null,
    media_buyer_aplica: null,
    ...over,
  };
}

describe("computeAutoPayroll", () => {
  it("paga el CM por pack (diseño/edición ya no van acá)", () => {
    const out = computeAutoPayroll(
      [cliente({ cm_id: "cm1", disenador_id: "dis1", audiovisual_id: "av1" })],
      [servicio()],
      r,
      null
    );
    expect(out.get("cm1")?.[0].monto).toBe(r.cm.Presencia);
    expect(out.get("cm1")?.[0].kind).toBe("cm");
    // El diseño y la edición se pagan por contenido real, no acá.
    expect(out.get("dis1")?.some((l) => l.kind === "diseno")).not.toBe(true);
    expect(out.has("av1")).toBe(false);
  });

  it("el acuerdo fijo (override) reemplaza el CM", () => {
    const out = computeAutoPayroll(
      [cliente({ cm_id: "cm1", disenador_id: "dis1", audiovisual_id: "av1" })],
      [servicio({ costo_override: 120_000, costo_override_user: "u1" })],
      r,
      null
    );
    expect(out.get("u1")?.[0].monto).toBe(120_000);
    expect(out.get("u1")?.[0].kind).toBe("override");
    // No se genera la línea de CM separada.
    expect(out.has("cm1")).toBe(false);
  });

  it("media buyer cobra en toda cuenta con gestión de redes (pauta incluida)", () => {
    const out = computeAutoPayroll(
      [cliente({ cm_id: "cm1", media_buyer_id: "mb1" })],
      [servicio()],
      r,
      null
    );
    const mb = out.get("mb1")?.find((l) => l.kind === "media_buyer");
    expect(mb?.monto).toBe(r.media_buyer.Presencia);
  });

  it("media buyer cae al rol paid_media si la cuenta no tiene gestor asignado", () => {
    const out = computeAutoPayroll(
      [cliente({ cm_id: "cm1" })], // sin media_buyer_id
      [servicio()],
      r,
      "fallbackMB"
    );
    const mb = out.get("fallbackMB")?.find((l) => l.kind === "media_buyer");
    expect(mb?.monto).toBe(r.media_buyer.Presencia);
  });

  it("sin gestión de redes no hay media buyer", () => {
    const out = computeAutoPayroll(
      [cliente({ media_buyer_id: "mb1" })],
      [servicio({ tipo: "branding" })],
      r,
      "fallbackMB"
    );
    expect(out.has("mb1")).toBe(false);
    expect(out.has("fallbackMB")).toBe(false);
  });
});

describe("computeContentPayroll", () => {
  const periodo = "2026-06";
  function pub(over: Partial<PayrollPublication> = {}): PayrollPublication {
    return {
      cliente_id: "c1",
      tipo: "post",
      estado: "publicado",
      fecha_publicacion: "2026-06-10T12:00:00Z",
      audiovisual_id: null,
      ...over,
    };
  }

  it("paga diseño por post/carrusel reales al diseñador de la cuenta", () => {
    const out = computeContentPayroll(
      [cliente({ disenador_id: "dis1" })],
      [pub({ tipo: "post" }), pub({ tipo: "carrusel" }), pub({ tipo: "post" })],
      new Set(),
      r,
      periodo
    );
    const diseno = out.get("dis1")?.find((l) => l.kind === "diseno");
    expect(diseno?.monto).toBe(3 * r.diseno_pieza);
    expect(diseno?.concepto).toContain("3 piezas");
  });

  it("paga edición al editor de cada reel + portada al diseñador", () => {
    const out = computeContentPayroll(
      [cliente({ disenador_id: "dis1", audiovisual_id: "avCuenta" })],
      [
        pub({ tipo: "reel", audiovisual_id: "av1" }),
        pub({ tipo: "reel", audiovisual_id: "av1" }),
        pub({ tipo: "video", audiovisual_id: null }), // cae al editor de la cuenta
      ],
      new Set(),
      r,
      periodo
    );
    expect(out.get("av1")?.find((l) => l.kind === "edicion")?.monto).toBe(2 * r.edicion_reel);
    expect(out.get("avCuenta")?.find((l) => l.kind === "edicion")?.monto).toBe(r.edicion_reel);
    // 3 reels → 3 portadas al diseñador.
    expect(out.get("dis1")?.find((l) => l.concepto.startsWith("Portadas"))?.monto).toBe(
      3 * r.portada_reel
    );
  });

  it("solo cuenta estados aprobado/publicado del período", () => {
    const out = computeContentPayroll(
      [cliente({ disenador_id: "dis1" })],
      [
        pub({ tipo: "post", estado: "aprobado" }),
        pub({ tipo: "post", estado: "en_diseno" }), // no cuenta
        pub({ tipo: "post", fecha_publicacion: "2026-05-30T12:00:00Z" }), // otro mes
      ],
      new Set(),
      r,
      periodo
    );
    expect(out.get("dis1")?.find((l) => l.kind === "diseno")?.monto).toBe(r.diseno_pieza);
  });

  it("no paga contenido de cuentas con acuerdo fijo (override)", () => {
    const out = computeContentPayroll(
      [cliente({ disenador_id: "dis1" })],
      [pub({ tipo: "post" }), pub({ tipo: "reel", audiovisual_id: "av1" })],
      new Set(["c1"]),
      r,
      periodo
    );
    expect(out.size).toBe(0);
  });

  it("las historias no se pagan aparte (las cubre la CM)", () => {
    const out = computeContentPayroll(
      [cliente({ disenador_id: "dis1", cm_id: "cm1" })],
      [pub({ tipo: "historia" })],
      new Set(),
      r,
      periodo
    );
    expect(out.size).toBe(0);
  });
});

describe("computeCoordinationPayroll", () => {
  const abono = new Map<string, number>([
    ["c1", 350_000],
    ["c2", 500_000],
  ]);
  const clientes = [
    cliente({ id: "c1", nombre: "Uno", coordinador_id: "luz" }),
    cliente({ id: "c2", nombre: "Dos", coordinador_id: "luz" }),
  ];

  it("default: el 10% va entero a la coordinadora de cada cuenta", () => {
    const out = computeCoordinationPayroll(clientes, abono, 0.1, null, null);
    const total = (out.get("luz") ?? []).reduce((a, l) => a + l.monto, 0);
    expect(total).toBe(35_000 + 50_000);
    expect(out.has("brisa")).toBe(false);
  });

  it("split 50/50: reparte el pool de cada cuenta entre dos personas (5% y 5%)", () => {
    const out = computeCoordinationPayroll(clientes, abono, 0.1, null, [
      { userId: "brisa", pct: 0.5 },
      { userId: "luz", pct: 0.5 },
    ]);
    const luz = (out.get("luz") ?? []).reduce((a, l) => a + l.monto, 0);
    const brisa = (out.get("brisa") ?? []).reduce((a, l) => a + l.monto, 0);
    expect(luz).toBe(17_500 + 25_000);
    expect(brisa).toBe(17_500 + 25_000);
    expect(out.get("luz")?.[0].concepto).toContain("5%");
  });

  it("cae al fallback si la cuenta no tiene coordinadora y no hay split", () => {
    const out = computeCoordinationPayroll(
      [cliente({ id: "c1", nombre: "Uno", coordinador_id: null })],
      new Map([["c1", 350_000]]),
      0.1,
      "fallbackCoord",
      null
    );
    expect(out.get("fallbackCoord")?.[0].monto).toBe(35_000);
  });

  it("sin pct de coordinación no genera nada", () => {
    const out = computeCoordinationPayroll(clientes, abono, 0, "x", null);
    expect(out.size).toBe(0);
  });
});

describe("closerVolumeBonusPct", () => {
  it("suma 2% cada 2 cierres, con tope del 6%", () => {
    expect(closerVolumeBonusPct(0)).toBe(0);
    expect(closerVolumeBonusPct(1)).toBe(0);
    expect(closerVolumeBonusPct(2)).toBe(0.02);
    expect(closerVolumeBonusPct(3)).toBe(0.02);
    expect(closerVolumeBonusPct(4)).toBe(0.04);
    expect(closerVolumeBonusPct(6)).toBe(0.06);
    expect(closerVolumeBonusPct(20)).toBe(0.06); // tope
  });
});

describe("encode/decode de comisión", () => {
  it("ida y vuelta", () => {
    expect(encodeCommissionNote("closer", 350_000.4)).toBe("closer:350000");
    expect(decodeCommissionNote("both:500000")).toEqual({ role: "both", base: 500_000 });
  });
  it("notas inválidas → null", () => {
    expect(decodeCommissionNote(null)).toBeNull();
    expect(decodeCommissionNote("cualquiercosa")).toBeNull();
    expect(decodeCommissionNote("closer:no-numero")).toBeNull();
  });
});

describe("selectFirstMonthCommissions", () => {
  const periodo = "2026-06";
  const rec = new Map<string, number>([["c1", 350_000]]);
  const noManual = () => false;

  it("genera la comisión del closer en el primer mes (10% del abono)", () => {
    const out = selectFirstMonthCommissions(
      [cliente({ cerrado_por_id: "u1", fecha_inicio: "2026-06-10" })],
      rec,
      periodo,
      0.1,
      noManual
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ closerId: "u1", clienteId: "c1", base: 350_000, monto: 35_000 });
  });

  it("ignora clientes cuyo primer mes no es el período", () => {
    const out = selectFirstMonthCommissions(
      [cliente({ cerrado_por_id: "u1", fecha_inicio: "2026-05-30" })],
      rec,
      periodo,
      0.1,
      noManual
    );
    expect(out).toHaveLength(0);
  });

  it("ignora clientes sin cerrado_por_id", () => {
    const out = selectFirstMonthCommissions(
      [cliente({ cerrado_por_id: null, fecha_inicio: "2026-06-01" })],
      rec,
      periodo,
      0.1,
      noManual
    );
    expect(out).toHaveLength(0);
  });

  it("no duplica si ya hay una comisión manual para esa cuenta", () => {
    const out = selectFirstMonthCommissions(
      [cliente({ cerrado_por_id: "u1", fecha_inicio: "2026-06-01" })],
      rec,
      periodo,
      0.1,
      (id) => id === "c1"
    );
    expect(out).toHaveLength(0);
  });

  it("ignora clientes sin abono recurrente (base 0)", () => {
    const out = selectFirstMonthCommissions(
      [cliente({ id: "cX", cerrado_por_id: "u1", fecha_inicio: "2026-06-01" })],
      rec, // no tiene cX
      periodo,
      0.1,
      noManual
    );
    expect(out).toHaveLength(0);
  });

  it("con cierrePct 0 no genera nada", () => {
    const out = selectFirstMonthCommissions(
      [cliente({ cerrado_por_id: "u1", fecha_inicio: "2026-06-01" })],
      rec,
      periodo,
      0,
      noManual
    );
    expect(out).toHaveLength(0);
  });
});
