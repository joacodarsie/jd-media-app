import { periodLabel } from "@/lib/finanzas";

/**
 * Mensaje de WhatsApp para pedir la encuesta del mes. Corto a propósito: la
 * encuesta es de 3 preguntas y si el mensaje parece un formulario, no la
 * contestan. Se firma con el nombre de quien la manda.
 */
export function buildSurveyMessage(input: {
  contactoNombre?: string | null;
  clienteNombre: string;
  periodo: string;
  url: string;
  deParte?: string | null;
}): string {
  const { contactoNombre, clienteNombre, periodo, url, deParte } = input;
  const saludo = contactoNombre?.trim()
    ? `¡Hola ${contactoNombre.trim().split(" ")[0]}!`
    : `¡Hola! Les escribo por ${clienteNombre}.`;
  const firma = deParte?.trim() ? `\n\n${deParte.trim()} — JD Media` : "";
  return (
    `${saludo} ¿Nos das una mano con algo cortito? ` +
    `Estamos cerrando ${periodLabel(periodo).toLowerCase()} y queremos saber cómo venimos.\n\n` +
    `Son 3 preguntas, menos de un minuto:\n${url}\n\n` +
    `Nos sirve muchísimo para ajustar lo que haga falta 🙌${firma}`
  );
}

/** URL pública de la encuesta a partir del token del portal. */
export function surveyUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/encuesta/${token}`;
}
