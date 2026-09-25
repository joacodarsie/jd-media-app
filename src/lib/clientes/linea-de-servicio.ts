/**
 * La línea de negocio de cada cliente, para separar la lista de Clientes
 * (pedido del dueño, 25/9/2026): no es lo mismo una cuenta de gestión de redes
 * que una que solo tiene publicidad (Origen Studio) o un pack de marca de pago
 * único (Simple Snack). Mezclados, la lista no dice qué negocio es cada uno.
 *
 * Una cuenta va en UN solo grupo: el de su servicio principal. Los extras de
 * la gestión de redes (WhatsApp, chatter, Google, pauta) no la mueven de ahí.
 *
 * Puro, para testearlo.
 */

export type LineaServicio = "redes" | "publicidad" | "marca" | "web" | "audiovisual" | "otros" | "sin_servicio";

export const LINEAS: { value: LineaServicio; label: string }[] = [
  { value: "redes", label: "Gestión de redes" },
  { value: "publicidad", label: "Publicidad" },
  { value: "marca", label: "Branding y diseño" },
  { value: "web", label: "Web" },
  { value: "audiovisual", label: "Producción audiovisual" },
  { value: "otros", label: "Otros servicios" },
  { value: "sin_servicio", label: "Sin servicio cargado" },
];

/** De más a menos importante: la primera que tenga la cuenta, manda. */
const PRIORIDAD: [LineaServicio, string[]][] = [
  ["redes", ["gestion_redes"]],
  ["publicidad", ["paid_media", "google_ads"]],
  ["marca", ["branding", "diseno_grafico"]],
  ["web", ["desarrollo_web"]],
  ["audiovisual", ["edicion_audiovisual"]],
];

export function lineaDeServicio(tipos: string[]): LineaServicio {
  if (tipos.length === 0) return "sin_servicio";
  for (const [linea, deEsta] of PRIORIDAD) {
    if (tipos.some((t) => deEsta.includes(t))) return linea;
  }
  return "otros";
}
