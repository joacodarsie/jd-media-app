/**
 * Una tarea por pestaña del onboarding (24/10/2026, pedido del dueño): «que a
 * todos les figure como tarea completar su onboarding con sus clientes». Las
 * pestañas (Inicial, Gestión de redes, Creativa, Community, Diseño, Publicidad)
 * tenían sus pasos pero nadie las abría si no se acordaba: no estaban en Mi día
 * ni en el aviso diario, que solo miran `tasks`.
 *
 * Ahora, cuando entra una cuenta, a cada responsable le nace «Completar el
 * onboarding de <pestaña> — <cliente>», con la fecha del arranque de 15 días en
 * que esa parte tiene que estar, y se cierra sola cuando la pestaña queda
 * completa.
 *
 * Módulo PURO: entran la cuenta, su equipo y sus servicios; salen las tareas.
 */
import { aplicaPorServicio, hrefDePanel, PANELES, type PanelOnboarding, type ServiciosDeLaCuenta } from "./paneles";

/** El día del arranque en que cada pestaña tiene que estar completa (ver onboarding-15). */
export const DIA_DEL_PANEL: Record<PanelOnboarding, number> = {
  inicial: 1, // carta, pago, equipo, grupo y kickoff: antes de empezar
  redes: 2, // Drive, tareas iniciales
  creativa: 4, // definición el día 2, los tres documentos el 4
  diseno: 5, // el kit se entrega el 3, lo aprueba el cliente el 5
  cm: 7, // accesos, perfil optimizado y vinculación
  pauta: 10, // primera campaña al aire
};

const QUIEN: Record<PanelOnboarding, string> = {
  inicial: "Estrategia/Dirección",
  redes: "Coordinación",
  creativa: "Coordinación de Diseño",
  cm: "Community Manager",
  diseno: "Diseño",
  pauta: "Paid Media",
};

export interface EquipoPaneles {
  dueno: string | null;
  coordinador_id: string | null;
  director_creativo_id: string | null;
  cm_id: string | null;
  disenador_id: string | null;
  media_buyer_id: string | null;
  /** La project manager: lo que no tiene dueño cae acá. */
  fallback: string;
}

export interface TareaDePanel {
  panel: PanelOnboarding;
  rutina_key: string;
  titulo: string;
  descripcion: string;
  area: string;
  asignado_a_id: string;
  dia: number;
}

export const claveDePanel = (clienteId: string, panel: PanelOnboarding) => `onb-panel:${clienteId}:${panel}`;

export function tareasDePaneles(input: {
  clienteId: string;
  nombreCliente: string;
  servicios: ServiciosDeLaCuenta;
  equipo: EquipoPaneles;
}): TareaDePanel[] {
  const { clienteId, nombreCliente, servicios, equipo: e } = input;
  const responsable: Record<PanelOnboarding, string | null> = {
    inicial: e.dueno,
    redes: e.coordinador_id,
    creativa: e.director_creativo_id,
    cm: e.cm_id,
    diseno: e.disenador_id,
    pauta: e.media_buyer_id,
  };
  return PANELES.filter((p) => aplicaPorServicio(p.key, servicios)).map((p) => ({
    panel: p.key,
    rutina_key: claveDePanel(clienteId, p.key),
    titulo: `Completar el onboarding de ${p.label} — ${nombreCliente}`,
    descripcion: `Entrá al [onboarding de ${p.label} de ${nombreCliente}](${hrefDePanel(clienteId, p.key)}) y completá cada paso. **Esta tarea se cierra sola** cuando la pestaña queda completa: no hace falta marcarla.`,
    area: QUIEN[p.key],
    asignado_a_id: responsable[p.key] ?? e.fallback,
    dia: DIA_DEL_PANEL[p.key],
  }));
}

/** La descripción con lo que falta, para que la tarea diga qué paso está pendiente. */
export function descripcionConFaltantes(base: string, faltan: string[]): string {
  if (!faltan.length) return base;
  return `${base}\n\n**Falta:**\n${faltan.map((f) => `- ${f}`).join("\n")}`;
}
