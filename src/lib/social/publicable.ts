/**
 * ¿Esta publicación va a salir sola, o le falta algo?
 *
 * Existe porque el auto-publicador falla EN SILENCIO: el cron solo levanta las
 * que cumplen TODAS las condiciones, y si alguna falta la pieza simplemente no
 * sale y nadie se entera. El caso real: una publicación con el auto-publicar
 * activado, el archivo cargado y la cuenta conectada, que no salía porque
 * estaba en estado "idea" en vez de "aprobado".
 *
 * Puro: se usa para pintar el chip en el calendario y el detalle, sin abrir
 * el formulario de edición.
 */

export interface PubParaPublicar {
  red: string;
  estado: string;
  auto_publicar?: boolean | null;
  publish_media?: { path: string }[] | null;
  fecha_publicacion?: string | null;
  published_at?: string | null;
  publish_error?: string | null;
}

export interface ClienteParaPublicar {
  ig_user_id?: string | null;
}

export type EstadoAuto =
  | "publicada"
  | "error"
  | "lista"
  | "falta_algo"
  | "manual";

export interface ChequeoAuto {
  estado: EstadoAuto;
  /** Qué falta, en criollo y accionable. Vacío si está lista. */
  faltan: string[];
  /** Frase corta para el chip. */
  label: string;
}

export function chequearAutoPublicacion(
  pub: PubParaPublicar,
  cliente?: ClienteParaPublicar | null
): ChequeoAuto {
  if (pub.published_at)
    return { estado: "publicada", faltan: [], label: "Publicada automáticamente" };

  if (pub.publish_error)
    return { estado: "error", faltan: [pub.publish_error], label: "Falló al publicar" };

  if (!pub.auto_publicar)
    return { estado: "manual", faltan: [], label: "Se publica a mano" };

  const faltan: string[] = [];

  // El orden importa: primero lo que más se olvida.
  if (pub.estado !== "aprobado")
    faltan.push('El estado tiene que ser "Aprobado" (hoy está en otro estado)');
  if (pub.red !== "instagram")
    faltan.push("Por ahora solo se publica solo en Instagram");
  if (!pub.publish_media?.length)
    faltan.push("Falta subir el archivo que se va a publicar");
  if (!cliente?.ig_user_id)
    faltan.push("La cuenta no tiene el Instagram conectado");
  if (!pub.fecha_publicacion) faltan.push("Falta la fecha y hora");

  return faltan.length
    ? { estado: "falta_algo", faltan, label: "No va a salir sola" }
    : { estado: "lista", faltan: [], label: "Programada ✓" };
}

/** Clases del chip según el estado (mismo criterio de color que el resto). */
export function chipAutoClase(estado: EstadoAuto): string {
  switch (estado) {
    case "publicada":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "lista":
      return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300";
    case "falta_algo":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "error":
      return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}
