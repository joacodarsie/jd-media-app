/**
 * Qué parte de lo publicado carga el calendario (1/11/2026). Lo pendiente viaja
 * siempre; lo publicado, solo el mes que se mira y sus dos vecinos: eran 700
 * piezas que se mandaban en cada visita para ver un mes.
 */
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

function correr(mes: string, meses: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + meses, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** El mes pedido por URL, o el actual si no vino o está mal escrito. */
export function mesPedido(valor: string | undefined, hoy: string): string {
  return valor && MES.test(valor) ? valor : hoy.slice(0, 7);
}

/** Límites de la ventana: del primer día del mes anterior al del subsiguiente. */
export function ventanaDeMes(mes: string): { desde: string; hasta: string } {
  return { desde: `${correr(mes, -1)}-01`, hasta: `${correr(mes, 2)}-01` };
}

/** ¿Ese mes ya está cargado? Si no, hay que pedirle al servidor su ventana. */
export function mesCargado(mes: string, centro: string): boolean {
  return mes >= correr(centro, -1) && mes <= correr(centro, 1);
}
