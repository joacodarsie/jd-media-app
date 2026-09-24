import { describe, it, expect } from "vitest";
import { getDeliverables } from "./service-deliverables";
import { esMarcaReal, MARCA_REAL } from "./pack-marca-real";
import type { ClientService } from "./types";

const svc = (over: Partial<ClientService>): ClientService =>
  ({
    id: "s",
    cliente_id: "c",
    tipo: "branding",
    pack: null,
    fecha_inicio: null,
    fecha_fin: null,
    monto_mensual: MARCA_REAL.precio,
    moneda: "ARS",
    facturacion: "unico",
    pack_detalle: {},
    notas: null,
    activo: true,
    responsables: [],
    created_at: "",
    updated_at: "",
    ...over,
  }) as ClientService;

describe("Pack Marca Real en la carta acuerdo", () => {
  it("solo es Marca Real un branding con ese pack", () => {
    expect(esMarcaReal(svc({ pack: "Marca Real" }))).toBe(true);
    expect(esMarcaReal(svc({ pack: null }))).toBe(false);
    expect(esMarcaReal(svc({ tipo: "gestion_redes", pack: "Marca Real" }))).toBe(false);
  });

  it("detalla lo del posteo de lanzamiento y las condiciones que el posteo no dice", () => {
    const d = getDeliverables(svc({ pack: "Marca Real" })).join("\n");
    expect(d).toContain("Logo: 2 propuestas");
    expect(d).toContain("Paleta de colores y tipografías");
    expect(d).toContain("Perfil de Instagram armado");
    expect(d).toContain("Plantilla de calendario");
    expect(d).toContain("30 ideas de contenido");
    expect(d).toContain("2 rondas de cambios");
    expect(d).toContain("10 días hábiles");
    expect(d).toContain("No incluye la publicación de contenido");
  });

  it("el branding a medida sigue con su alcance de siempre", () => {
    const d = getDeliverables(svc({ pack: null })).join("\n");
    expect(d).toContain("Estrategia de marca");
    expect(d).not.toContain("30 ideas");
  });
});

describe("gestión de redes sin pauta", () => {
  it("la carta no promete la gestión de campañas si no está incluida", () => {
    const con = getDeliverables(svc({ tipo: "gestion_redes", pack: "Presencia", facturacion: "mensual" }));
    const sin = getDeliverables({
      ...svc({ tipo: "gestion_redes", pack: "Presencia", facturacion: "mensual" }),
      media_buyer_aplica: false,
    } as ClientService);
    expect(con.join("\n")).toContain("Gestión básica de campañas");
    expect(con[7]).toContain("Gestión básica de campañas");
    expect(sin.join("\n")).not.toContain("Gestión básica de campañas");
    expect(sin.length).toBe(con.length - 1);
  });
});
