import { describe, expect, it } from "vitest";
import { achicarImagenes, imagenChica } from "./imagenes";

const LOGO = "https://vjnwswibnrttcljbmysq.supabase.co/storage/v1/object/public/publish-media/logos/x.png";

describe("imagenChica", () => {
  it("pasa las URLs públicas del storage al endpoint que achica", () => {
    expect(imagenChica(LOGO, 240)).toBe(
      "https://vjnwswibnrttcljbmysq.supabase.co/storage/v1/render/image/public/publish-media/logos/x.png?width=240&height=240&resize=contain&quality=72"
    );
  });
  it("no toca otras URLs ni las que ya tienen parámetros", () => {
    expect(imagenChica("https://scontent.cdninstagram.com/a.jpg", 240)).toBe("https://scontent.cdninstagram.com/a.jpg");
    expect(imagenChica(LOGO + "?v=2", 240)).toBe(LOGO + "?v=2");
    expect(imagenChica("Boxescar", 240)).toBe("Boxescar");
  });
});

describe("achicarImagenes", () => {
  it("recorre objetos y listas anidadas sin tocar números ni nulos", () => {
    const r = achicarImagenes({ marcas: [{ nombre: "A", logo: LOGO, n: 3, x: null }], grilla: [{ img: LOGO }] }, 300);
    expect(r.marcas[0].logo).toContain("/render/image/public/");
    expect(r.marcas[0].n).toBe(3);
    expect(r.marcas[0].x).toBeNull();
    expect(r.grilla[0].img).toContain("width=300");
    expect(r.marcas[0].nombre).toBe("A");
  });
});
