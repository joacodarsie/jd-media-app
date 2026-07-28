/**
 * Modo RÁPIDO de prospección: extraer contactos con el MÍNIMO de tokens.
 *
 * A diferencia de `discover.ts` (que además verifica el Instagram con otra
 * llamada y genera un mensaje personalizado por lead), acá hacemos UNA sola
 * pasada con el modelo barato (Haiku) y pocas búsquedas web, y traemos solo lo
 * imprescindible para escribir a mano en volumen: empresa, persona de contacto,
 * su rol y el teléfono. Nada de gancho/idea/mensaje. Si un dato no está, va null
 * (misma regla dura de siempre: PROHIBIDO inventar).
 */
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL_FAST } from "@/lib/ai/models";
import { trackAiUsage } from "@/lib/ai/usage";
import { toHandle } from "./verify";
import { esProbableFijoAr } from "./shared";

const client = new Anthropic();

export interface ExtractContext {
  nombre: string;
  rubro: string;
  ubicacion: string | null;
  idioma: string;
  /** Dónde buscar: maps | google | linkedin | instagram | demanda. */
  fuente?: string;
  /** Empresas ya cargadas, para no repetirlas. */
  excludeEmpresas?: string[];
}

/** Estrategia de búsqueda según la fuente elegida. */
function fuenteInstruction(fuente: string | undefined, ctx: ExtractContext): string {
  const zona = ctx.ubicacion ?? "Argentina";
  switch (fuente) {
    case "linkedin":
      return `DÓNDE BUSCAR: LINKEDIN.
Buscá páginas de empresa y perfiles de LinkedIn del rubro en la zona (probá búsquedas tipo "site:linkedin.com/company ${ctx.rubro} ${zona}" y "site:linkedin.com/in gerente marketing ${ctx.rubro} ${zona}").
Acá lo VALIOSO es el NOMBRE y el CARGO del decisor (dueño/a, gerente de marketing, socio). El teléfono casi nunca es público en LinkedIn: si no lo encontrás, poné null — NO lo inventes ni pongas uno "probable".`;
    case "instagram":
      return `DÓNDE BUSCAR: INSTAGRAM.
Buscá cuentas de Instagram del rubro en la zona. Priorizá cuentas ACTIVAS pero con presencia floja (poco posteo, sin estrategia): son nuestro mejor cliente.
Muchas tienen WhatsApp/teléfono en la bio o en la web enlazada: traelo de ahí si aparece en los resultados. Si no, null.`;
    case "google":
      return `DÓNDE BUSCAR: GOOGLE AMPLIO.
Buscá sitios oficiales, directorios del rubro, guías y notas tipo "mejores ${ctx.rubro} en ${zona}". Sacá el teléfono de la sección contacto del sitio oficial, que es el dato más confiable.`;
    case "demanda":
      return `MODO ALTA INTENCIÓN DE COMPRA (el más valioso).
NO busques por rubro: buscá empresas de ${zona} que AHORA MISMO están necesitando lo que vendemos. Concretamente:
- Avisos de empleo buscando "community manager", "diseñador gráfico", "editor audiovisual", "encargado/a de marketing", "social media" o "publicidad/ads" (portales de empleo, LinkedIn Jobs, bolsas locales).
- Empresas pidiendo presupuesto o buscando agencia de marketing.
Una empresa que está por contratar un CM tiene el presupuesto y la necesidad YA declarada: puede contratarnos a nosotros en lugar de tomar a alguien. Esa es la mejor señal de compra que existe.
Traé la EMPRESA que publica, la persona de contacto/recruiter si aparece, su rol, y el teléfono si está publicado (si no, null).`;
    case "maps":
      return `DÓNDE BUSCAR: GOOGLE MAPS Y LISTADOS LOCALES.
Buscá en listados tipo Google Maps, directorios y guías de comercios de la zona. Priorizá negocios con dirección física en ${zona}. Es la vía que más teléfonos publica: aprovechala para traer el teléfono de cada uno.`;
    default:
      return `DÓNDE BUSCAR: EN TODOS LADOS, QUEDÁNDOTE CON LOS MEJORES.
Combiná las fuentes en vez de casarte con una, y priorizá CALIDAD de prospecto sobre cantidad:
- Google Maps / directorios locales: negocios con dirección en ${zona} (es donde más teléfonos hay).
- Google amplio: sitios oficiales del rubro, rankings y notas.
- LinkedIn: para sacar el NOMBRE y CARGO del decisor cuando el negocio lo justifique.
- Instagram: cuentas del rubro activas pero con presencia digital floja.
CRITERIO DE "MEJOR PROSPECTO" (ordená la lista por esto):
1. Que se note que NOS NECESITA (presencia digital floja, sin pauta, web pobre o abandonada).
2. Que pueda PAGAR (negocio establecido, varios locales, productos de ticket alto).
3. Que sea CONTACTABLE (tiene teléfono público, o al menos persona identificada).
Traé primero los que cumplen los tres. Mezclá el origen: no devuelvas 15 de la misma fuente si podés cruzar datos (ej: el negocio lo encontraste en Maps y el nombre del dueño en LinkedIn).`;
  }
}

export interface ExtractedContact {
  empresa: string;
  contacto_nombre: string | null;
  contacto_rol: string | null;
  telefono: string | null;
  /** Handle de Instagram (sin @) — vía alternativa cuando no hay WhatsApp. */
  instagram: string | null;
  /** Sitio o link de la fuente, para abrir y mirar antes de escribir. */
  sitio_web: string | null;
}

function buildSystem(ctx: ExtractContext): string {
  const yaTenemos =
    ctx.excludeEmpresas && ctx.excludeEmpresas.length > 0
      ? `\n\nYA TENEMOS ESTAS EMPRESAS (NO las repitas, traé distintas):\n${ctx.excludeEmpresas
          .slice(0, 80)
          .map((e) => `- ${e}`)
          .join("\n")}`
      : "";
  return `Sos un prospector B2B de JD Media (agencia de marketing digital, Córdoba, Argentina). Tu única tarea es armar una LISTA DE CONTACTOS para que el equipo comercial escriba a mano. Trabajá rápido y barato: pocas búsquedas, datos justos.

CLUSTER OBJETIVO (campaña: "${ctx.nombre}")
- Rubro / nicho: ${ctx.rubro}
- Zona: ${ctx.ubicacion ?? "Argentina (priorizá esta zona)"}${yaTenemos}

${fuenteInstruction(ctx.fuente, ctx)}

QUÉ TRAER (solo esto, nada más)
- empresa: nombre real del negocio.
- contacto_nombre: nombre de la persona con quien conviene hablar (dueño/a, gerente, encargado/a de marketing). Es el nombre con el que lo vamos a saludar. Si no aparece público, null.
- contacto_rol: su cargo/rol en la empresa (ej: "Dueña", "Gerente comercial"). Si no se sabe, null.
- telefono: teléfono en formato internacional con + y código de país (ej: +54 351 1234567).
  ⚠️ CRÍTICO: nuestro canal es WHATSAPP, y en Argentina los teléfonos FIJOS no tienen WhatsApp.
  Un fijo publicado como número de recepción hace que el equipo escriba a un chat que no existe.
  - Buscá el CELULAR / WhatsApp que el negocio publica para que le escriban (suele estar en el botón "WhatsApp" de la web, en la ficha de Maps o en la bio de Instagram).
  - En Argentina los celulares se publican con "15" (ej: 351 15 331-9555) o con +54 9. Los que arrancan con 4 después del código de área (ej: 351 422-3152, 11 4321-8765) son FIJOS.
  - Si el único número que conseguís es un fijo, traelo igual, PERO en ese caso es OBLIGATORIO traer además el instagram o el sitio_web para que se pueda llegar por otro lado.
- instagram: el handle de su Instagram (solo el usuario, sin @ y sin URL, ej: gimnasioolimpo). Es LA VÍA ALTERNATIVA cuando no hay WhatsApp, así que buscalo SIEMPRE, incluso si ya consiguiste teléfono. PROHIBIDO deducirlo del nombre de la empresa: ponelo solo si viste el perfil real en un resultado. Si no lo viste, null.
- sitio_web: su sitio oficial, o el link de donde sacaste los datos (ficha de Maps, directorio, perfil). TRAELO SIEMPRE que exista, incluso si ya tenés teléfono e Instagram: el equipo entra a la web a buscar el WhatsApp real y a mirar el negocio antes de escribir. Es el dato que más se usa y el que más falta.

CÓMO
1. Usá la búsqueda web siguiendo la estrategia de "DÓNDE BUSCAR" de arriba. Priorizá PyMEs y negocios locales/medianos con presencia digital floja (mejores clientes para nosotros).
2. No te cuelgues investigando: con encontrar la empresa y una vía de contacto ya sirve. El nombre/rol de la persona sumalo si aparece; si no, null.

REGLAS DURAS
- PROHIBIDO inventar. Nada de teléfonos "de ejemplo" ni handles supuestos. Si no lo viste en un resultado real, va null.
- Solo negocios reales que existan hoy. Nada de agencias de marketing (son competencia) ni multinacionales grandes.
- Traé cada empresa una sola vez.
- CADA empresa tiene que quedar CONTACTABLE de verdad. Antes de incluirla, chequeá que tenga AL MENOS UNA de estas tres: (a) un celular/WhatsApp, (b) instagram, (c) sitio_web. Si solo conseguiste un teléfono FIJO y nada más, NO la incluyas: el equipo no puede escribirle.
- Ideal por empresa: celular + instagram + sitio_web. Cuantas más vías, mejor: si una falla, el equipo llega por otra en vez de perder el contacto.

SALIDA
Tu ÚLTIMO mensaje debe ser EXCLUSIVAMENTE un array JSON válido (sin markdown, sin texto antes ni después), con esta forma exacta por empresa:
{"empresa": string, "contacto_nombre": string|null, "contacto_rol": string|null, "telefono": string|null, "instagram": string|null, "sitio_web": string|null}
Solo el array JSON.`;
}

function safeParse(raw: string): ExtractedContact[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const out: ExtractedContact[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const empresa = str(o.empresa);
    if (!empresa) continue;
    const telefono = str(o.telefono);
    const instagram = toHandle(str(o.instagram));
    const sitioWeb = str(o.sitio_web);
    // Tiene que quedar alguna vía usable. El sitio web CUENTA: es donde el
    // equipo entra a buscar el WhatsApp real cuando el número publicado es un
    // fijo. Y un fijo solo, sin web ni Instagram, no sirve: wa.me abre un chat
    // muerto y el contacto se descarta igual, pero después de perder el tiempo.
    const soloFijo = !!telefono && esProbableFijoAr(telefono);
    const tieneVia = (!!telefono && !soloFijo) || !!instagram || !!sitioWeb;
    if (!tieneVia) continue;
    out.push({
      empresa: empresa.slice(0, 160),
      contacto_nombre: str(o.contacto_nombre)?.slice(0, 120) ?? null,
      contacto_rol: str(o.contacto_rol)?.slice(0, 120) ?? null,
      telefono: telefono?.slice(0, 40) ?? null,
      instagram,
      sitio_web: sitioWeb?.slice(0, 300) ?? null,
    });
  }
  return out;
}

/**
 * Extrae hasta `cantidad` contactos para el cluster en UNA sola llamada barata.
 * Devuelve los contactos crudos (sin guardar). Lanza el error de Anthropic si
 * falla (lo traduce el route).
 */
export async function extractContacts(
  ctx: ExtractContext,
  cantidad: number
): Promise<ExtractedContact[]> {
  const n = Math.min(Math.max(cantidad, 1), 25);
  const userMsg = `Armá una lista de ${n} contactos reales DISTINTOS para este cluster. Es importante que llegues a ${n}: hacé varias búsquedas distintas (directorios, Google Maps/listados, "mejores <rubro> en <zona>", barrios/ciudades cercanas) hasta juntar ${n}. Devolvé el array JSON. No inventes ningún dato: lo que no encuentres, null.`;

  const msg = await client.messages.create({
    model: AI_MODEL_FAST,
    max_tokens: 4000,
    // cache_control: al sacar contactos en tandas seguidas de la MISMA campaña,
    // la instrucción base (que es lo más largo) se sirve cacheada → menos tokens
    // de entrada y más barato por clic.
    system: [
      { type: "text", text: buildSystem(ctx), cache_control: { type: "ephemeral" } },
    ],
    // Suficientes búsquedas para completar la tanda sin dispararse en costo.
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 10 }],
    messages: [{ role: "user", content: userMsg }],
  });
  void trackAiUsage({ ruta: "prospeccion/contactos", modelo: AI_MODEL_FAST, usage: msg.usage });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return safeParse(text).slice(0, n);
}
