import { describe, it, expect } from "vitest";
import {
  conciliar,
  similitud,
  normalizarTexto,
  matchesAutomaticos,
  matchesADudar,
  resumirConciliacion,
  type PiezaConciliable,
  type MediaIg,
} from "./conciliar";

const RANGO = { desde: "2026-08-01", hasta: "2026-08-31" };

function pieza(p: Partial<PiezaConciliable> = {}): PiezaConciliable {
  return {
    id: "p1",
    titulo: "Pieza",
    copy: null,
    tipo: "post",
    red: "instagram",
    estado: "idea",
    fecha_publicacion: "2026-08-05T13:00:00+00:00",
    ...p,
  };
}

function media(m: Partial<MediaIg> = {}): MediaIg {
  return {
    id: "m1",
    caption: null,
    media_type: "IMAGE",
    permalink: "https://instagram.com/p/abc",
    timestamp: "2026-08-05T16:00:00+0000",
    ...m,
  };
}

describe("normalizarTexto", () => {
  it("saca acentos, emojis, hashtags y puntuación", () => {
    expect(normalizarTexto("¡Hola! 🥐 Ubicación #medialunas")).toBe("hola ubicacion");
  });

  it("tolera vacío", () => {
    expect(normalizarTexto(null)).toBe("");
  });
});

describe("similitud", () => {
  const copy = "Las mejores medialunas y la mejor ubicación. ¡Te esperamos en San Francisco!";

  it("da 1 cuando el caption es el copy con hashtags agregados", () => {
    expect(similitud(copy, `${copy}\n\n#medialunas #cordoba`)).toBe(1);
  });

  it("da 1 cuando el caption viene recortado (la API corta a 300)", () => {
    expect(similitud(copy, copy.slice(0, 60) + "…")).toBe(1);
  });

  it("da bajo entre textos distintos", () => {
    expect(similitud(copy, "Polarizados 3M con colocación profesional para tu auto")).toBeLessThan(
      0.3,
    );
  });

  it("es 0 si falta alguno de los dos", () => {
    expect(similitud(copy, null)).toBe(0);
    expect(similitud(null, null)).toBe(0);
  });
});

describe("conciliar", () => {
  it("empareja por ig_media_id sin mirar el texto", () => {
    const c = conciliar(
      [pieza({ ig_media_id: "m1", copy: "cualquier cosa" })],
      [media({ caption: "nada que ver" })],
      RANGO,
    );
    expect(c.matches).toHaveLength(1);
    expect(c.matches[0].motivo).toBe("id");
    expect(c.matches[0].confianza).toBe("alta");
    expect(c.sinPieza).toHaveLength(0);
  });

  it("empareja por texto aunque la fecha real sea otra, y calcula el atraso", () => {
    const copy = "Cuando una familia organiza una celebración no piensa solo en colores";
    const c = conciliar(
      [pieza({ copy, fecha_publicacion: "2026-08-03T15:00:00+00:00" })],
      [media({ caption: copy + " #eventos", timestamp: "2026-08-06T14:00:00+0000" })],
      RANGO,
    );
    expect(c.matches[0].motivo).toBe("texto");
    expect(c.matches[0].confianza).toBe("alta");
    expect(c.matches[0].diasDiferencia).toBe(3); // salió 3 días tarde
  });

  it("no empareja por texto flojo si además las fechas están lejos", () => {
    const c = conciliar(
      [
        pieza({
          copy: "botines camisetas medias canilleras accesorios",
          fecha_publicacion: "2026-08-01T13:00:00+00:00",
        }),
      ],
      [
        media({
          caption: "botines nuevos temporada camisetas oficiales",
          timestamp: "2026-08-28T14:00:00+0000",
        }),
      ],
      RANGO,
    );
    expect(c.matches).toHaveLength(0);
    expect(c.sinPieza).toHaveLength(1);
  });

  it("empareja por fecha cuando hay una sola pieza ese día y no hay copy", () => {
    const c = conciliar(
      [pieza({ id: "p1", copy: null, fecha_publicacion: "2026-08-05T13:00:00+00:00" })],
      [media({ caption: null })],
      RANGO,
    );
    expect(c.matches[0].motivo).toBe("fecha");
    expect(c.matches[0].confianza).toBe("media");
  });

  it("no adivina por fecha si ese día hay más de una pieza candidata", () => {
    const c = conciliar(
      [
        pieza({ id: "p1", fecha_publicacion: "2026-08-05T13:00:00+00:00" }),
        pieza({ id: "p2", fecha_publicacion: "2026-08-05T19:00:00+00:00" }),
      ],
      [media({ caption: null })],
      RANGO,
    );
    expect(c.matches).toHaveLength(0);
    expect(c.sinPieza).toHaveLength(1);
  });

  it("usa la fecha de Córdoba: un posteo de las 22 h no cuenta como del día siguiente", () => {
    // 2026-08-05T01:30Z son las 22:30 del 4 en Córdoba.
    const c = conciliar(
      [pieza({ copy: null, fecha_publicacion: "2026-08-04T22:00:00+00:00" })],
      [media({ caption: null, timestamp: "2026-08-05T01:30:00+0000" })],
      RANGO,
    );
    expect(c.matches[0].fechaReal).toBe("2026-08-04");
    expect(c.matches[0].diasDiferencia).toBe(0);
  });

  it("marca fantasma la pieza que dice publicado y no está en Instagram", () => {
    const c = conciliar(
      [
        pieza({ id: "salio", copy: "texto exacto de este posteo que sí salió a la calle" }),
        pieza({
          id: "fantasma",
          estado: "publicado",
          copy: "otra cosa completamente distinta",
          fecha_publicacion: "2026-08-02T13:00:00+00:00",
        }),
      ],
      [media({ caption: "texto exacto de este posteo que sí salió a la calle" })],
      RANGO,
    );
    expect(c.fantasmas.map((f) => f.piezaId)).toEqual(["fantasma"]);
  });

  it("no marca fantasmas si el feed vino vacío (puede ser un problema de permisos)", () => {
    const c = conciliar([pieza({ estado: "publicado" })], [], RANGO);
    expect(c.fantasmas).toHaveLength(0);
  });

  it("sí marca fantasmas con el feed vacío cuando se confirma que la cuenta no publicó nada", () => {
    const c = conciliar([pieza({ estado: "publicado" })], [], { ...RANGO, feedConfiable: true });
    expect(c.fantasmas).toHaveLength(1);
  });

  it("no marca fantasma una pieza publicada fuera del rango que cubre el feed", () => {
    const c = conciliar(
      [pieza({ estado: "publicado", fecha_publicacion: "2026-07-20T13:00:00+00:00", copy: "vieja" })],
      [media({ caption: "algo nuevo" })],
      RANGO,
    );
    expect(c.fantasmas).toHaveLength(0);
    expect(c.sinPieza).toHaveLength(1);
  });

  it("ignora las historias: la API nunca las devuelve", () => {
    const c = conciliar([pieza({ tipo: "historia", estado: "publicado" })], [media()], RANGO);
    expect(c.fantasmas).toHaveLength(0);
    expect(c.matches).toHaveLength(0);
  });

  it("ignora las piezas de otras redes", () => {
    const c = conciliar([pieza({ red: "tiktok", estado: "publicado" })], [media()], RANGO);
    expect(c.matches).toHaveLength(0);
    expect(c.fantasmas).toHaveLength(0);
  });

  it("no usa dos veces la misma pieza ni el mismo posteo", () => {
    const copy = "promo de invierno con veinte por ciento de descuento en toda la tienda";
    const c = conciliar(
      [pieza({ id: "p1", copy }), pieza({ id: "p2", copy })],
      [media({ id: "m1", caption: copy }), media({ id: "m2", caption: copy })],
      RANGO,
    );
    expect(c.matches).toHaveLength(2);
    expect(new Set(c.matches.map((m) => m.piezaId)).size).toBe(2);
    expect(new Set(c.matches.map((m) => m.mediaId)).size).toBe(2);
  });

  it("separa lo que se aplica solo de lo que hay que confirmar", () => {
    const copy = "el polarizado no se disfruta solamente cuando hace calor privacidad y confort";
    const c = conciliar(
      [
        pieza({ id: "seguro", copy }),
        pieza({ id: "dudoso", copy: null, fecha_publicacion: "2026-08-09T13:00:00+00:00" }),
        pieza({ id: "yaEstaba", copy: "carrusel de agosto", estado: "publicado", ig_media_id: "m3" }),
      ],
      [
        media({ id: "m1", caption: copy }),
        media({ id: "m2", caption: null, timestamp: "2026-08-09T16:00:00+0000" }),
        media({ id: "m3", caption: "carrusel de agosto" }),
      ],
      RANGO,
    );
    expect(matchesAutomaticos(c).map((m) => m.piezaId)).toEqual(["seguro"]);
    expect(matchesADudar(c).map((m) => m.piezaId)).toEqual(["dudoso"]);
  });
});

describe("resumirConciliacion", () => {
  it("cuenta lo que salió en fecha, tarde y lo que no estaba en el calendario", () => {
    const copy1 = "primera pieza del mes con su texto largo para que matchee bien";
    const copy2 = "segunda pieza del mes con otro texto largo distinto del anterior";
    const c = conciliar(
      [
        pieza({ id: "p1", copy: copy1, fecha_publicacion: "2026-08-05T13:00:00+00:00" }),
        pieza({ id: "p2", copy: copy2, fecha_publicacion: "2026-08-05T13:00:00+00:00" }),
      ],
      [
        media({ id: "m1", caption: copy1, timestamp: "2026-08-05T16:00:00+0000" }),
        media({ id: "m2", caption: copy2, timestamp: "2026-08-07T16:00:00+0000" }),
        media({ id: "m3", caption: "un posteo que nadie planificó", timestamp: "2026-08-06T16:00:00+0000" }),
      ],
      RANGO,
    );
    expect(resumirConciliacion(c)).toMatchObject({
      salieron: 3,
      enFecha: 1,
      tarde: 1,
      sinPieza: 1,
      fantasmas: 0,
    });
  });
});
