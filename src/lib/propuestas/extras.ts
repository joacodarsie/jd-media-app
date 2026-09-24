/**
 * Los extras que se suman al pack en una propuesta, cada uno con su precio.
 *
 * Salen de las propuestas armadas a mano (Nahuel, Detersi, Truvari, Ares,
 * Warrior): el prospecto ve el pack solo y el total "con los extras", y
 * decide. El alcance es el mismo que dice la carta acuerdo de cada servicio
 * (lib/service-deliverables.ts), contado más corto.
 *
 * El precio de cada extra se carga por propuesta; el de acá es el sugerido.
 */

export type ExtraSlug = "gestion_whatsapp" | "chatter" | "google_ads";

export interface ExtraCatalogo {
  slug: ExtraSlug;
  nombre: string;
  /** Una línea para la fila de la inversión. */
  resumen: string;
  items: string[];
  precioSugerido: number;
}

export const EXTRAS: ExtraCatalogo[] = [
  {
    slug: "gestion_whatsapp",
    nombre: "Gestión de WhatsApp",
    resumen: "Imagen de marca · estados · grupos · mensajes a contactos",
    items: [
      "WhatsApp Business con foto, diseño e imagen profesional de la marca.",
      "Estrategia en estados y grupos de WhatsApp.",
      "Mensajes a los contactos que ya compraron o interactuaron con el contenido.",
    ],
    precioSugerido: 50000,
  },
  {
    slug: "chatter",
    nombre: "Chatter",
    resumen: "Responde y filtra las consultas antes de la venta",
    items: [
      "Responde los mensajes que llegan por WhatsApp.",
      "Filtra cada consulta y te pasa las que están listas para cerrar.",
      "El horario de atención queda sujeto a la disponibilidad del chatter.",
    ],
    precioSugerido: 50000,
  },
  {
    slug: "google_ads",
    nombre: "Google Ads y Google Business",
    resumen: "Campañas de búsqueda y la ficha de Maps al día",
    items: [
      "La ficha de Google Business optimizada, con publicaciones y reseñas.",
      "Campañas de búsqueda para quien ya está buscando lo que ofrecés.",
      "Reporte mensual de las consultas que llegan desde Google. La inversión va aparte.",
    ],
    precioSugerido: 100000,
  },
];

export interface ExtraElegido {
  slug: ExtraSlug;
  precio: number;
}

export interface LineaExtra extends ExtraCatalogo {
  precio: number;
}

/** Limpia lo que viene del formulario o de la base: solo extras que existen, una vez cada uno. */
export function normalizarExtras(raw: unknown): ExtraElegido[] {
  if (!Array.isArray(raw)) return [];
  const vistos = new Set<string>();
  const out: ExtraElegido[] = [];
  for (const r of raw) {
    const slug = (r as { slug?: unknown })?.slug;
    const cat = EXTRAS.find((e) => e.slug === slug);
    if (!cat || vistos.has(cat.slug)) continue;
    vistos.add(cat.slug);
    const precio = Math.round(Number((r as { precio?: unknown }).precio));
    out.push({ slug: cat.slug, precio: Number.isFinite(precio) && precio > 0 ? precio : cat.precioSugerido });
  }
  return out;
}

/** Las líneas para pintar y lo que suman. */
export function armarExtras(raw: unknown): { lineas: LineaExtra[]; total: number } {
  const lineas = normalizarExtras(raw).map((e) => ({ ...EXTRAS.find((c) => c.slug === e.slug)!, precio: e.precio }));
  return { lineas, total: lineas.reduce((a, l) => a + l.precio, 0) };
}
