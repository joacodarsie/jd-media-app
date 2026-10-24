import { describe, expect, it } from "vitest";
import { avisoVencimiento } from "./aviso-run";
import { estadoCalendario, mesesCreativos, pasosCreativos, textoVigencia, vigencia } from "./creativa";

describe("área creativa", () => {
  it("la vigencia de un documento: vence a los N días y avisa 7 antes", () => {
    expect(vigencia("2026-10-01", 90, "2026-10-23")).toEqual({ vence: "2026-12-30", diasRestantes: 68, estado: "vigente" });
    const v = vigencia("2026-07-30", 90, "2026-10-23");
    expect(v).toEqual({ vence: "2026-10-28", diasRestantes: 5, estado: "por_vencer" });
    expect(textoVigencia(v)).toBe("Vence en 5 días — replantear estrategia");
    expect(textoVigencia(vigencia("2026-07-01", 90, "2026-10-23"))).toBe("Venció hace 24 días — replantear estrategia");
    expect(vigencia(null, 90, "2026-10-23").estado).toBe("sin_vigencia");
  });

  it("el calendario del mes: aprobado cuando no queda ninguna idea", () => {
    expect(estadoCalendario(["aprobado", "publicado", "en_diseno"]).estado).toBe("aprobado");
    expect(estadoCalendario(["idea", "idea", "aprobado"])).toEqual({ estado: "pendiente", porAprobar: 2, total: 3 });
    expect(estadoCalendario(["rechazado"]).estado).toBe("sin_calendario");
    expect(estadoCalendario([]).estado).toBe("sin_calendario");
  });

  it("el onboarding creativo: cuatro definiciones y tres entregables", () => {
    const vacio = pasosCreativos(null, new Set());
    expect(vacio.map((p) => p.hecho)).toEqual([false, false, false, false, false, false, false]);
    const medios = { instagram: "alta", tiktok: "media", facebook: "baja", whatsapp: "alta", pauta: "media", web: "no" } as const;
    const lleno = pasosCreativos(
      { dc_identidad: "Fabricantes de sillones a medida", dc_tono: "Cercano", dc_medios: medios, dc_urgencia: "crecer" },
      new Set(["plataforma_campana"])
    );
    expect(lleno.filter((p) => p.hecho).map((p) => p.clave)).toEqual(["identidad", "tono", "medios", "urgencia", "plataforma_campana"]);
    // Un medio sin definir deja el paso abierto.
    expect(pasosCreativos({ dc_identidad: null, dc_tono: null, dc_medios: { instagram: "alta" }, dc_urgencia: null }, new Set())[2].hecho).toBe(false);
  });

  it("los meses: el actual y el siguiente (también en diciembre)", () => {
    expect(mesesCreativos("2026-10-23")).toEqual(["2026-10", "2026-11"]);
    expect(mesesCreativos("2026-12-05")).toEqual(["2026-12", "2027-01"]);
  });
});

describe("aviso de vencimiento", () => {
  it("dice qué documento, de quién y cuándo vence", () => {
    expect(avisoVencimiento("Nahuel", "estrategia_redes", "2026-10-28", 7)).toBe("📄 La estrategia de redes de Nahuel vence el 28/10: hora de replantear la estrategia.");
    expect(avisoVencimiento("Nahuel", "plataforma_campana", "2026-10-28", 0)).toBe("📄 La plataforma de campaña de Nahuel vence hoy: hora de replantear la estrategia.");
  });
});
