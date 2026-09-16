import { describe, expect, it } from "vitest";
import {
  normalizarCampania,
  primerObjeto,
  CANAL_POR_DEFECTO,
  IDIOMA_POR_DEFECTO,
} from "./campania-desde-texto";

const SLUGS = ["gestion_redes", "paid_media", "diseno_grafico"];

const completa = {
  nombre: "Casas de tecnología Córdoba",
  rubro: "casas de electrónica y tecnología",
  ubicacion: "Córdoba, Argentina",
  servicio: "gestion_redes",
  angulo: "Venden por mostrador y no muestran el catálogo en redes.",
  canal: "instagram",
  idioma: "es_ar",
};

describe("normalizarCampania", () => {
  it("toma la ficha completa tal cual", () => {
    expect(normalizarCampania(completa, SLUGS)).toEqual(completa);
  });

  it("sin rubro no hay campaña", () => {
    expect(normalizarCampania({ ...completa, rubro: "  " }, SLUGS)).toBeNull();
    expect(normalizarCampania(null, SLUGS)).toBeNull();
  });

  it("arma el nombre con rubro y ciudad cuando el modelo no lo trae", () => {
    const r = normalizarCampania({ ...completa, nombre: null }, SLUGS)!;
    expect(r.nombre).toBe("casas de electrónica y tecnología Córdoba");
  });

  it("descarta un servicio que no existe en el catálogo", () => {
    expect(normalizarCampania({ ...completa, servicio: "seo_local" }, SLUGS)!.servicio).toBeNull();
  });

  it("cae en WhatsApp y español de Argentina si el canal o el idioma no existen", () => {
    const r = normalizarCampania({ ...completa, canal: "telegram", idioma: "pt" }, SLUGS)!;
    expect(r.canal).toBe(CANAL_POR_DEFECTO);
    expect(r.idioma).toBe(IDIOMA_POR_DEFECTO);
  });

  it("recorta lo que viene larguísimo", () => {
    const r = normalizarCampania({ ...completa, rubro: "x".repeat(300) }, SLUGS)!;
    expect(r.rubro).toHaveLength(120);
  });
});

describe("primerObjeto", () => {
  it("saca el JSON aunque venga con texto alrededor", () => {
    expect(primerObjeto('Listo:\n```json\n{"rubro":"gimnasios"}\n```')).toEqual({ rubro: "gimnasios" });
  });

  it("devuelve null si no hay JSON", () => {
    expect(primerObjeto("no pude")).toBeNull();
    expect(primerObjeto("{roto")).toBeNull();
  });
});
