/**
 * El recordatorio a la CM: la pieza salió y falta el link del posteo.
 *
 * El candado de `link-publicado` solo corre cuando alguien marca la pieza como
 * publicada Y la pieza se creó después del 13/9/2026. Todo lo anterior entra
 * sin link, y el resultado se ve en los números: de las 29 piezas de septiembre
 * que no son historias, 14 quedaron sin link. Sin link no se puede abrir el
 * posteo, ni medir repercusión, ni armar el informe del cliente.
 *
 * Un candado que se puede esquivar necesita a alguien que avise. Esto le manda
 * a cada CM, una vez por día, cuántas piezas suyas quedaron sin link.
 *
 * Es deliberadamente tacaño: solo cuentas las piezas de los últimos 30 días,
 * solo se avisa a partir de cierta cantidad y el aviso es un `recordatorio`,
 * así que la higiene de la campana lo borra solo a la semana. Acabamos de
 * bajar los avisos de 870 a 565: esto no puede volver a llenarla.
 *
 * Módulo PURO: entran las piezas y las cuentas, salen los avisos.
 */
import { esLinkValido, tiposQuePidenLink } from "./link-publicado";

/** A partir de cuántas piezas sin link se avisa. Menos que esto es ruido. */
export const MINIMO_PARA_AVISAR = 3;
/** Cuántos días para atrás se miran. Más viejo que eso nadie lo completa. */
export const DIAS_HACIA_ATRAS = 30;

export interface PiezaPublicada {
  id: string;
  titulo: string | null;
  tipo: string | null;
  estado: string;
  cliente_id: string;
  /** "YYYY-MM-DD" o ISO. */
  fecha_publicacion: string | null;
  link_instagram?: string | null;
}

export interface CuentaConCm {
  id: string;
  nombre: string;
  cm_id: string | null;
}

export interface AvisoLinkFaltante {
  userId: string;
  mensaje: string;
  link: string;
}

/** Las piezas que salieron y quedaron sin link, dentro de la ventana. */
export function piezasSinLink(
  piezas: PiezaPublicada[],
  desde: string
): PiezaPublicada[] {
  return piezas.filter((p) => {
    if (p.estado !== "publicado") return false;
    if (!tiposQuePidenLink(p.tipo)) return false;
    if (esLinkValido(p.link_instagram)) return false;
    const fecha = (p.fecha_publicacion ?? "").slice(0, 10);
    return !!fecha && fecha >= desde;
  });
}

/**
 * Un aviso por CM, con el total y la cuenta que más debe.
 *
 * Se agrupa por persona y no por cuenta: una CM con cuatro cuentas recibiría
 * cuatro avisos por el mismo pedido, y ahí deja de leerlos.
 */
export function avisosDeLinkFaltante(input: {
  piezas: PiezaPublicada[];
  cuentas: CuentaConCm[];
  desde: string;
  minimo?: number;
}): AvisoLinkFaltante[] {
  const minimo = input.minimo ?? MINIMO_PARA_AVISAR;
  const cuenta = new Map(input.cuentas.map((c) => [c.id, c]));
  const faltantes = piezasSinLink(input.piezas, input.desde);

  // userId → cuenta_id → cuántas
  const porPersona = new Map<string, Map<string, number>>();
  for (const p of faltantes) {
    const c = cuenta.get(p.cliente_id);
    if (!c?.cm_id) continue;
    const suyas = porPersona.get(c.cm_id) ?? new Map<string, number>();
    suyas.set(c.id, (suyas.get(c.id) ?? 0) + 1);
    porPersona.set(c.cm_id, suyas);
  }

  const avisos: AvisoLinkFaltante[] = [];
  for (const [userId, porCuenta] of porPersona) {
    const total = [...porCuenta.values()].reduce((a, b) => a + b, 0);
    if (total < minimo) continue;
    const [peorId, peorN] = [...porCuenta.entries()].sort((a, b) => b[1] - a[1])[0];
    const nombre = cuenta.get(peorId)?.nombre ?? "una cuenta";
    const detalle =
      porCuenta.size === 1
        ? `de ${nombre}`
        : `${peorN} de ${nombre} y el resto en otras ${porCuenta.size - 1} cuenta${porCuenta.size > 2 ? "s" : ""}`;
    avisos.push({
      userId,
      link: `/contenidos?cliente=${peorId}`,
      mensaje: `🔗 Tenés ${total} pieza${total === 1 ? "" : "s"} publicada${total === 1 ? "" : "s"} sin el link del posteo (${detalle}). Sin el link no entran en el informe del cliente: cargalo en la pieza.`,
    });
  }
  return avisos.sort((a, b) => a.userId.localeCompare(b.userId));
}
