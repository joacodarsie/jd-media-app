import { describe, it, expect } from "vitest";
import { chequearAutoPublicacion } from "./publicable";

const base = {
  red: "instagram",
  estado: "aprobado",
  auto_publicar: true,
  publish_media: [{ path: "a.jpg" }],
  fecha_publicacion: "2026-08-01T19:52:00+00:00",
};
const cliente = { ig_user_id: "17841475381017226" };

describe("chequearAutoPublicacion", () => {
  it("con todo en orden, está programada", () => {
    const r = chequearAutoPublicacion(base, cliente);
    expect(r.estado).toBe("lista");
    expect(r.faltan).toEqual([]);
  });

  it("EL CASO REAL: estado 'idea' con todo lo demás cargado no sale", () => {
    const r = chequearAutoPublicacion({ ...base, estado: "idea" }, cliente);
    expect(r.estado).toBe("falta_algo");
    expect(r.faltan[0]).toContain("Aprobado");
  });

  it("sin archivo no sale", () => {
    const r = chequearAutoPublicacion({ ...base, publish_media: [] }, cliente);
    expect(r.faltan.some((f) => f.includes("archivo"))).toBe(true);
  });

  it("sin Instagram conectado no sale", () => {
    const r = chequearAutoPublicacion(base, { ig_user_id: null });
    expect(r.faltan.some((f) => f.includes("Instagram"))).toBe(true);
  });

  it("acumula todo lo que falta, no solo lo primero", () => {
    const r = chequearAutoPublicacion(
      { ...base, estado: "idea", publish_media: null, fecha_publicacion: null },
      { ig_user_id: null }
    );
    expect(r.faltan).toHaveLength(4);
  });

  it("sin auto_publicar es manual y no reclama nada", () => {
    const r = chequearAutoPublicacion({ ...base, auto_publicar: false }, cliente);
    expect(r.estado).toBe("manual");
    expect(r.faltan).toEqual([]);
  });

  it("ya publicada gana sobre todo lo demás", () => {
    const r = chequearAutoPublicacion(
      { ...base, estado: "idea", published_at: "2026-08-01T20:00:00Z" },
      cliente
    );
    expect(r.estado).toBe("publicada");
  });

  it("un error previo se muestra tal cual", () => {
    const r = chequearAutoPublicacion(
      { ...base, publish_error: "El token de Meta venció" },
      cliente
    );
    expect(r.estado).toBe("error");
    expect(r.faltan[0]).toBe("El token de Meta venció");
  });

  it("otra red todavía no se publica sola", () => {
    const r = chequearAutoPublicacion({ ...base, red: "tiktok" }, cliente);
    expect(r.faltan.some((f) => f.includes("Instagram"))).toBe(true);
  });
});
