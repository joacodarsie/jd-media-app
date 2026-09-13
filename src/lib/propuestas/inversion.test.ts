import { describe, it, expect } from "vitest";
import {
  armarInversion,
  volumenDePack,
  volumenPrimerMes,
  proporcionalPrimerMes,
  textoJornadas,
  esDeCordoba,
  handleBonito,
} from "./inversion";
import { partirPunto, type PackCatalogo } from "./build";

const pack = (over: Partial<PackCatalogo>): PackCatalogo => ({
  slug: "presencia",
  nombre: "Presencia",
  precio_mensual: 400000,
  descripcion: null,
  reels: 4,
  posts: 4,
  dias_historias: 8,
  ...over,
});

const PRESENCIA = pack({});
const CRECIMIENTO = pack({
  slug: "crecimiento",
  nombre: "Crecimiento",
  precio_mensual: 600000,
  reels: 8,
  posts: 8,
  dias_historias: 12,
});
const PERSONALIZADO = pack({
  slug: "personalizado",
  nombre: "Personalizado",
  precio_mensual: null,
  reels: null,
  posts: null,
  dias_historias: null,
});
const PACKS = [PRESENCIA, CRECIMIENTO, PERSONALIZADO];

describe("volumenDePack", () => {
  it("arma la línea de volumen", () => {
    expect(volumenDePack(CRECIMIENTO)).toBe("8 reels · 8 carruseles · 12 días de historias");
  });

  it("devuelve null para Personalizado, que no tiene volúmenes fijos", () => {
    expect(volumenDePack(PERSONALIZADO)).toBeNull();
  });
});

describe("armarInversion", () => {
  // El caso real: Catch con dos cuentas y $50.000 de descuento.
  const catch2 = [
    { handle: "@barcatch", packSlug: "crecimiento" },
    { handle: "@fyna.club", packSlug: "presencia" },
  ];

  it("suma las dos cuentas y aplica el descuento", () => {
    const inv = armarInversion(catch2, PACKS, 50000);
    expect(inv.subtotal).toBe(1_000_000);
    expect(inv.descuento).toBe(50000);
    expect(inv.total).toBe(950_000);
    expect(inv.hayDescuento).toBe(true);
    expect(inv.lineas.map((l) => l.handle)).toEqual(["@barcatch", "@fyna.club"]);
  });

  it("con una sola cuenta NO hay descuento, aunque se cargue un monto", () => {
    const inv = armarInversion([{ handle: "@uno", packSlug: "presencia" }], PACKS, 50000);
    expect(inv.hayDescuento).toBe(false);
    expect(inv.descuento).toBe(0);
    expect(inv.total).toBe(400_000);
  });

  it("el descuento nunca deja el total en negativo", () => {
    const inv = armarInversion(catch2, PACKS, 99_000_000);
    expect(inv.total).toBe(0);
  });

  it("ignora cuentas con un pack que no existe", () => {
    const inv = armarInversion([{ handle: "@x", packSlug: "fantasma" }], PACKS, 0);
    expect(inv.lineas).toEqual([]);
    expect(inv.total).toBe(0);
  });

  it("marca 'a medida' cuando alguna cuenta va en Personalizado", () => {
    const inv = armarInversion([{ handle: "@x", packSlug: "personalizado" }], PACKS, 0);
    expect(inv.aMedida).toBe(true);
  });
});

describe("volumenPrimerMes", () => {
  it("el primer mes entrega la mitad: las dos primeras semanas son de armado", () => {
    const inv = armarInversion(
      [
        { handle: "@barcatch", packSlug: "crecimiento" },
        { handle: "@fyna.club", packSlug: "presencia" },
      ],
      PACKS,
      0
    );
    expect(volumenPrimerMes(inv.lineas)).toEqual([
      // Crecimiento: 8 reels · 8 carruseles · 12 días de historias → la mitad.
      { handle: "@barcatch", texto: "4 reels, 4 carruseles, 6 días de historias" },
      // Presencia: 4 · 4 · 8 → la mitad.
      { handle: "@fyna.club", texto: "2 reels, 2 carruseles, 4 días de historias" },
    ]);
  });

  it("nunca promete cero de un formato que el pack sí tiene", () => {
    const chico = pack({ slug: "chico", reels: 1, posts: 1, dias_historias: 1 });
    const inv = armarInversion([{ handle: "@x", packSlug: "chico" }], [chico], 0);
    expect(volumenPrimerMes(inv.lineas)[0].texto).toBe("1 reels, 1 carruseles, 1 días de historias");
  });
});

describe("proporcionalPrimerMes", () => {
  it("cobra solo los días que quedan del mes", () => {
    // Del 9 al 30 de septiembre son 22 de 30 días.
    const p = proporcionalPrimerMes(400000, "2026-09-09");
    expect(p).toMatchObject({ dias: 22, diasDelMes: 30, mes: "septiembre" });
    expect(p!.monto).toBe(293_333);
  });

  it("si arranca el 1º no hay proporcional", () => {
    expect(proporcionalPrimerMes(400000, "2026-09-01")).toBeNull();
  });

  it("tolera que no haya fecha o total", () => {
    expect(proporcionalPrimerMes(400000, null)).toBeNull();
    expect(proporcionalPrimerMes(0, "2026-09-09")).toBeNull();
    expect(proporcionalPrimerMes(400000, "no es fecha")).toBeNull();
  });

  it("el último día del mes cobra un solo día", () => {
    expect(proporcionalPrimerMes(300000, "2026-09-30")).toMatchObject({ dias: 1, monto: 10000 });
  });
});

describe("esDeCordoba", () => {
  it("reconoce Córdoba con y sin tilde, y el gran Córdoba", () => {
    for (const c of ["Córdoba", "cordoba capital", "CBA", "Villa Allende", "Río Ceballos", "Carlos Paz"]) {
      expect(esDeCordoba(c), c).toBe(true);
    }
  });

  it("no confunde otras ciudades", () => {
    for (const c of ["Rosario", "Buenos Aires", "Mendoza", "", null]) {
      expect(esDeCordoba(c), String(c)).toBe(false);
    }
  });
});

describe("textoJornadas", () => {
  it("a un prospecto de Córdoba le aclara que NO se le cobra traslado", () => {
    const t = textoJornadas("Córdoba");
    expect(t).toContain("sin cargo de traslado");
    expect(t).not.toContain("más el traslado");
  });

  it("a uno de afuera le dice que el traslado se suma", () => {
    const t = textoJornadas("Rosario");
    expect(t).toContain("más el traslado");
  });

  it("sin ciudad cargada asume que puede haber traslado", () => {
    expect(textoJornadas(null)).toContain("más el traslado");
  });
});

describe("partirPunto", () => {
  it("separa el título de la descripción", () => {
    expect(partirPunto("Cada cuenta con un rol claro: la principal lleva lo institucional.")).toEqual({
      titulo: "Cada cuenta con un rol claro",
      texto: "la principal lleva lo institucional.",
    });
  });

  it("sin dos puntos devuelve todo como texto", () => {
    expect(partirPunto("Armamos la estrategia del mes.")).toEqual({
      titulo: null,
      texto: "Armamos la estrategia del mes.",
    });
  });

  it("no confunde un dos puntos que aparece tarde en la oración", () => {
    const largo = "Trabajamos las tres redes con un mismo criterio y esto es lo que buscamos: consultas.";
    expect(partirPunto(largo).titulo).toBeNull();
  });

  it("tampoco toma como título una frase de más de ocho palabras", () => {
    const s = "Esto que viene ahora es una oración larga que no es un título: y sigue.";
    expect(partirPunto(s).titulo).toBeNull();
  });
});

describe("handleBonito", () => {
  it("convierte la URL de Instagram en el arroba", () => {
    expect(handleBonito("https://www.instagram.com/barcatch/")).toBe("@barcatch");
    expect(handleBonito("instagram.com/fyna.club")).toBe("@fyna.club");
  });

  it("no toca lo que ya viene como arroba o como nombre", () => {
    expect(handleBonito("@barcatch")).toBe("@barcatch");
    expect(handleBonito("Catch")).toBe("Catch");
  });

  it("tolera vacío", () => {
    expect(handleBonito("")).toBe("");
  });
});
