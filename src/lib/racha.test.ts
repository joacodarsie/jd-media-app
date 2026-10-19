import { describe, expect, it } from "vitest";
import { proximoHito, rachaDias } from "./racha";

const t = (fecha: string, estado: string, cerrada: string | null = null, bloqueo: string | null = null) => ({
  fecha_limite: fecha,
  estado,
  fecha_completada: cerrada,
  bloqueo,
});

describe("racha de Mi día", () => {
  // 2026-10-19 es lunes.
  it("cuenta días hábiles seguidos con todo cerrado a tiempo", () => {
    const r = rachaDias(
      [
        t("2026-10-16", "completada", "2026-10-16T15:00:00Z"), // viernes
        t("2026-10-15", "completada", "2026-10-15T15:00:00Z"),
        t("2026-10-14", "completada", "2026-10-16T15:00:00Z"), // tarde: corta
      ],
      "2026-10-19"
    );
    expect(r).toBe(2);
  });
  it("los días sin nada no cortan; hoy suma solo si está todo", () => {
    const base = [t("2026-10-14", "completada", "2026-10-14T12:00:00Z")];
    expect(rachaDias([...base, t("2026-10-19", "pendiente")], "2026-10-19")).toBe(1);
    expect(rachaDias([...base, t("2026-10-19", "completada", "2026-10-19T13:00:00Z")], "2026-10-19")).toBe(2);
  });
  it("una vencida sin cerrar corta; una trabada no", () => {
    expect(rachaDias([t("2026-10-16", "pendiente"), t("2026-10-15", "completada", "2026-10-15T12:00:00Z")], "2026-10-19")).toBe(0);
    expect(rachaDias([t("2026-10-16", "pendiente", null, "cliente")], "2026-10-19")).toBe(1);
  });
  it("hitos", () => {
    expect(proximoHito(0)).toBe(3);
    expect(proximoHito(5)).toBe(10);
    expect(proximoHito(60)).toBeNull();
  });
});
