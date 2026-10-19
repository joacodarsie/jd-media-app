import { describe, expect, it } from "vitest";
import { alarmaDe, avisoProducir, cuandoSale, tareaAprobar } from "./alarma-48h";

const p = (estado: string, fecha: string | null) => ({ estado, fecha_publicacion: fecha });

describe("alarma 48 h", () => {
  // 2026-10-19 es lunes.
  it("idea a 2 días o menos: aprobar", () => {
    expect(alarmaDe(p("idea", "2026-10-21"), "2026-10-19")).toBe("aprobar");
    expect(alarmaDe(p("revision_creativa", "2026-10-19T15:00:00Z"), "2026-10-19")).toBe("aprobar");
    expect(alarmaDe(p("idea", "2026-10-22"), "2026-10-19")).toBeNull();
  });
  it("en producción a 1 día o menos: producir", () => {
    expect(alarmaDe(p("en_diseno", "2026-10-20"), "2026-10-19")).toBe("producir");
    expect(alarmaDe(p("edicion", "2026-10-21"), "2026-10-19")).toBeNull();
  });
  it("lo listo, lo pasado y lo sin fecha no alarman", () => {
    expect(alarmaDe(p("aprobado", "2026-10-20"), "2026-10-19")).toBeNull();
    expect(alarmaDe(p("idea", "2026-10-18"), "2026-10-19")).toBeNull();
    expect(alarmaDe(p("idea", null), "2026-10-19")).toBeNull();
  });
  it("textos", () => {
    expect(cuandoSale("2026-10-19", "2026-10-19")).toBe("hoy");
    expect(cuandoSale("2026-10-20", "2026-10-19")).toBe("mañana");
    expect(cuandoSale("2026-10-21", "2026-10-19")).toBe("el miércoles");
    expect(tareaAprobar({ titulo: "Reel 3", cuenta: "Magic", fecha: "2026-10-20", hoy: "2026-10-19", estado: "idea" }).titulo).toBe(
      "⏰ Aprobar ya: «Reel 3» de Magic sale mañana"
    );
    expect(avisoProducir({ titulo: "Reel 3", cuenta: "Magic", fecha: "2026-10-19", hoy: "2026-10-19", estado: "edicion" })).toBe(
      "⏰ «Reel 3» de Magic sale hoy y sigue en edición. Tu tarea pasó a urgente."
    );
  });
});
