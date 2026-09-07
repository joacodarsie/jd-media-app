import { describe, it, expect } from "vitest";
import { htmlATexto, metaDelSitio, bloqueDeContextoWeb } from "./leer-sitio";

describe("htmlATexto", () => {
  it("saca scripts, estilos y etiquetas", () => {
    const html = `<html><head><style>.a{color:red}</style><script>var x=1</script></head>
      <body><h1>Vivero El Ombú</h1><p>Plantas de interior y  paisajismo</p></body></html>`;
    const t = htmlATexto(html);
    expect(t).toContain("Vivero El Ombú");
    expect(t).toContain("Plantas de interior y paisajismo");
    expect(t).not.toContain("color:red");
    expect(t).not.toContain("var x");
  });

  it("traduce las entidades y colapsa espacios", () => {
    expect(htmlATexto("<p>Caf&eacute;&nbsp;&amp; Bar</p>")).toBe("Caf&eacute; & Bar");
    expect(htmlATexto("<p>uno</p>\n\n   <p>dos</p>")).toBe("uno dos");
  });
});

describe("metaDelSitio", () => {
  it("saca el título y la descripción", () => {
    const html = `<title>Posada de Rosas — Hotel boutique</title>
      <meta name="description" content="Hospedaje en Mendoza con vista a los viñedos">`;
    expect(metaDelSitio(html)).toEqual({
      titulo: "Posada de Rosas — Hotel boutique",
      descripcion: "Hospedaje en Mendoza con vista a los viñedos",
    });
  });

  it("tolera un sitio sin meta", () => {
    expect(metaDelSitio("<html><body>hola</body></html>")).toEqual({
      titulo: null,
      descripcion: null,
    });
  });
});

describe("bloqueDeContextoWeb", () => {
  const web = {
    url: "https://posadaderosas.com",
    titulo: "Posada de Rosas",
    descripcion: "Hotel boutique",
    texto: "Habitaciones con vista a los viñedos",
  };

  it("mete el contenido del sitio como información real", () => {
    const b = bloqueDeContextoWeb(web, null);
    expect(b).toContain("posadaderosas.com");
    expect(b).toContain("Habitaciones con vista");
    expect(b).toContain("es información real");
  });

  it("aclara que el Instagram NO se pudo ver, para que no invente", () => {
    const b = bloqueDeContextoWeb(null, "@posadaderosas");
    expect(b).toContain("@posadaderosas");
    expect(b).toContain("NO pudimos verlo");
  });

  it("sin nada cargado devuelve vacío", () => {
    expect(bloqueDeContextoWeb(null, null)).toBe("");
    expect(bloqueDeContextoWeb(null, "   ")).toBe("");
  });
});
