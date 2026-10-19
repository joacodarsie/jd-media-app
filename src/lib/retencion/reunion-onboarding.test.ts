import { describe, expect, it } from "vitest";
import { correrPasos, inicioDelArranque } from "./reunion-onboarding";

describe("reunión de onboarding", () => {
  it("el arranque se cuenta desde la reunión si está cargada", () => {
    expect(inicioDelArranque({ onboarding_reunion: "2026-10-22", fecha_inicio: "2026-10-15" })).toBe("2026-10-22");
    expect(inicioDelArranque({ onboarding_reunion: null, fecha_inicio: "2026-10-15" })).toBe("2026-10-15");
  });
  it("corre los pasos abiertos los mismos días; lo hecho queda", () => {
    const r = correrPasos(
      [
        { id: "a", estado: "pendiente", fecha_limite: "2026-10-16" },
        { id: "b", estado: "completada", fecha_limite: "2026-10-17" },
        { id: "c", estado: "en_progreso", fecha_limite: "2026-10-30" },
        { id: "d", estado: "pendiente", fecha_limite: null },
      ],
      "2026-10-15",
      "2026-10-22"
    );
    expect(r).toEqual([
      { id: "a", fecha_limite: "2026-10-23" },
      { id: "c", fecha_limite: "2026-11-06" },
    ]);
    expect(correrPasos([{ id: "a", estado: "pendiente", fecha_limite: "2026-10-16" }], "2026-10-15", "2026-10-15")).toEqual([]);
  });
});
