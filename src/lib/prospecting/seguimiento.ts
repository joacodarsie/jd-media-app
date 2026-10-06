/**
 * Qué seguimiento le toca a un contacto de prospección (0192, 6/10/2026).
 *
 * En los últimos 30 días se escribió a ~750 negocios y salieron 3 reuniones:
 * 870 quedaron con un solo mensaje. Casi nadie contesta el primero; el segundo
 * y el tercero son los que traen respuestas. Las campañas ya tenían armados
 * los mensajes "Seguimiento 1" y "Seguimiento 2": esto decide cuál toca.
 *
 * Regla: solo a los que están en "contactado" (sin respuesta), 3 días después
 * del último mensaje, hasta 2 seguimientos. Después de eso, se deja.
 *
 * Puro, para probarlo sin base.
 */

/** Días entre un mensaje y el siguiente. */
export const DIAS_ENTRE_MENSAJES = 3;

/** Cuántos seguimientos se mandan como máximo después del primer mensaje. */
export const MAX_SEGUIMIENTOS = 2;

export interface ContactoSeguible {
  estado: string;
  contactado_at: string | null;
  seguimientos?: number | null;
  seguimiento_at?: string | null;
}

function diasEntre(desdeIso: string, ahora: Date): number {
  return Math.floor((ahora.getTime() - new Date(desdeIso).getTime()) / 86_400_000);
}

/** 1 o 2 si le toca ese seguimiento hoy; null si no le toca nada. */
export function seguimientoQueToca(c: ContactoSeguible, ahora = new Date()): 1 | 2 | null {
  if (c.estado !== "contactado" || !c.contactado_at) return null;
  const hechos = c.seguimientos ?? 0;
  if (hechos >= MAX_SEGUIMIENTOS) return null;
  const ultimo = c.seguimiento_at ?? c.contactado_at;
  if (diasEntre(ultimo, ahora) < DIAS_ENTRE_MENSAJES) return null;
  return (hechos + 1) as 1 | 2;
}

/** Ya se mandaron todos los seguimientos y no contestó: se puede descartar. */
export function seguimientoAgotado(c: ContactoSeguible, ahora = new Date()): boolean {
  if (c.estado !== "contactado") return false;
  if ((c.seguimientos ?? 0) < MAX_SEGUIMIENTOS || !c.seguimiento_at) return false;
  return diasEntre(c.seguimiento_at, ahora) >= DIAS_ENTRE_MENSAJES;
}

/** Cuántos contactos de cada campaña tienen un seguimiento para mandar hoy. */
export function paraSeguirPorCampania(
  contactos: (ContactoSeguible & { campaign_id: string; asignado_a?: string | null })[],
  ahora = new Date(),
  yo?: string
): { campaignId: string; total: number; mios: number }[] {
  const m = new Map<string, { campaignId: string; total: number; mios: number }>();
  for (const c of contactos) {
    if (!seguimientoQueToca(c, ahora)) continue;
    const x = m.get(c.campaign_id) ?? { campaignId: c.campaign_id, total: 0, mios: 0 };
    x.total++;
    if (yo && c.asignado_a === yo) x.mios++;
    m.set(c.campaign_id, x);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}
