import { describe, it, expect } from "vitest";
import { textoCambio, resumirCambios } from "./cambios-calendario";

const base = { tarde: false, created_at: "2026-10-30T12:00:00Z", user_id: "u1", cliente_id: "c1" };

describe("textoCambio", () => {
  it("cuenta el corrimiento de fecha con el día de la semana", () => {
    expect(textoCambio({ ...base, campo: "fecha", antes: "2026-10-30 12:00", despues: "2026-11-03 12:00", dias: 4 })).toBe(
      "Movió la fecha: vie 30/10 → mar 3/11 (+4 días)"
    );
    expect(textoCambio({ ...base, campo: "fecha", antes: "2026-10-30 12:00", despues: "2026-10-29 12:00", dias: -1 })).toBe(
      "Movió la fecha: vie 30/10 → jue 29/10 (-1 día)"
    );
    expect(textoCambio({ ...base, campo: "fecha", antes: null, despues: "2026-10-29 12:00", dias: null })).toBe(
      "Movió la fecha: sin fecha → jue 29/10"
    );
  });

  it("nombra las etapas como en el calendario", () => {
    expect(textoCambio({ ...base, campo: "estado", antes: "en_diseno", despues: "revision_creativa", dias: null })).toBe(
      "Pasó de En diseño a Revisión creativa"
    );
  });
});

describe("resumirCambios", () => {
  it("cuenta piezas corridas, días, último momento y quién", () => {
    const r = resumirCambios([
      { ...base, publication_id: "p1", campo: "fecha", antes: "a", despues: "b", dias: 2, tarde: true },
      { ...base, publication_id: "p1", campo: "fecha", antes: "b", despues: "c", dias: 3 },
      { ...base, publication_id: "p2", campo: "fecha", antes: "a", despues: "b", dias: -1, user_id: "u2" },
      { ...base, publication_id: "p3", campo: "fecha", antes: "a", despues: "b", dias: 1, cliente_id: "c2", user_id: null },
      { ...base, publication_id: "p3", campo: "estado", antes: "idea", despues: "en_diseno", dias: null },
    ]);
    expect(r.corridas).toBe(2);
    expect(r.diasCorridos).toBe(6);
    expect(r.ultimoMomento).toBe(1);
    expect(r.totalCambiosFecha).toBe(4);
    expect(r.porCuenta).toEqual([{ id: "c1", veces: 2 }, { id: "c2", veces: 1 }]);
    expect(r.porPersona).toEqual([{ id: "u1", veces: 2 }]);
  });
});
