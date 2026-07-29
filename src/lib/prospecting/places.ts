/**
 * Google Places API (New) como fuente de contactos: datos VERIFICADOS de Google
 * en vez de un modelo leyendo páginas.
 *
 * Por qué existe: el extractor con IA interpreta lo que encuentra y a veces trae
 * el teléfono de recepción, uno viejo o directamente nada. Places devuelve el
 * teléfono y el sitio tal como los tiene Google, estructurados. No gasta tokens.
 *
 * Costo (julio 2026): pedir teléfono y sitio web cae en el SKU "Enterprise" de
 * Text Search — 1.000 búsquedas gratis por mes y US$35 cada 1.000 después. Como
 * cada búsqueda devuelve hasta 20 negocios, 1.000 búsquedas ≈ 20.000 negocios:
 * el volumen de la agencia entra holgado en el tramo gratis.
 */
import { esProbableFijoAr } from "./shared";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/** Solo los campos que usamos: el field mask define el precio de la llamada. */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  // Pedimos los dos formatos (están en el mismo tramo de precio) y preferimos el
  // internacional: el nacional a veces viene sin código de área ("482-2080"),
  // que no sirve para armar el link de WhatsApp.
  "places.internationalPhoneNumber",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "nextPageToken",
].join(",");

/** Máximo que devuelve Google por página. */
const PAGE_SIZE = 20;

export interface PlaceContacto {
  empresa: string;
  telefono: string | null;
  sitio_web: string | null;
  direccion: string | null;
}

export function placesConfigured(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

interface PlaceRaw {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
}

/**
 * Busca negocios reales en Google Maps. `cantidad` se redondea hacia arriba a
 * páginas de 20 (cada página es una llamada facturable).
 */
export async function searchPlaces(input: {
  rubro: string;
  ubicacion: string | null;
  cantidad: number;
  /** Empresas que ya tenemos: se filtran acá para no gastar filas repetidas. */
  excludeEmpresas?: string[];
}): Promise<PlaceContacto[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("Falta configurar GOOGLE_PLACES_API_KEY.");

  const zona = input.ubicacion?.trim() || "Argentina";
  const textQuery = `${input.rubro.trim()} en ${zona}`;
  const yaTengo = new Set(
    (input.excludeEmpresas ?? []).map((e) => e.toLowerCase().trim())
  );

  const out: PlaceContacto[] = [];
  const vistas = new Set<string>();
  let pageToken: string | undefined;
  // Tope de páginas por las dudas: 5 páginas = 100 negocios = 5 llamadas.
  const maxPaginas = Math.min(Math.ceil(input.cantidad / PAGE_SIZE) + 1, 5);

  for (let i = 0; i < maxPaginas && out.length < input.cantidad; i++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "es",
        regionCode: "AR",
        pageSize: PAGE_SIZE,
        ...(pageToken ? { pageToken } : {}),
      }),
    });

    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      throw new Error(friendlyPlacesError(res.status, detalle));
    }

    const data = (await res.json()) as { places?: PlaceRaw[]; nextPageToken?: string };
    for (const p of data.places ?? []) {
      const empresa = p.displayName?.text?.trim();
      if (!empresa) continue;
      const key2 = empresa.toLowerCase().trim();
      if (vistas.has(key2) || yaTengo.has(key2)) continue;
      vistas.add(key2);
      out.push({
        empresa: empresa.slice(0, 160),
        telefono:
          p.internationalPhoneNumber?.trim() || p.nationalPhoneNumber?.trim() || null,
        sitio_web: p.websiteUri?.trim().slice(0, 300) || null,
        direccion: p.formattedAddress?.trim().slice(0, 200) || null,
      });
      if (out.length >= input.cantidad) break;
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return out;
}

/**
 * Se queda con los que se pueden trabajar: hace falta un celular o un sitio web
 * (mismo criterio que el extractor con IA — un fijo suelto no sirve para
 * WhatsApp y sin web tampoco hay dónde buscar el número real).
 */
export function filtrarContactables(contactos: PlaceContacto[]): PlaceContacto[] {
  return contactos.filter((c) => {
    const movil = !!c.telefono && !esProbableFijoAr(c.telefono);
    return movil || !!c.sitio_web;
  });
}

/** Traduce los errores de Google a algo accionable. */
export function friendlyPlacesError(status: number, detalle: string): string {
  const d = detalle.toLowerCase();
  if (status === 403 && d.includes("api key not valid"))
    return "La clave de Google no es válida. Revisá GOOGLE_PLACES_API_KEY.";
  if (status === 403 && d.includes("blocked"))
    return "La clave existe pero tiene restricciones que bloquean la llamada. En Google Cloud, dejale solo la restricción de API (Places API New) y ninguna de aplicación.";
  if (status === 403)
    return "Google rechazó la llamada. Chequeá que la Places API (New) esté habilitada y que el proyecto tenga facturación activada.";
  if (status === 429)
    return "Se pasó la cuota de Google por hoy. Probá más tarde o subí el límite en la consola.";
  if (status === 400)
    return "Google no entendió la búsqueda. Revisá el rubro y la ubicación de la campaña.";
  return `Google devolvió un error (${status}). Probá de nuevo en un rato.`;
}
