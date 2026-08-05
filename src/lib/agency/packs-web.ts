/**
 * Packs de gestión de redes leídos de la web pública.
 *
 * Por qué existe: los precios estaban hardcodeados en el prompt del post-meet
 * ($350.000 / $500.000 / $700.000) mientras la web ya cobraba
 * $400.000 / $600.000 / $800.000. O sea: la IA cotizaba por debajo en cada
 * propuesta que se le mandaba a un prospecto. La web es la fuente de verdad
 * comercial, así que los packs salen de ahí.
 *
 * Igual que el catálogo de servicios: esto ACTUALIZA, nunca borra. Si el parseo
 * falla o la web cambia de diseño, se conserva lo último que se guardó.
 */

const URL_PACKS = "https://jdmedia.com.ar/servicios/gestion-redes/";

export interface PackWeb {
  slug: string;
  nombre: string;
  /** Precio mensual en pesos. null si es "a cotizar" (Personalizado). */
  precio_mensual: number | null;
  descripcion: string | null;
  reels: number | null;
  posts: number | null;
  dias_historias: number | null;
  orden: number;
}

/** Saca las etiquetas y deja el texto plano, como lo ve una persona. */
export function htmlATexto(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/**
 * "$400.000 /mes" → 400000.
 *
 * Exige el "/mes" a propósito: sin eso, el bloque de "Personalizado" (que es a
 * cotizar) se llevaba los $50.000 de la jornada de producción que la página
 * lista más abajo. Un precio mensual siempre viene rotulado como mensual.
 */
export function parsePrecio(txt: string): number | null {
  const m = txt.match(/\$\s?([\d.]+)\s*\n?\s*\/?\s*mes/i);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const NOMBRES = ["PRESENCIA", "CRECIMIENTO", "ESCALA", "PERSONALIZADO"] as const;

function slugDe(nombre: string): string {
  return nombre.toLowerCase();
}

/**
 * Parsea los packs del texto de la página.
 *
 * La página lista cada pack como: nombre, descripción, precio "/mes" y las
 * cantidades ("4 Reels", "4 Posts", "8 días de Historias"). Buscamos por nombre
 * y leemos la ventana de texto que sigue, que es lo que sobrevive a un cambio
 * de maquetado.
 */
export function parsearPacks(texto: string): PackWeb[] {
  const T = texto.toUpperCase();
  const out: PackWeb[] = [];

  NOMBRES.forEach((nombre, i) => {
    // Buscamos el nombre seguido (cerca) de un precio o de "A COTIZAR": así no
    // matcheamos la mención del pack en el FAQ.
    let desde = -1;
    let pos = T.indexOf(nombre);
    while (pos !== -1) {
      const ventana = T.slice(pos, pos + 600);
      if (/\$\s?[\d.]+\s*\/?\s*MES/.test(ventana) || /A COTIZAR/.test(ventana)) {
        desde = pos;
        break;
      }
      pos = T.indexOf(nombre, pos + 1);
    }
    if (desde === -1) return;

    const bloque = texto.slice(desde, desde + 600);
    const precio = parsePrecio(bloque);

    const num = (re: RegExp): number | null => {
      const m = bloque.match(re);
      if (!m) return null;
      const n = Number(m[1]);
      return Number.isFinite(n) ? n : null;
    };

    // La descripción es la primera línea con texto real después del nombre.
    const lineas = bloque
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const descripcion =
      lineas.slice(1).find((l) => l.length > 25 && !/^\$/.test(l)) ?? null;

    out.push({
      slug: slugDe(nombre),
      nombre: nombre.charAt(0) + nombre.slice(1).toLowerCase(),
      precio_mensual: precio,
      descripcion,
      reels: num(/(\d+)\s*Reels?/i),
      posts: num(/(\d+)\s*Posts?/i),
      dias_historias: num(/(\d+)\s*d[ií]as?\s+de\s+Historias?/i),
      orden: (i + 1) * 10,
    });
  });

  return out;
}

/** Lee la página de gestión de redes y devuelve los packs que publica hoy. */
export async function leerPacksDeLaWeb(): Promise<PackWeb[]> {
  const res = await fetch(URL_PACKS, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; JDMediaBot/1.0; +https://jdmedia.com.ar)",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`La página de packs respondió HTTP ${res.status}.`);
  const packs = parsearPacks(htmlATexto(await res.text()));

  // Guarda: si no encontramos ni un pack con precio, algo cambió en la web y
  // preferimos no tocar nada antes que guardar basura.
  if (!packs.some((p) => p.precio_mensual !== null)) {
    throw new Error(
      "No se pudo leer ningún precio de la página de packs. Puede haber cambiado el diseño de la web: no se tocaron los precios."
    );
  }
  return packs;
}

/** Texto de los packs para inyectar en el prompt del post-meet. */
export function packsParaPrompt(packs: PackWeb[]): string {
  if (packs.length === 0) return "";
  const lineas = packs.map((p) => {
    const precio =
      p.precio_mensual !== null
        ? `$${p.precio_mensual.toLocaleString("es-AR")}/mes`
        : "a cotizar segun el caso";
    const vol = [
      p.reels !== null ? `${p.reels} reels` : null,
      p.posts !== null ? `${p.posts} posts` : null,
      p.dias_historias !== null ? `${p.dias_historias} dias de historias` : null,
    ]
      .filter(Boolean)
      .join(" + ");
    return `- **Pack ${p.nombre}** — ${precio}.${vol ? ` ${vol}.` : ""}${
      p.descripcion ? ` ${p.descripcion}` : ""
    }`;
  });
  return lineas.join("\n");
}
