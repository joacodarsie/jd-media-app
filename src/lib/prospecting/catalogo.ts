/**
 * Qué vende JD Media DE VERDAD, para los prompts de prospección.
 *
 * Por qué existe: la IA proponía campañas de "LinkedIn estratégico + SEO local"
 * y escribía mensajes ofreciéndolo. Suena bien y convierte, pero la agencia no
 * tiene esos servicios: el prospecto que decía que sí se encontraba con que no
 * existía lo que le vendimos. Un mensaje en frío no puede prometer algo que no
 * podemos entregar.
 *
 * La fuente de verdad es la tabla `services` (la que se edita en /agencia), así
 * que cuando se dé de alta un servicio nuevo los mensajes lo empiezan a ofrecer
 * solos, sin tocar código.
 */

import { createAdmin } from "@/lib/supabase/admin";

export interface ServicioAgencia {
  slug: string;
  nombre: string;
  descripcion: string | null;
}

/**
 * Respaldo por si la tabla `services` no responde: preferimos un catálogo
 * acotado y verdadero antes que dejar a la IA inventar libremente.
 */
const CATALOGO_FALLBACK: ServicioAgencia[] = [
  {
    slug: "gestion_redes",
    nombre: "Gestión de redes",
    descripcion:
      "Estrategia, planificación, creación, edición y publicación de contenido para las redes sociales del cliente.",
  },
  {
    slug: "paid_media",
    nombre: "Paid Media",
    descripcion:
      "Anuncios en Meta Ads (Facebook/Instagram), TikTok Ads y Google Ads: estrategia, segmentación, creatividades y reportes.",
  },
  {
    slug: "produccion_contenido",
    nombre: "Producción de contenido",
    descripcion: "Producción audiovisual y fotográfica en locación o estudio.",
  },
  {
    slug: "diseno_grafico",
    nombre: "Diseño gráfico",
    descripcion: "Identidad de marca, piezas gráficas, etiquetas, manuales y plantillas.",
  },
  {
    slug: "desarrollo_web",
    nombre: "Desarrollo web",
    descripcion: "Páginas web, landings y e-commerce.",
  },
  {
    slug: "botly",
    nombre: "Botly",
    descripcion: "Automatización de respuestas y mensajes por WhatsApp.",
  },
];

/** Servicios activos del catálogo. Nunca devuelve vacío. */
export async function cargarCatalogoServicios(): Promise<ServicioAgencia[]> {
  try {
    const { data, error } = await createAdmin()
      .from("services")
      .select("slug, name, description, active, orden")
      .eq("active", true)
      .order("orden");
    if (error || !data || data.length === 0) return CATALOGO_FALLBACK;
    return (data as { slug: string; name: string; description: string | null }[]).map(
      (s) => ({ slug: s.slug, nombre: s.name, descripcion: s.description })
    );
  } catch {
    return CATALOGO_FALLBACK;
  }
}

/**
 * El bloque de reglas que se pega en los prompts.
 *
 * `focoSlug` es el servicio elegido en la campaña: se ofrece ESE, y el resto
 * queda disponible solo si encaja natural. Sin foco, se elige el que mejor
 * calce con el rubro.
 */
export function bloqueServiciosParaPrompt(
  catalogo: ServicioAgencia[],
  focoSlug?: string | null
): string {
  // Nunca dejamos el bloque vacío: sin lista, la regla dura no significa nada
  // y volvemos al problema original (la IA ofreciendo lo que se le ocurra).
  const servicios = catalogo.length > 0 ? catalogo : CATALOGO_FALLBACK;
  const foco = focoSlug ? servicios.find((s) => s.slug === focoSlug) ?? null : null;

  const lista = servicios
    .map((s) => `- ${s.nombre}${s.descripcion ? `: ${s.descripcion}` : ""}`)
    .join("\n");

  const lineas: string[] = [];
  lineas.push("LO ÚNICO QUE JD MEDIA PUEDE VENDER (catálogo real y completo):");
  lineas.push(lista);
  lineas.push("");

  if (foco) {
    lineas.push(
      `SERVICIO QUE SE QUIERE VENDER EN ESTA CAMPAÑA: **${foco.nombre}**${foco.descripcion ? ` — ${foco.descripcion}` : ""}`
    );
    lineas.push(
      `El mensaje tiene que apuntar a ESE servicio. Podés mencionar otro del catálogo solo si sale natural y suma, nunca como lista.`
    );
    lineas.push("");
  }

  lineas.push(
    `PRECIOS: las descripciones vienen de la web y algunas incluyen precios ("desde $X"). NO menciones precios ni planes en un mensaje en frío: el número se habla en la reunión, cuando ya se entendió qué necesita. Usá la descripción para saber QUÉ hacemos, no para cotizar.`
  );
  lineas.push("");

  lineas.push(
    `REGLA DURA — NO PROMETER LO QUE NO TENEMOS
Está PROHIBIDO ofrecer, nombrar o insinuar cualquier servicio que no esté en la lista de arriba. En particular, y porque la IA los inventa seguido, NO existen en JD Media: SEO / posicionamiento en Google, SEO local, fichas de Google Business, gestión de LinkedIn, email marketing, newsletters, CRM, automatizaciones que no sean Botly (WhatsApp), influencers, prensa, ni consultoría suelta.
Si el rubro pide algo que no tenemos (por ejemplo, un estudio de abogados donde lo obvio sería LinkedIn o Google), NO lo menciones: buscá el ángulo desde lo que SÍ hacemos. Un prospecto que dice que sí a algo que no podemos entregar es peor que no tenerlo.`
  );

  return lineas.join("\n");
}
