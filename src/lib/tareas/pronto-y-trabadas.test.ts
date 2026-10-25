import { describe, expect, it } from "vitest";
import { cuandoVence, trabadas, vencenPronto, type TareaParaMirar } from "./pronto-y-trabadas";

const tarea = (id: string, extra: Partial<TareaParaMirar> = {}): TareaParaMirar => ({
  id,
  titulo: id,
  estado: "pendiente",
  fecha_limite: null,
  asignado_a_id: "luz",
  ...extra,
});

describe("vence pronto y trabadas", () => {
  it("dice cuándo vence en palabras", () => {
    expect(cuandoVence("2026-10-24", "2026-10-24")).toBe("Vence hoy");
    expect(cuandoVence("2026-10-25", "2026-10-24")).toBe("Vence mañana");
    expect(cuandoVence("2026-10-26", "2026-10-24")).toBe("Vence pasado mañana");
    expect(cuandoVence("2026-10-27", "2026-10-24")).toBe("Vence en 3 días");
  });

  it("solo las abiertas de hoy a 3 días, de la más urgente a la menos", () => {
    const r = vencenPronto(
      [
        tarea("c", { fecha_limite: "2026-10-27" }),
        tarea("a", { fecha_limite: "2026-10-24" }),
        tarea("vieja", { fecha_limite: "2026-10-20" }), // vencida: va en otro lado
        tarea("lejos", { fecha_limite: "2026-10-30" }),
        tarea("hecha", { fecha_limite: "2026-10-25", estado: "completada" }),
        tarea("b", { fecha_limite: "2026-10-25" }),
      ],
      "2026-10-24"
    );
    expect(r.map((x) => [x.id, x.cuando])).toEqual([
      ["a", "Vence hoy"],
      ["b", "Vence mañana"],
      ["c", "Vence en 3 días"],
    ]);
  });

  it("trabadas: aprobación, otra persona y cliente", () => {
    const nombres: Record<string, string> = { santi: "Santiago", bri: "Brisa" };
    const r = trabadas(
      [
        tarea("cliente", { bloqueo: "cliente" }),
        tarea("persona", { bloqueo: "persona", bloqueo_esperando_id: "bri" }),
        tarea("aprobar", { estado: "en_revision", aprobador_id: "santi" }),
        tarea("libre"),
        tarea("cerrada", { bloqueo: "cliente", estado: "completada" }),
      ],
      (id) => nombres[id] ?? null
    );
    expect(r.map((x) => [x.id, x.espera])).toEqual([
      ["aprobar", "Lo aprueba Santiago"],
      ["persona", "Espera a Brisa"],
      ["cliente", "Espera al cliente"],
    ]);
  });
});
