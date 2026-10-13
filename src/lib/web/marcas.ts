/**
 * Las marcas del carrusel de jdmedia.com.ar (13/10/2026): los clientes activos,
 * con su logo y su Instagram. Se arma solo: el que se da de baja desaparece
 * solo. Los que todavía no tienen logo van con el nombre escrito.
 *
 * Puro: entra la fila de la base, sale lo que muestra la web.
 */
export interface MarcaWeb {
  nombre: string;
  logo: string | null;
  link: string | null;
}

// Manda la URL de la ficha (es lo que el equipo corrige a mano); el usuario
// guardado queda de respaldo. Con el orden al revés, corregir la ficha no
// arreglaba el link de la web (Sabattini e Impertek, 13/10/2026).
export function linkInstagram(igUsername: string | null | undefined, instagramUrl: string | null | undefined): string | null {
  const url = instagramUrl?.trim();
  if (url && /^https?:\/\/(www\.)?instagram\.com\//i.test(url)) return url;
  if (url && /^@?[\w.]+$/.test(url)) return `https://www.instagram.com/${url.replace(/^@/, "")}/`;
  const u = igUsername?.trim().replace(/^@/, "");
  if (u) return `https://www.instagram.com/${u}/`;
  return null;
}

export function marcasParaWeb(
  clientes: {
    nombre: string;
    logo_url: string | null;
    ig_username: string | null;
    instagram_url: string | null;
    fecha_inicio: string | null;
  }[]
): MarcaWeb[] {
  return [...clientes]
    // Primero las que tienen logo (se ven mejor), después por antigüedad.
    .sort(
      (a, b) =>
        Number(!a.logo_url) - Number(!b.logo_url) ||
        (a.fecha_inicio ?? "9999").localeCompare(b.fecha_inicio ?? "9999")
    )
    .map((c) => ({
      nombre: c.nombre,
      logo: c.logo_url || null,
      link: linkInstagram(c.ig_username, c.instagram_url),
    }));
}
