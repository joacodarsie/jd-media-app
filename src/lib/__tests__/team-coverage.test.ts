import { describe, it, expect } from "vitest";
import { missingTeam } from "../team-coverage";

const nadie = { cm_id: null, disenador_id: null, audiovisual_id: null };
const svc = (tipo: string, over: Partial<{ activo: boolean; facturacion: string | null; costo_override: number | null }> = {}) => ({
  tipo,
  activo: over.activo ?? true,
  facturacion: over.facturacion ?? "mensual",
  costo_override: over.costo_override ?? null,
});

describe("missingTeam", () => {
  it("gestión de redes sin equipo: pide CM, diseño y edición", () => {
    expect(missingTeam(nadie, [svc("gestion_redes")])).toEqual(["CM", "diseño", "edición"]);
  });

  it("branding/diseño gráfico: SOLO pide diseño (no editor ni CM)", () => {
    expect(missingTeam(nadie, [svc("branding")])).toEqual(["diseño"]);
    expect(missingTeam(nadie, [svc("diseno_grafico")])).toEqual(["diseño"]);
  });

  it("cuenta completa: no falta nada", () => {
    const c = { cm_id: "a", disenador_id: "b", audiovisual_id: "c" };
    expect(missingTeam(c, [svc("gestion_redes")])).toEqual([]);
  });

  it("gestión con acuerdo fijo: no exige equipo (el fijo cubre todo)", () => {
    expect(missingTeam(nadie, [svc("gestion_redes", { costo_override: 100000 })])).toEqual([]);
  });

  it("servicios inactivos no cuentan", () => {
    expect(missingTeam(nadie, [svc("gestion_redes", { activo: false })])).toEqual([]);
  });

  it("solo reporta el rol que falta", () => {
    const c = { cm_id: "a", disenador_id: null, audiovisual_id: "c" };
    expect(missingTeam(c, [svc("gestion_redes")])).toEqual(["diseño"]);
  });

  it("gestión + diseño standalone: no duplica 'diseño'", () => {
    expect(missingTeam(nadie, [svc("gestion_redes"), svc("diseno_grafico")])).toEqual([
      "CM",
      "diseño",
      "edición",
    ]);
  });
});
