/**
 * Las pestañas del portal del cliente (24/10/2026). Pedido del dueño: el
 * portal era una sola página larguísima y el calendario —lo que más importa
 * que el cliente apruebe— quedaba casi al final. Ahora se recorre por
 * pestañas, con el calendario primero.
 *
 * Puro: qué pestañas hay, cuál se abre y a cuál lleva cada aviso.
 */

export const PESTANAS = [
  { clave: "calendario", label: "Calendario", emoji: "📅" },
  { clave: "reunion", label: "Reunión", emoji: "🤝" },
  { clave: "resultados", label: "Resultados", emoji: "📈" },
  { clave: "estrategia", label: "Estrategia", emoji: "🧭" },
  { clave: "cuenta", label: "Tu cuenta", emoji: "⚙️" },
] as const;

export type Pestana = (typeof PESTANAS)[number]["clave"];

export function pestanaValida(v: string | string[] | undefined): Pestana {
  const s = Array.isArray(v) ? v[0] : v;
  return (PESTANAS.find((p) => p.clave === s)?.clave ?? "calendario") as Pestana;
}

/** En qué pestaña vive cada sección del portal (por su ancla). */
const ANCLA_A_PESTANA: Record<string, Pestana> = {
  "#revisar": "calendario",
  "#calendario": "calendario",
  "#reunion": "reunion",
  "#encuesta": "reunion",
  "#reportes": "resultados",
  "#crecimiento": "resultados",
  "#abono": "cuenta",
  "#material": "cuenta",
  "#accesos": "cuenta",
};

/** Los avisos de «Lo que te toca a vos» llevan a la pestaña donde está eso. */
export function hrefDeAviso(href: string | null): string | null {
  if (!href || !href.startsWith("#")) return href;
  const p = ANCLA_A_PESTANA[href];
  return p ? `?ver=${p}${href}` : href;
}
