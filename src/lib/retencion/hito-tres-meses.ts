/**
 * El hito de los 3 meses (22/10/2026).
 *
 * Las 7 bajas reales de la agencia se fueron antes de cumplir 3,4 meses: el
 * cliente se va cuando todavía no vio resultados. Así que, a los 75 días de
 * arrancar, al director creativo de la cuenta le llega una tarea para
 * mostrarle al cliente cuánto creció: el antes y el después de su Instagram
 * (ya se arma solo en Crecimiento) y un mensaje listo para mandar. En el
 * portal, el cliente ve un festejo de «3 meses juntos» esos mismos días.
 *
 * Puro: entra la fecha de alta y hoy, sale si toca y qué decir.
 */

/** Desde qué día y hasta cuál se muestra el hito. */
export const HITO_DESDE = 75;
export const HITO_HASTA = 100;

export function diasDesde(fechaInicio: string, hoy: string): number {
  const t = (f: string) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));
  return Math.round((t(hoy) - t(fechaInicio.slice(0, 10))) / 86_400_000);
}

/** ¿Está en la ventana de los 3 meses? */
export function enHitoTresMeses(fechaInicio: string | null, hoy: string): boolean {
  if (!fechaInicio) return false;
  const d = diasDesde(fechaInicio, hoy);
  return d >= HITO_DESDE && d <= HITO_HASTA;
}

/** La fecha límite: el día 90, o en 3 días si ya pasó. */
export function limiteHito(fechaInicio: string, hoy: string): string {
  const t = Date.UTC(+fechaInicio.slice(0, 4), +fechaInicio.slice(5, 7) - 1, +fechaInicio.slice(8, 10)) + 90 * 86_400_000;
  const dia90 = new Date(t).toISOString().slice(0, 10);
  if (dia90 > hoy) return dia90;
  const h = Date.UTC(+hoy.slice(0, 4), +hoy.slice(5, 7) - 1, +hoy.slice(8, 10)) + 3 * 86_400_000;
  return new Date(h).toISOString().slice(0, 10);
}

export const claveHito = (clienteId: string) => `hito3m:${clienteId}`;

/** «subió de 62 a 67 seguidores (+8%)», o null si no hay con qué medir. */
export function frase(antes: number | null, ahora: number | null): string | null {
  if (antes == null || ahora == null || antes <= 0) return null;
  const pct = Math.round(((ahora - antes) / antes) * 100);
  if (ahora <= antes) return null;
  return `pasó de ${antes.toLocaleString("es-AR")} a ${ahora.toLocaleString("es-AR")} seguidores (+${pct}%)`;
}

export function mensajeHito(input: { contacto: string | null; cuenta: string; crecimiento: string | null; link: string | null }): string {
  const nombre = input.contacto?.trim().split(/\s+/)[0];
  const saludo = nombre && nombre.toLowerCase() !== input.cuenta.toLowerCase() ? `¡Hola ${nombre}!` : "¡Hola!";
  const numeros = input.crecimiento ? ` En este tiempo ${input.cuenta} ${input.crecimiento}.` : "";
  const link = input.link ? `\n\nEn tu plataforma podés ver el antes y el después de la cuenta:\n${input.link}` : "";
  return (
    `${saludo} 🎉 Se cumplen 3 meses trabajando juntos.${numeros} ` +
    `Gracias por la confianza: en la reunión de cierre te mostramos todo y lo que viene.${link}`
  );
}

export function tareaHito(input: { cuenta: string; clienteId: string; mensaje: string }): { titulo: string; descripcion: string } {
  return {
    titulo: `🎉 3 meses con ${input.cuenta}: mostrale cuánto creció`,
    descripcion: [
      `**Por qué:** todas las bajas de la agencia fueron antes del mes 3. Este es el momento de que el cliente vea el resultado.`,
      ``,
      `1. Abrí el antes y el después de la cuenta: /clientes/${input.clienteId}/crecimiento`,
      `2. Mandale este mensaje (al contacto o al grupo):`,
      ``,
      `> ${input.mensaje.replace(/\n/g, "\n> ")}`,
      ``,
      `3. En la reunión de cierre, mostrá el antes y el después y proponé el paso que sigue.`,
    ].join("\n"),
  };
}
