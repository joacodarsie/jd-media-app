import { describe, it, expect } from "vitest";
import {
  hrefDePanel,
  panelDeEntrada,
  panelesVisibles,
  PANELES,
  type ServiciosDeLaCuenta,
} from "./paneles";

const REDES: ServiciosDeLaCuenta = {
  gestionRedes: true,
  disenoGrafico: false,
  paidMedia: false,
};
const SOLO_PAUTA: ServiciosDeLaCuenta = {
  gestionRedes: false,
  disenoGrafico: false,
  paidMedia: true,
};
const SOLO_DISENO: ServiciosDeLaCuenta = {
  gestionRedes: false,
  disenoGrafico: true,
  paidMedia: false,
};

const keys = (roles: (string | null)[], svc: ServiciosDeLaCuenta) =>
  panelesVisibles(roles, svc).map((p) => p.key);

describe("panelesVisibles", () => {
  it("la dirección ve todas las de una cuenta de redes", () => {
    expect(keys(["admin"], REDES)).toEqual(["inicial", "redes", "cm", "diseno", "pauta"]);
  });

  it("la coordinación no entra a la inicial: ahí está la carta acuerdo", () => {
    expect(keys(["coordinador"], REDES)).toEqual(["redes", "cm", "diseno", "pauta"]);
  });

  it("la CM solo ve la suya", () => {
    expect(keys(["community_manager"], REDES)).toEqual(["cm"]);
  });

  it("diseño solo ve la suya", () => {
    expect(keys(["diseno"], REDES)).toEqual(["diseno"]);
    expect(keys(["coordinador_diseno"], REDES)).toEqual(["diseno"]);
  });

  it("el media buyer solo ve publicidad", () => {
    expect(keys(["paid_media"], REDES)).toEqual(["pauta"]);
  });

  it("un rol sin nada acá no ve ninguna", () => {
    expect(keys(["audiovisual"], REDES)).toEqual([]);
    expect(keys([null], REDES)).toEqual([]);
  });

  it("los roles dobles suman permisos", () => {
    expect(keys(["community_manager", "diseno"], REDES)).toEqual(["cm", "diseno"]);
  });
});

describe("los servicios de la cuenta filtran", () => {
  it("una cuenta de solo pauta no lleva redes, community ni diseño", () => {
    expect(keys(["admin"], SOLO_PAUTA)).toEqual(["inicial", "pauta"]);
  });

  it("una cuenta de solo diseño gráfico lleva diseño pero no community", () => {
    expect(keys(["admin"], SOLO_DISENO)).toEqual(["inicial", "diseno"]);
  });

  it("gestión de redes ya incluye el paid media básico, así que publicidad entra", () => {
    expect(keys(["paid_media"], REDES)).toEqual(["pauta"]);
  });

  it("sin paid media ni redes, el media buyer no ve nada", () => {
    expect(keys(["paid_media"], SOLO_DISENO)).toEqual([]);
  });
});

describe("panelDeEntrada", () => {
  it("es la primera que puede abrir", () => {
    expect(panelDeEntrada(["admin"], REDES)?.key).toBe("inicial");
    expect(panelDeEntrada(["coordinador"], REDES)?.key).toBe("redes");
    expect(panelDeEntrada(["paid_media"], REDES)?.key).toBe("pauta");
  });

  it("si no puede abrir ninguna, no hay botón", () => {
    expect(panelDeEntrada(["audiovisual"], REDES)).toBeNull();
  });
});

describe("hrefDePanel", () => {
  it("la inicial y la de publicidad viven fuera de /onboarding/<key>", () => {
    expect(hrefDePanel("c1", "inicial")).toBe("/clientes/c1/onboarding");
    expect(hrefDePanel("c1", "pauta")).toBe("/clientes/c1/pauta");
  });

  it("las otras tres son /onboarding/<key>", () => {
    expect(hrefDePanel("c1", "redes")).toBe("/clientes/c1/onboarding/redes");
    expect(hrefDePanel("c1", "cm")).toBe("/clientes/c1/onboarding/cm");
    expect(hrefDePanel("c1", "diseno")).toBe("/clientes/c1/onboarding/diseno");
  });

  it("todas las pantallas tienen ruta", () => {
    for (const p of PANELES) expect(hrefDePanel("c1", p.key)).toContain("/clientes/c1");
  });
});
