import { describe, expect, it } from "vitest";
import { paraSeguirPorCampania, seguimientoAgotado, seguimientoQueToca } from "./seguimiento";

const ahora = new Date("2026-10-07T12:00:00Z");

describe("seguimientoQueToca", () => {
  it("a los 3 días del primer mensaje toca el 1", () => {
    expect(seguimientoQueToca({ estado: "contactado", contactado_at: "2026-10-04T10:00:00Z" }, ahora)).toBe(1);
    expect(seguimientoQueToca({ estado: "contactado", contactado_at: "2026-10-05T10:00:00Z" }, ahora)).toBeNull();
  });

  it("el 2 cuenta desde el último seguimiento", () => {
    const c = { estado: "contactado", contactado_at: "2026-09-20T10:00:00Z", seguimientos: 1 };
    expect(seguimientoQueToca({ ...c, seguimiento_at: "2026-10-05T10:00:00Z" }, ahora)).toBeNull();
    expect(seguimientoQueToca({ ...c, seguimiento_at: "2026-10-03T10:00:00Z" }, ahora)).toBe(2);
  });

  it("después de dos, no insiste más", () => {
    expect(
      seguimientoQueToca(
        { estado: "contactado", contactado_at: "2026-09-01T00:00:00Z", seguimientos: 2, seguimiento_at: "2026-09-10T00:00:00Z" },
        ahora
      )
    ).toBeNull();
  });

  it("solo a los que no contestaron", () => {
    expect(seguimientoQueToca({ estado: "interesado", contactado_at: "2026-09-01T00:00:00Z" }, ahora)).toBeNull();
    expect(seguimientoQueToca({ estado: "nuevo", contactado_at: null }, ahora)).toBeNull();
  });
});

describe("seguimientoAgotado", () => {
  it("dos seguimientos y 3 días sin respuesta", () => {
    const c = { estado: "contactado", contactado_at: "2026-09-01T00:00:00Z", seguimientos: 2 };
    expect(seguimientoAgotado({ ...c, seguimiento_at: "2026-10-01T00:00:00Z" }, ahora)).toBe(true);
    expect(seguimientoAgotado({ ...c, seguimiento_at: "2026-10-06T00:00:00Z" }, ahora)).toBe(false);
    expect(seguimientoAgotado({ ...c, seguimientos: 1, seguimiento_at: "2026-10-01T00:00:00Z" }, ahora)).toBe(false);
  });
});

describe("paraSeguirPorCampania", () => {
  it("cuenta por campaña, la más cargada primero, y separa los míos", () => {
    const viejo = { estado: "contactado", contactado_at: "2026-09-30T00:00:00Z" };
    const r = paraSeguirPorCampania(
      [
        { ...viejo, campaign_id: "a", asignado_a: "mati" },
        { ...viejo, campaign_id: "b", asignado_a: "mati" },
        { ...viejo, campaign_id: "b", asignado_a: "santi" },
        { estado: "contactado", contactado_at: "2026-10-06T00:00:00Z", campaign_id: "a" },
      ],
      ahora,
      "mati"
    );
    expect(r).toEqual([
      { campaignId: "b", total: 2, mios: 1 },
      { campaignId: "a", total: 1, mios: 1 },
    ]);
  });
});
