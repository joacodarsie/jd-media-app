import { describe, it, expect } from "vitest";
import { DEFAULT_AGENCY_SETTINGS } from "@/lib/coordinacion";
import {
  filasClientes,
  filasEquipo,
  piezasDelServicio,
  mesesDeAntiguedad,
  cuadres,
  asPack,
  type ServicioInforme,
} from "./informe-mensual";

const settings = DEFAULT_AGENCY_SETTINGS;

const svc = (over: Partial<ServicioInforme> = {}): ServicioInforme => ({
  cliente: "Impermax",
  clienteId: "c1",
  tipo: "gestion_redes",
  pack: "Presencia",
  monto_mensual: 350_000,
  moneda: "ARS",
  costo_override: null,
  costo_pct: null,
  costo_override_user: null,
  media_buyer_aplica: true,
  pack_detalle: null,
  desde: "2026-07-01",
  ...over,
});

describe("asPack", () => {
  it("un pack desconocido cae en Personalizado, no rompe", () => {
    expect(asPack("Presencia")).toBe("Presencia");
    expect(asPack("lo-que-sea")).toBe("Personalizado");
    expect(asPack(null)).toBe("Personalizado");
  });
});

describe("piezasDelServicio", () => {
  it("saca las piezas del pack de lista", () => {
    expect(piezasDelServicio(svc(), settings.packs)).toEqual({ posts: 4, reels: 4, portadas: 4 });
  });

  it("el detalle cargado a mano le gana al pack", () => {
    const p = piezasDelServicio(
      svc({ pack: "Personalizado", pack_detalle: { posts: 2, reels: 6, portadas: 3 } }),
      settings.packs
    );
    expect(p).toEqual({ posts: 2, reels: 6, portadas: 3 });
  });

  it("sin portadas en el detalle, se asume una por reel", () => {
    const p = piezasDelServicio(
      svc({ pack: "Personalizado", pack_detalle: { posts: 1, reels: 5 } }),
      settings.packs
    );
    expect(p.portadas).toBe(5);
  });

  it("un pack que no existe no inventa piezas", () => {
    expect(piezasDelServicio(svc({ pack: "Fantasma" }), settings.packs)).toEqual({
      posts: 0,
      reels: 0,
      portadas: 0,
    });
  });
});

describe("mesesDeAntiguedad", () => {
  it("cuenta el mes de arranque como el mes 1", () => {
    expect(mesesDeAntiguedad("2026-09-15", "2026-09")).toBe(1);
    expect(mesesDeAntiguedad("2026-07-01", "2026-09")).toBe(3);
  });

  it("cruza el año", () => {
    expect(mesesDeAntiguedad("2025-11-01", "2026-02")).toBe(4);
  });

  it("sin fecha de inicio no inventa una antigüedad", () => {
    expect(mesesDeAntiguedad(null, "2026-09")).toBeNull();
  });
});

describe("filasClientes", () => {
  it("usa el mismo modelo que el cotizador", () => {
    const [f] = filasClientes([svc({ monto_mensual: 400_000 })], settings, "2026-09");
    // CM 50.000 + diseño 32.000 + edición 60.000 + portadas 8.000 +
    // media buyer 50.000 + coordinación de diseño 2.000 = 202.000
    expect(f.costoEntrega).toBe(202_000);
    expect(f.coordinacion).toBe(40_000); // 10% del abono
    expect(f.margen).toBe(158_000);
    expect(Math.round(f.margenPct)).toBe(40);
  });

  it("una cuenta sin pauta no paga media buyer", () => {
    const [f] = filasClientes([svc({ media_buyer_aplica: false })], settings, "2026-09");
    expect(f.costoEntrega).toBe(152_000);
  });

  it("la pauta sola solo cuesta el media buyer", () => {
    const [f] = filasClientes(
      [svc({ tipo: "paid_media", pack: null, monto_mensual: 150_000 })],
      settings,
      "2026-09"
    );
    expect(f.costoEntrega).toBe(settings.rates.media_buyer.Personalizado);
    expect(f.servicio).toBe("Gestión de pauta");
  });

  it("🔴 ordena de mejor a peor margen: arriba lo que deja, abajo lo que hay que renegociar", () => {
    const filas = filasClientes(
      [
        svc({ cliente: "Boxescar", monto_mensual: 250_000 }),
        svc({ cliente: "Origen", tipo: "paid_media", pack: null, monto_mensual: 150_000 }),
        svc({ cliente: "FUNDANIC", monto_mensual: 370_000 }),
      ],
      settings,
      "2026-09"
    );
    expect(filas[0].cliente).toBe("Origen");
    expect(filas[filas.length - 1].cliente).toBe("Boxescar");
  });

  it("un servicio sin abono no divide por cero", () => {
    const [f] = filasClientes([svc({ monto_mensual: null })], settings, "2026-09");
    expect(f.margenPct).toBe(0);
    expect(f.margen).toBeLessThan(0);
  });
});

describe("filasEquipo", () => {
  const pagos = [
    { persona: "Luz", periodo: "2026-08", montoARS: 638_500 },
    { persona: "Luz", periodo: "2026-09", montoARS: 500_000 },
    { persona: "Darío", periodo: "2026-09", montoARS: 46_000 },
    { persona: "Viejo", periodo: "2026-01", montoARS: 999_999 },
  ];

  it("pivotea por persona y mes, y ordena por total", () => {
    const filas = filasEquipo(pagos, ["2026-08", "2026-09"]);
    expect(filas.map((f) => f.persona)).toEqual(["Luz", "Darío"]);
    expect(filas[0].total).toBe(1_138_500);
    expect(filas[0].porMes["2026-08"]).toBe(638_500);
  });

  it("ignora los meses fuera de la ventana pedida", () => {
    const filas = filasEquipo(pagos, ["2026-08", "2026-09"]);
    expect(filas.some((f) => f.persona === "Viejo")).toBe(false);
  });
});

describe("cuadres", () => {
  it("cierra cuando las dos hojas dicen lo mismo", () => {
    const c = cuadres({
      entroResumen: 3_235_000,
      sumaCobrosDelMes: 3_235_000,
      equipoResumen: 1_732_800,
      sumaEquipoDelMes: 1_732_800,
      fijosResumen: 663_759,
      sumaFijosDelMes: 663_759,
    });
    expect(c.every((x) => x.cierra)).toBe(true);
  });

  it("🔴 avisa cuál hoja no coincide, en vez de esconderlo", () => {
    const c = cuadres({
      entroResumen: 3_235_000,
      sumaCobrosDelMes: 3_000_000,
      equipoResumen: 1_732_800,
      sumaEquipoDelMes: 1_732_800,
      fijosResumen: 663_759,
      sumaFijosDelMes: 663_759,
    });
    const roto = c.filter((x) => !x.cierra);
    expect(roto).toHaveLength(1);
    expect(roto[0].concepto).toBe("Lo que entró");
    expect(roto[0].hojaB).toBe("Cobros");
  });

  it("un peso de diferencia por redondeo no cuenta como error", () => {
    const c = cuadres({
      entroResumen: 3_235_000.4,
      sumaCobrosDelMes: 3_235_000,
      equipoResumen: 0,
      sumaEquipoDelMes: 0,
      fijosResumen: 0,
      sumaFijosDelMes: 0,
    });
    expect(c[0].cierra).toBe(true);
  });
});
