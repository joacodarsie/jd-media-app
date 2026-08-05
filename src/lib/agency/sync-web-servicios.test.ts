import { describe, it, expect } from "vitest";
import {
  extraerUrlsDeServicios,
  parsearPaginaServicio,
  planificarSync,
  slugDeApp,
  slugDesdeUrl,
  type ServicioApp,
  type ServicioWeb,
} from "./sync-web-servicios";

describe("slugs", () => {
  it("saca el slug de la URL de un servicio", () => {
    expect(slugDesdeUrl("https://jdmedia.com.ar/servicios/gestion-redes/")).toBe(
      "gestion-redes"
    );
    expect(slugDesdeUrl("/servicios/botly")).toBe("botly");
    expect(slugDesdeUrl("https://jdmedia.com.ar/contacto/")).toBeNull();
  });

  it("traduce el slug de la web al de la app", () => {
    // La web dice "publicidad-online" pero en la app el servicio contratado por
    // los clientes se llama paid_media: renombrarlo rompería client_services.
    expect(slugDeApp("publicidad-online")).toBe("paid_media");
    expect(slugDeApp("gestion-redes")).toBe("gestion_redes");
  });

  it("un servicio nuevo sin alias cae a un slug razonable", () => {
    expect(slugDeApp("email-marketing")).toBe("email_marketing");
  });
});

describe("extraerUrlsDeServicios", () => {
  const html = `
    <a href="/servicios/gestion-redes/">01 Gestión de Redes</a>
    <a href="/servicios/publicidad-online/">02 Publicidad Online</a>
    <a href="/servicios/gestion-redes/">repetido</a>
    <a href="/contacto/">Contacto</a>
    <a href="https://jdmedia.com.ar/servicios/botly/">06 Botly</a>
  `;

  it("trae cada servicio una sola vez y absolutiza las relativas", () => {
    const urls = extraerUrlsDeServicios(html);
    expect(urls).toEqual([
      "https://jdmedia.com.ar/servicios/gestion-redes/",
      "https://jdmedia.com.ar/servicios/publicidad-online/",
      "https://jdmedia.com.ar/servicios/botly/",
    ]);
  });

  it("ignora links que no son de servicios", () => {
    expect(extraerUrlsDeServicios(html).some((u) => u.includes("contacto"))).toBe(false);
  });

  it("un home sin servicios devuelve vacío (y el caller aborta)", () => {
    expect(extraerUrlsDeServicios("<a href='/nosotros/'>x</a>")).toEqual([]);
  });
});

describe("parsearPaginaServicio", () => {
  const url = "https://jdmedia.com.ar/servicios/gestion-redes/";

  it("usa el título para el nombre y la meta description para el texto", () => {
    const html = `<title>Gestión de Redes Sociales en Córdoba | JD MEDIA</title>
      <meta name="description" content="Equipo dedicado de Community Manager, editor y diseñador.">`;
    const r = parsearPaginaServicio(html, url)!;
    expect(r.nombre).toBe("Gestión de Redes Sociales");
    expect(r.descripcion).toContain("Community Manager");
  });

  it("tolera el meta con los atributos al revés", () => {
    const html = `<title>Botly | JD MEDIA</title>
      <meta content="Automatización por WhatsApp." name="description">`;
    expect(parsearPaginaServicio(html, url)!.descripcion).toBe(
      "Automatización por WhatsApp."
    );
  });

  it("sin meta description no inventa: deja null", () => {
    const html = `<title>Botly | JD MEDIA</title>`;
    expect(parsearPaginaServicio(html, url)!.descripcion).toBeNull();
  });

  it("baja los títulos que vienen todo en mayúscula", () => {
    const html = `<title>DESARROLLO WEB | JD MEDIA</title>`;
    expect(parsearPaginaServicio(html, url)!.nombre).toBe("Desarrollo web");
  });
});

describe("planificarSync", () => {
  const app: ServicioApp[] = [
    { slug: "gestion_redes", name: "Gestión de redes", description: "Vieja", active: true },
    { slug: "paid_media", name: "Paid Media", description: "Ads", active: true },
    { slug: "consultoria", name: "Consultoría", description: null, active: true },
  ];

  const web: ServicioWeb[] = [
    {
      slugWeb: "gestion-redes",
      slug: "gestion_redes",
      nombre: "Gestión de redes",
      descripcion: "Nueva",
      url: "u1",
    },
    {
      slugWeb: "publicidad-online",
      slug: "paid_media",
      nombre: "Publicidad Online",
      descripcion: "Ads",
      url: "u2",
    },
    {
      slugWeb: "email-marketing",
      slug: "email_marketing",
      nombre: "Email marketing",
      descripcion: "Nuevo servicio",
      url: "u3",
    },
  ];

  it("detecta el servicio nuevo de la web", () => {
    const p = planificarSync(app, web);
    expect(p.crear.map((c) => c.slug)).toEqual(["email_marketing"]);
  });

  it("actualiza descripción y nombre cuando cambian", () => {
    const p = planificarSync(app, web);
    const slugs = p.actualizar.map((u) => u.slug);
    expect(slugs).toContain("gestion_redes"); // cambió la descripción
    expect(slugs).toContain("paid_media"); // cambió el nombre
    const paid = p.actualizar.find((u) => u.slug === "paid_media")!;
    expect(paid.nombre).toBe("Publicidad Online");
    expect(paid.antes.name).toBe("Paid Media");
  });

  it("NO borra ni desactiva lo que ya no está en la web: solo lo marca", () => {
    const p = planificarSync(app, web);
    expect(p.noEnWeb).toEqual(["consultoria"]);
    // Lo importante: no aparece en ninguna lista de escritura destructiva.
    expect(p.crear.some((c) => c.slug === "consultoria")).toBe(false);
    expect(p.actualizar.some((u) => u.slug === "consultoria")).toBe(false);
  });

  it("si la web no trae descripción, se conserva la que ya había", () => {
    const sinDesc: ServicioWeb[] = [
      { ...web[0], descripcion: null },
    ];
    const p = planificarSync(app, sinDesc);
    // No cambia nada: el nombre es igual y la descripción vieja se mantiene.
    expect(p.actualizar).toEqual([]);
    expect(p.sinCambios).toContain("gestion_redes");
  });

  it("lo que ya coincide no genera escritura", () => {
    const igual: ServicioWeb[] = [
      { ...web[1], nombre: "Paid Media", descripcion: "Ads" },
    ];
    const p = planificarSync(app, igual);
    expect(p.actualizar).toEqual([]);
    expect(p.sinCambios).toEqual(["paid_media"]);
  });

  it("un catálogo vacío en la app solo crea, nunca marca faltantes de más", () => {
    const p = planificarSync([], web);
    expect(p.crear).toHaveLength(3);
    expect(p.noEnWeb).toEqual([]);
  });

  it("los inactivos no se reportan como faltantes de la web", () => {
    const conInactivo: ServicioApp[] = [
      ...app,
      { slug: "viejo", name: "Viejo", description: null, active: false },
    ];
    expect(planificarSync(conInactivo, web).noEnWeb).toEqual(["consultoria"]);
  });
});
