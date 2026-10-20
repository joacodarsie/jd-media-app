/**
 * La carta acuerdo de cada mes (20/10/2026, pedido del dueño): todos los meses,
 * antes del cobro del 1 al 5, se le manda al cliente la carta vigente para el
 * mes que viene con el abono y los plazos del material crudo con fechas
 * concretas. El material que llega tarde es lo que más atrasa la producción, y
 * hasta ahora el cliente solo leía esos plazos una vez, al firmar.
 *
 * Mientras no esté conectada la API de WhatsApp Business, el envío es una
 * tarea para la PM con el mensaje listo (wa.me). Módulo PURO.
 *
 * Plazos (cláusula «material» de lib/contract-clauses): lo que sale del 16 al
 * fin de mes se presenta el 1 y 2, se aprueba el 5 y el material llega 2 días
 * después (el 7); lo que sale del 1 al 15 del mes siguiente se presenta del 15
 * al 17, se aprueba el 20 y el material llega el 22.
 */
import { periodLabel, fmtCurrency } from "@/lib/finanzas";
import { COBRO_HASTA_DIA } from "@/lib/finanzas/ciclo-cobro";

/** El mes siguiente a una fecha «YYYY-MM-DD», como «YYYY-MM». */
export function periodoSiguiente(hoyYmd: string): string {
  const y = +hoyYmd.slice(0, 4), m = +hoyYmd.slice(5, 7);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

const ultimoDia = (periodo: string) => new Date(Date.UTC(+periodo.slice(0, 4), +periodo.slice(5, 7), 0)).getUTCDate();

/** Las fechas del mes: qué se presenta, hasta cuándo se aprueba y cuándo llega el material. */
export function plazosDelMes(periodo: string) {
  const mes = periodLabel(periodo).replace(/ de \d{4}$/, "");
  const siguiente = periodLabel(periodoSiguiente(`${periodo}-01`)).replace(/ de \d{4}$/, "");
  return {
    mes,
    segundaQuincena: { sale: `del 16 al ${ultimoDia(periodo)} de ${mes}`, presenta: "el 1 y 2", aprueba: 5, material: 7 },
    primeraDelSiguiente: { sale: `del 1 al 15 de ${siguiente}`, presenta: "del 15 al 17", aprueba: 20, material: 22 },
  };
}

/**
 * El mensaje para el cliente. Sin emojis fuera del plano básico: WhatsApp Web
 * los corrompe al precargar el texto desde wa.me (ver lib/payment-reminder).
 */
export function mensajeCartaMensual(i: {
  contacto: string | null;
  marca: string;
  periodo: string;
  monto: number;
  moneda: string;
  link: string | null;
}): string {
  const p = plazosDelMes(i.periodo);
  const montoTxt = i.monto > 0 ? `*${fmtCurrency(i.monto, i.moneda)}*` : "el acordado";
  return [
    `¡Hola ${i.contacto?.trim().split(" ")[0] || i.marca}! Te compartimos la carta acuerdo vigente para ${p.mes}${i.link ? `: ${i.link}` : "."}`,
    ``,
    `El abono de ${p.mes} es ${montoTxt} y se abona del 1 al ${COBRO_HASTA_DIA}.`,
    ``,
    `Para que todo salga en fecha, estos son los plazos del mes:`,
    `• Lo que sale ${p.segundaQuincena.sale}: te presentamos el calendario ${p.segundaQuincena.presenta}, lo aprobás hasta el ${p.segundaQuincena.aprueba} y el *material crudo nos llega hasta el ${p.segundaQuincena.material}*.`,
    `• Lo que sale ${p.primeraDelSiguiente.sale}: calendario ${p.primeraDelSiguiente.presenta}, aprobación hasta el ${p.primeraDelSiguiente.aprueba} y *material crudo hasta el ${p.primeraDelSiguiente.material}*.`,
    ``,
    `Si el material no llega a tiempo, producimos con lo que tengamos o corremos esas piezas, y el abono no cambia. Cualquier duda, por acá. ¡Gracias!`,
  ].join("\n");
}

export const claveCartaMensual = (clienteId: string, periodo: string) => `carta:${clienteId}:${periodo}`;

/** Del 25 al 5 se muestra en el portal la carta del mes que viene (o del que arrancó). */
export function periodoCartaEnPortal(hoyYmd: string): string | null {
  const dia = +hoyYmd.slice(8, 10);
  if (dia >= 25) return periodoSiguiente(hoyYmd);
  if (dia <= COBRO_HASTA_DIA) return hoyYmd.slice(0, 7);
  return null;
}
