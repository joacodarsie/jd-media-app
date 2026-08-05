import { describe, it, expect } from "vitest";
import { bloqueServiciosParaPrompt, type ServicioAgencia } from "./catalogo";

const CATALOGO: ServicioAgencia[] = [
  { slug: "gestion_redes", nombre: "Gestión de redes", descripcion: "Contenido para redes." },
  { slug: "paid_media", nombre: "Paid Media", descripcion: "Meta, TikTok y Google Ads." },
  { slug: "desarrollo_web", nombre: "Desarrollo web", descripcion: null },
];

describe("bloqueServiciosParaPrompt", () => {
  it("lista los servicios reales con su descripción", () => {
    const b = bloqueServiciosParaPrompt(CATALOGO);
    expect(b).toContain("Gestión de redes: Contenido para redes.");
    expect(b).toContain("Paid Media: Meta, TikTok y Google Ads.");
    expect(b).toContain("Desarrollo web");
  });

  it("prohíbe explícitamente lo que la IA venía inventando", () => {
    const b = bloqueServiciosParaPrompt(CATALOGO);
    // El caso real que motivó esto: "LinkedIn estratégico + SEO local".
    expect(b).toMatch(/SEO/);
    expect(b).toMatch(/LinkedIn/);
    expect(b).toContain("PROHIBIDO");
  });

  it("prohíbe cotizar en frío, porque las descripciones de la web traen precios", () => {
    const conPrecio: ServicioAgencia[] = [
      {
        slug: "gestion_redes",
        nombre: "Gestión de redes",
        descripcion: "Equipo dedicado de CM, editor y diseñador. Planes desde $400.000/mes.",
      },
    ];
    const b = bloqueServiciosParaPrompt(conPrecio);
    expect(b).toContain("PRECIOS");
    expect(b).toMatch(/NO menciones precios/i);
  });

  it("marca el servicio de la campaña como foco", () => {
    const b = bloqueServiciosParaPrompt(CATALOGO, "gestion_redes");
    expect(b).toContain("SERVICIO QUE SE QUIERE VENDER EN ESTA CAMPAÑA");
    expect(b).toContain("**Gestión de redes**");
  });

  it("sin foco no inventa una sección de foco", () => {
    const b = bloqueServiciosParaPrompt(CATALOGO, null);
    expect(b).not.toContain("SERVICIO QUE SE QUIERE VENDER");
  });

  it("un slug de foco que no está en el catálogo no rompe ni miente", () => {
    const b = bloqueServiciosParaPrompt(CATALOGO, "seo_local");
    expect(b).not.toContain("SERVICIO QUE SE QUIERE VENDER");
    expect(b).toContain("Gestión de redes");
  });

  it("con catálogo vacío cae al de respaldo, nunca a una lista vacía", () => {
    const b = bloqueServiciosParaPrompt([]);
    expect(b).toContain("Gestión de redes");
    expect(b).toContain("Paid Media");
    expect(b).toContain("PROHIBIDO");
    // Lo que no puede pasar: el encabezado seguido de la nada.
    expect(b).not.toMatch(/catálogo real y completo\):\s*\n\s*\n/);
  });

  it("le dice qué hacer cuando el ángulo obvio del rubro es algo que no vendemos", () => {
    const b = bloqueServiciosParaPrompt(CATALOGO);
    expect(b).toContain("abogados");
    expect(b).toMatch(/buscá el ángulo desde lo que SÍ hacemos/i);
  });
});
