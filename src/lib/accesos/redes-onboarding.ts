/**
 * Los accesos del arranque, red por red (20/10/2026, pedido del dueño). Antes
 * era un solo paso «Acceso a todas las cuentas del cliente» que se tildaba a
 * mano y no decía qué faltaba. Ahora hay un paso por red (Instagram, TikTok,
 * página de Facebook) con su link, usuario, contraseña y notas, y cada uno se
 * marca solo cuando está cargado (link + usuario) o cuando se aclara que el
 * cliente no tiene esa red.
 *
 * Todo se guarda en `clients.credenciales`, la misma lista de la ficha (las
 * contraseñas, cifradas: lib/accesos/cifrado). Módulo PURO.
 */

export type RedOnboarding = "instagram" | "tiktok" | "facebook";

export const REDES_ONBOARDING: { clave: RedOnboarding; servicio: string; titulo: string; ejemploUrl: string }[] = [
  { clave: "instagram", servicio: "Instagram", titulo: "Acceso a Instagram", ejemploUrl: "https://instagram.com/marca" },
  { clave: "tiktok", servicio: "TikTok", titulo: "Acceso a TikTok", ejemploUrl: "https://tiktok.com/@marca" },
  { clave: "facebook", servicio: "Facebook", titulo: "Acceso a la página de Facebook", ejemploUrl: "https://facebook.com/marca" },
];

export const NOTA_NO_TIENE = "El cliente no tiene esta red.";

export interface CredencialRed {
  servicio?: string;
  usuario?: string;
  password?: string;
  url?: string;
  notas?: string;
}

const norm = (s: string | undefined) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** ¿Esta fila de credenciales es de esa red? Acepta cómo la escribe el equipo a mano. */
export function esDeLaRed(c: CredencialRed, red: RedOnboarding): boolean {
  const s = norm(c.servicio);
  const u = norm(c.url);
  if (red === "instagram") return /\binsta|^ig\b/.test(s) || u.includes("instagram.com");
  if (red === "tiktok") return /tik ?tok/.test(s) || u.includes("tiktok.com");
  // La página de Facebook, no el Business Suite ni el administrador de anuncios.
  return (/\bfacebook\b|^fb\b|pagina de facebook/.test(s) && !/business|ads|anuncio/.test(s)) || (u.includes("facebook.com") && !u.includes("business."));
}

export function credencialDeRed<T extends CredencialRed>(lista: T[], red: RedOnboarding): T | null {
  return lista.find((c) => esDeLaRed(c, red)) ?? null;
}

export type EstadoAcceso = "listo" | "no_tiene" | "a_medias" | "falta";

export function estadoAcceso(c: CredencialRed | null): EstadoAcceso {
  if (!c) return "falta";
  if (c.notas?.includes(NOTA_NO_TIENE)) return "no_tiene";
  if (c.url?.trim() && c.usuario?.trim()) return "listo";
  return c.url?.trim() || c.usuario?.trim() || c.password ? "a_medias" : "falta";
}

export const accesoHecho = (e: EstadoAcceso) => e === "listo" || e === "no_tiene";

/** Qué falta, en una línea, para mostrar en el paso. */
export function queFalta(c: CredencialRed | null): string | null {
  const e = estadoAcceso(c);
  if (accesoHecho(e)) return null;
  const falta = [!c?.url?.trim() && "el link", !c?.usuario?.trim() && "el usuario"].filter(Boolean);
  return `Falta ${falta.join(" y ")}.`;
}

/**
 * Guarda la red en la lista: actualiza su fila (la primera que coincida) o la
 * agrega. Una contraseña vacía no pisa la que ya estaba. «No tiene» deja la
 * fila con la nota y sin datos.
 */
export function guardarAccesoDeRed<T extends CredencialRed>(
  lista: T[],
  red: RedOnboarding,
  datos: { url?: string; usuario?: string; password?: string; notas?: string; noTiene?: boolean }
): CredencialRed[] {
  const def = REDES_ONBOARDING.find((r) => r.clave === red)!;
  const idx = lista.findIndex((c) => esDeLaRed(c, red));
  const previa: CredencialRed = idx >= 0 ? lista[idx] : {};
  const limpia = (s?: string) => (s ?? "").trim().slice(0, 500);
  const notasSinMarca = limpia(datos.notas).replace(NOTA_NO_TIENE, "").trim();
  const nueva: CredencialRed = datos.noTiene
    ? { servicio: previa.servicio || def.servicio, usuario: "", password: "", url: "", notas: [NOTA_NO_TIENE, notasSinMarca].filter(Boolean).join(" ") }
    : {
        servicio: previa.servicio || def.servicio,
        url: limpia(datos.url),
        usuario: limpia(datos.usuario),
        password: datos.password ? datos.password.slice(0, 200) : previa.password ?? "",
        notas: notasSinMarca,
      };
  const copia: CredencialRed[] = [...lista];
  if (idx >= 0) copia[idx] = { ...previa, ...nueva };
  else copia.push(nueva);
  return copia;
}
