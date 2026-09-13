import { describe, it, expect } from "vitest";
import {
  agruparEnTickets,
  formatTicket,
  nombreCarpetaDrive,
  parseTicket,
  progresoTicket,
} from "./tickets";

describe("formatTicket", () => {
  it("arma el número visible", () => {
    expect(formatTicket(123)).toBe("JD-123");
    expect(formatTicket(1)).toBe("JD-1");
  });

  it("sin número devuelve null en vez de 'JD-null'", () => {
    expect(formatTicket(null)).toBeNull();
    expect(formatTicket(undefined)).toBeNull();
  });
});

describe("parseTicket", () => {
  it("acepta las cuatro formas en que se escribe a mano", () => {
    expect(parseTicket("JD-123")).toBe(123);
    expect(parseTicket("jd 123")).toBe(123);
    expect(parseTicket("#123")).toBe(123);
    expect(parseTicket("123")).toBe(123);
    expect(parseTicket("  JD-7  ")).toBe(7);
  });

  it("no confunde texto con número de ticket", () => {
    expect(parseTicket("destacadas")).toBeNull();
    expect(parseTicket("JD-")).toBeNull();
    expect(parseTicket("12a")).toBeNull();
    expect(parseTicket("")).toBeNull();
    expect(parseTicket("0")).toBeNull();
  });
});

describe("progresoTicket", () => {
  it("cuenta las subtareas terminadas", () => {
    const p = progresoTicket([
      { estado: "completada" },
      { estado: "completada" },
      { estado: "pendiente" },
      { estado: "en_progreso" },
    ]);
    expect(p.hechas).toBe(2);
    expect(p.total).toBe(4);
    expect(p.pct).toBe(0.5);
    expect(p.sinSubtareas).toBe(false);
  });

  it("archivada cuenta como sacada de circulación, no como pendiente", () => {
    const p = progresoTicket([{ estado: "archivada" }, { estado: "pendiente" }]);
    expect(p.hechas).toBe(1);
  });

  it("un ticket sin desglose no es 0% de avance: es que no tiene desglose", () => {
    const p = progresoTicket([]);
    expect(p.sinSubtareas).toBe(true);
    expect(p.total).toBe(0);
  });
});

describe("nombreCarpetaDrive", () => {
  it("arma el nombre con el número adelante", () => {
    expect(nombreCarpetaDrive(14, "Destacadas")).toBe("JD-14 - Destacadas");
  });

  it("saca las barras, que en Drive arman subcarpetas", () => {
    expect(nombreCarpetaDrive(9, "Reels / Carruseles")).toBe("JD-9 - Reels - Carruseles");
    expect(nombreCarpetaDrive(9, "a\\b")).toBe("JD-9 - a-b");
  });

  it("recorta los títulos largos", () => {
    const largo = "x".repeat(200);
    const out = nombreCarpetaDrive(3, largo);
    expect(out.length).toBeLessThanOrEqual(70);
    expect(out.startsWith("JD-3 - ")).toBe(true);
  });

  it("aguanta que falte el número o el título", () => {
    expect(nombreCarpetaDrive(null, "Destacadas")).toBe("Destacadas");
    expect(nombreCarpetaDrive(5, "   ")).toBe("JD-5");
    expect(nombreCarpetaDrive(null, "  ")).toBe("Sin título");
  });
});

describe("agruparEnTickets", () => {
  const t = (id: string, parent: string | null = null, estado = "pendiente") => ({
    id,
    numero: Number(id.replace(/\D/g, "")) || 1,
    parent_id: parent,
    estado,
  });

  it("mete cada subtarea adentro de su madre", () => {
    const out = agruparEnTickets([t("1"), t("2", "1"), t("3", "1"), t("4")]);
    expect(out).toHaveLength(2);
    expect(out[0].madre.id).toBe("1");
    expect(out[0].subtareas.map((s) => s.id)).toEqual(["2", "3"]);
    expect(out[1].madre.id).toBe("4");
    expect(out[1].subtareas).toEqual([]);
  });

  it("una subtarea cuya madre quedó fuera del filtro NO desaparece", () => {
    // Es trabajo asignado a alguien: esconderlo es peor que mostrarlo suelto.
    const out = agruparEnTickets([t("2", "99")]);
    expect(out).toHaveLength(1);
    expect(out[0].madre.id).toBe("2");
  });

  it("respeta el orden en que vinieron", () => {
    const out = agruparEnTickets([t("5"), t("1"), t("9", "5")]);
    expect(out.map((x) => x.madre.id)).toEqual(["5", "1"]);
  });

  it("con lista vacía no explota", () => {
    expect(agruparEnTickets([])).toEqual([]);
  });
});
