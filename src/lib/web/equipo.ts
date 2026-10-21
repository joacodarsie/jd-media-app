/**
 * El equipo para jdmedia.com.ar (21/10/2026). Pedido del dueño: que la web use
 * siempre las fotos de la plataforma (las que cada uno sube en Mi perfil) y que
 * en la web se pueda tocar a cada persona. Solo lo público: nombre, rol, una
 * línea de qué hace y la foto. Nada de datos personales.
 */
import { imagenChica } from "./imagenes";

export interface PersonaWeb {
  nombre: string;
  rol: string;
  texto: string;
  grupo: string;
  foto: string | null;
  fotoGrande: string | null;
}

/** Por área: cómo se presenta en la web, en qué grupo va y en qué orden. */
const PUBLICO: Record<string, { rol: string; texto: string; grupo: string; orden: number }> = {
  "Estrategia/Dirección": { rol: "Fundador · Dirección general", texto: "Arrancó JD Media en 2025 para que cualquier marca tenga todo su marketing en un solo lugar.", grupo: "Dirección y coordinación", orden: 0 },
  "Coordinación General": { rol: "Coordinación general", texto: "Se ocupa de la administración y de que el equipo tenga todo lo que necesita.", grupo: "Dirección y coordinación", orden: 1 },
  "Coordinación de Diseño": { rol: "Dirección creativa", texto: "Aprueba todo lo que sale y cuida que cada marca comunique con estrategia.", grupo: "Dirección y coordinación", orden: 2 },
  Coordinación: { rol: "Project manager", texto: "Organiza el trabajo del equipo y cuida que cada cuenta salga en tiempo y forma.", grupo: "Dirección y coordinación", orden: 3 },
  "Community Manager": { rol: "Community manager", texto: "Piensa, arma y publica el contenido de sus cuentas, día a día.", grupo: "Community managers", orden: 10 },
  Diseño: { rol: "Diseño gráfico", texto: "Diseña las piezas y la identidad visual de cada marca.", grupo: "Diseño", orden: 20 },
  "Edición Audiovisual": { rol: "Edición audiovisual", texto: "Edita los reels y videos para que se miren hasta el final.", grupo: "Edición audiovisual", orden: 30 },
  "Coordinación de Paid Media": { rol: "Paid media", texto: "Planifica y optimiza la publicidad en Meta y Google de cada marca.", grupo: "Publicidad", orden: 40 },
  "Paid Media": { rol: "Paid media", texto: "Planifica y optimiza la publicidad de cada marca.", grupo: "Publicidad", orden: 41 },
  "Desarrollo Web": { rol: "Web", texto: "Diseña y programa webs que convierten visitas en consultas.", grupo: "Web, automatización y comercial", orden: 50 },
  Botly: { rol: "Botly", texto: "Arma los bots de WhatsApp que responden solos, a cualquier hora.", grupo: "Web, automatización y comercial", orden: 51 },
  Comercial: { rol: "Comercial", texto: "Acompaña a cada marca desde la primera charla hasta que arranca.", grupo: "Web, automatización y comercial", orden: 52 },
};

/** Santi figura como Comercial pero en la web es la Dirección Creativa: manda el área que más pesa. */
function areaPublica(area: string | null, secundaria: string | null): string | null {
  const opciones = [area, secundaria].filter((a): a is string => !!a && a in PUBLICO);
  if (!opciones.length) return null;
  return opciones.sort((a, b) => PUBLICO[a].orden - PUBLICO[b].orden)[0];
}

export function equipoParaWeb(
  users: { nombre: string; area: string | null; area_secundaria: string | null; avatar_url: string | null; email?: string | null }[]
): PersonaWeb[] {
  return users
    .filter((u) => !(u.email ?? "").startsWith("agenciajdmedia"))
    .map((u) => ({ u, area: areaPublica(u.area, u.area_secundaria) }))
    .filter((x): x is { u: (typeof users)[number]; area: string } => !!x.area)
    .sort((a, b) => PUBLICO[a.area].orden - PUBLICO[b.area].orden || a.u.nombre.localeCompare(b.u.nombre))
    .map(({ u, area }) => ({
      nombre: u.nombre,
      rol: PUBLICO[area].rol,
      texto: PUBLICO[area].texto,
      grupo: PUBLICO[area].grupo,
      foto: u.avatar_url ? imagenChica(u.avatar_url, 160) : null,
      fotoGrande: u.avatar_url ? imagenChica(u.avatar_url, 800) : null,
    }));
}
