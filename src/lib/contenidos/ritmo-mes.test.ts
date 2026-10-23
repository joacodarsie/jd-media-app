import { describe, expect, it } from "vitest";
import { ritmoCuenta, ritmoDelMes, tendencia, type PubRitmo } from "./ritmo-mes";

const p = (fecha: string, estado: string, extra: Partial<PubRitmo> = {}): PubRitmo => ({
  clienteId: "c1",
  cliente: "CATCH",
  estado,
  fecha,
  frenadoCliente: false,
  ...extra,
});

describe("ritmo del mes", () => {
  const hoy = "2026-10-23";

  it("cuenta atrasadas, esperando al cliente y en riesgo por separado", () => {
    const r = ritmoCuenta(
      [
        p("2026-10-10", "publicado"),
        p("2026-10-12", "edicion"),
        p("2026-10-13", "aprobado"),
        p("2026-10-14", "en_diseno", { frenadoCliente: true }),
        p("2026-10-15", "revision_cliente"),
        p("2026-10-25", "idea"),
        p("2026-10-24", "en_diseno"),
        p("2026-10-28", "en_diseno"),
        p("2026-10-31", "idea"),
        p("2026-10-20", "rechazado"),
      ],
      hoy
    );
    expect(r).toMatchObject({ plan: 9, deberian: 5, salieron: 1, atrasadas: 2, esperandoCliente: 2, enRiesgo: 2, estado: "atrasada" });
  });

  it("una sola atrasada no pinta la cuenta de rojo", () => {
    expect(ritmoCuenta([p("2026-10-20", "edicion")], hoy)).toMatchObject({ atrasadas: 1, estado: "al_dia" });
  });

  it("hoy todavía no cuenta como atrasada", () => {
    expect(ritmoCuenta([p(hoy, "aprobado")], hoy)).toMatchObject({ deberian: 0, atrasadas: 0, estado: "al_dia" });
  });

  it("dos sin arrancar en la semana la ponen en riesgo; una sola no", () => {
    expect(ritmoCuenta([p("2026-10-26", "idea")], hoy).estado).toBe("al_dia");
    expect(ritmoCuenta([p("2026-10-26", "idea"), p("2026-10-27", "guion")], hoy).estado).toBe("en_riesgo");
  });

  it("ordena la peor primero", () => {
    const l = ritmoDelMes(
      [p("2026-10-26", "idea", { clienteId: "b", cliente: "B" }), p("2026-10-27", "idea", { clienteId: "b", cliente: "B" }), p("2026-10-01", "publicado", { clienteId: "a", cliente: "A" }), p("2026-10-02", "edicion", { clienteId: "c", cliente: "C" }), p("2026-10-03", "idea", { clienteId: "c", cliente: "C" })],
      hoy
    );
    expect(l.map((r) => [r.cliente, r.estado])).toEqual([
      ["C", "atrasada"],
      ["B", "en_riesgo"],
      ["A", "al_dia"],
    ]);
  });

  it("cumplimiento: lo que salió de lo que ya tenía que salir, sin lo que espera al cliente", () => {
    const r = ritmoCuenta([p("2026-10-01", "publicado"), p("2026-10-02", "publicado"), p("2026-10-03", "publicado"), p("2026-10-04", "edicion"), p("2026-10-05", "revision_cliente")], hoy);
    expect(r.cumplimiento).toBe(75);
    expect(ritmoCuenta([p("2026-10-01", "publicado"), p("2026-10-02", "edicion")], hoy).cumplimiento).toBeNull();
  });

  it("tendencia: diez puntos para decir que cambió", () => {
    expect(tendencia(80, 60)).toBe("mejor");
    expect(tendencia(50, 75)).toBe("peor");
    expect(tendencia(70, 75)).toBe("igual");
    expect(tendencia(70, null)).toBeNull();
  });
});
