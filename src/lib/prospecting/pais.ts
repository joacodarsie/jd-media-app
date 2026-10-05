/**
 * En qué país se busca y si el contacto es de ahí.
 *
 * Pedido del dueño (5/10/2026): una búsqueda de "Córdoba" trajo negocios de
 * Córdoba, España. Si la zona de la campaña no nombra otro país, se busca en
 * ARGENTINA: la zona se le pasa a la búsqueda con el país al final y los
 * teléfonos de otro país se descartan.
 *
 * Puro, para probarlo sin base.
 */

/** País → cómo se lo reconoce en la zona y su código telefónico. */
const PAISES: { pais: string; claves: RegExp; codigo: string }[] = [
  { pais: "España", claves: /\b(españa|espana|madrid|barcelona|valencia|sevilla|m[aá]laga|bilbao|zaragoza)\b/i, codigo: "34" },
  { pais: "México", claves: /\b(m[eé]xico|cdmx|guadalajara|monterrey)\b/i, codigo: "52" },
  { pais: "Chile", claves: /\b(chile|santiago de chile|valpara[ií]so|vi[nñ]a del mar)\b/i, codigo: "56" },
  { pais: "Uruguay", claves: /\b(uruguay|montevideo|punta del este)\b/i, codigo: "598" },
  { pais: "Paraguay", claves: /\b(paraguay|asunci[oó]n)\b/i, codigo: "595" },
  { pais: "Colombia", claves: /\b(colombia|bogot[aá]|medell[ií]n)\b/i, codigo: "57" },
  { pais: "Perú", claves: /\b(per[uú]|lima)\b/i, codigo: "51" },
  { pais: "Estados Unidos", claves: /\b(estados unidos|eeuu|usa|miami|new york|nueva york|texas|florida)\b/i, codigo: "1" },
];

export interface PaisBusqueda {
  pais: string;
  /** Código telefónico sin "+". */
  codigo: string;
}

export function paisDeZona(ubicacion: string | null | undefined): PaisBusqueda {
  const z = ubicacion ?? "";
  for (const p of PAISES) if (p.claves.test(z)) return { pais: p.pais, codigo: p.codigo };
  return { pais: "Argentina", codigo: "54" };
}

/** La zona lista para buscar: con el país al final si no lo dice. */
export function zonaConPais(ubicacion: string | null | undefined): string {
  const z = ubicacion?.trim();
  const { pais } = paisDeZona(z);
  if (!z) return pais;
  const yaLoDice = new RegExp(pais.normalize("NFD").replace(/[̀-ͯ]/g, ""), "i").test(
    z.normalize("NFD").replace(/[̀-ͯ]/g, "")
  );
  return yaLoDice || pais !== "Argentina" ? z : `${z}, Argentina`;
}

/**
 * ¿El teléfono es de otro país? Solo se puede saber si trae código (+34, 0034).
 * Uno sin código se toma como local.
 */
export function telefonoDeOtroPais(telefono: string | null | undefined, codigo: string): boolean {
  if (!telefono) return false;
  const t = telefono.trim();
  let d: string;
  if (t.startsWith("+")) d = t.slice(1).replace(/\D/g, "");
  else if (t.replace(/\D/g, "").startsWith("00")) d = t.replace(/\D/g, "").slice(2);
  else return false;
  return !d.startsWith(codigo);
}
