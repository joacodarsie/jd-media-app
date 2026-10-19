/**
 * El ID que necesita la plataforma es el de la cuenta de Instagram de EMPRESA
 * (Graph API): empieza con 1784 y tiene 17 dígitos. El número corto del perfil
 * (el que dan las webs de «buscar ID de Instagram») no sirve: 12 cuentas
 * quedaron «conectadas» con ese número y nunca trajeron un dato (19/10/2026).
 */
export function esIdDeEmpresa(id: string | null | undefined): boolean {
  return !!id && /^1784\d{10,}$/.test(id.trim());
}

export const ERROR_ID_IG =
  "Ese no es el ID de la cuenta de empresa de Instagram (empieza con 1784…). Elegí la cuenta de la lista: si no aparece, falta asignarla al usuario del sistema en el Business Manager.";
