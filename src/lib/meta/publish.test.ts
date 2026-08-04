import { describe, it, expect } from "vitest";
import { decidirFormato } from "./publish";

const foto = (n = 1) => ({ url: `https://x/f${n}.jpg`, isVideo: false });
const video = { url: "https://x/v.mp4", isVideo: true };

describe("decidirFormato", () => {
  it("una foto sola es una imagen", () => {
    expect(decidirFormato("post", [foto()])).toBe("imagen");
  });

  it("varias fotos son un carrusel aunque el calendario diga 'post'", () => {
    // El bug: publicaba solo la primera y las otras se perdían en silencio.
    expect(decidirFormato("post", [foto(1), foto(2), foto(3)])).toBe("carrusel");
  });

  it("un video sale como reel, diga lo que diga el calendario", () => {
    expect(decidirFormato("post", [video])).toBe("reel");
    expect(decidirFormato("reel", [video])).toBe("reel");
    expect(decidirFormato("video", [video])).toBe("reel");
  });

  it("video + foto es un reel con portada, no un carrusel", () => {
    expect(decidirFormato("reel", [video, foto()])).toBe("reel");
    expect(decidirFormato("reel", [foto(), video])).toBe("reel");
  });

  it("una historia es historia siempre", () => {
    expect(decidirFormato("historia", [foto()])).toBe("historia");
    expect(decidirFormato("historia", [video])).toBe("historia");
    expect(decidirFormato("historia", [foto(1), foto(2)])).toBe("historia");
  });

  it("un carrusel pedido a mano puede mezclar video y fotos", () => {
    expect(decidirFormato("carrusel", [foto(1), video, foto(2)])).toBe("carrusel");
  });

  it("un carrusel con un solo archivo sale como pieza simple", () => {
    expect(decidirFormato("carrusel", [foto()])).toBe("imagen");
    expect(decidirFormato("carrusel", [video])).toBe("reel");
  });
});
