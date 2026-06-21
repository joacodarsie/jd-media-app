import { describe, it, expect } from "vitest";
import {
  computeAutoPayroll,
  closerVolumeBonusPct,
  selectFirstMonthCommissions,
  encodeCommissionNote,
  decodeCommissionNote,
  type PayrollClient,
  type PayrollService,
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
  it("reparte CM, diseño y edición a cada persona asignada", () => {
    const out = computeAutoPayroll(
      [cliente({ cm_id: "cm1", disenador_id: "dis1", audiovisual_id: "av1" })],
      [servicio()],
      r,
      null
    );
    expect(out.get("cm1")?.[0].monto).toBe(r.cm.Presencia);
    expect(out.get("dis1")?.[0].monto).toBe(4 * r.diseno_pieza);
    expect(out.get("av1")?.[0].monto).toBe(4 * r.edicion_reel);
  });

  it("el acuerdo fijo (override) reemplaza CM/diseño/edición", () => {
    const out = computeAutoPayroll(
      [cliente({ cm_id: "cm1", disenador_id: "dis1", audiovisual_id: "av1" })],
      [servicio({ costo_override: 120_000, costo_override_user: "u1" })],
      r,
      null
    );
    expect(out.get("u1")?.[0].monto).toBe(120_000);
    expect(out.get("u1")?.[0].kind).toBe("override");
    // No se generan las líneas separadas.
    expect(out.has("cm1")).toBe(false);
    expect(out.has("dis1")).toBe(false);
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
