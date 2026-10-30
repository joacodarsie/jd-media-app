/**
 * Quién entra a Administración (30/10/2026, pedido del dueño): solo él y Jadur.
 * Por mail y no por rol, porque el rol admin también lo tiene otra gente.
 * Módulo puro: lo usa el menú, que corre en el navegador.
 */
const ADMINISTRACION_EMAILS = ["joaquin@jdmedia.com", "jadur@jdmedia.com"];

export function accedeAdministracion(user: { email?: string | null }): boolean {
  return !!user.email && ADMINISTRACION_EMAILS.includes(user.email.toLowerCase());
}
