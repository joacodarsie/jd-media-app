/**
 * Cuentas sin medir (19/10/2026, pedido del dueño): «apenas se cierra un
 * cliente nuevo, que me avisen y me molesten mucho hasta que esté vinculado de
 * verdad». Vinculado de verdad = la plataforma trajo datos de su Instagram en
 * los últimos 3 días; tener el ID cargado no alcanza (12 cuentas lo tenían mal).
 */
export interface CuentaParaMedir {
  id: string;
  nombre: string;
  /** "YYYY-MM-DD" del alta. */
  fechaInicio: string | null;
  igUsername: string | null;
  /** Tiene gestión de redes o pauta activa. */
  necesitaInstagram: boolean;
}

export interface SinMedir {
  id: string;
  nombre: string;
  igUsername: string | null;
  /** Días desde el alta (0 si no hay fecha). */
  dias: number;
}

const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 86_400_000);

export function cuentasSinMedir(cuentas: CuentaParaMedir[], conDatos: Set<string>, hoy: string): SinMedir[] {
  return cuentas
    .filter((c) => c.necesitaInstagram && !conDatos.has(c.id))
    .map((c) => ({ id: c.id, nombre: c.nombre, igUsername: c.igUsername, dias: c.fechaInicio ? Math.max(0, diasEntre(c.fechaInicio, hoy)) : 0 }))
    .sort((a, b) => b.dias - a.dias);
}

export const PREFIJO_AVISO_IG = "🔗";

/** El aviso del día, corto para el celular. */
export function avisoSinMedir(lista: SinMedir[]): string | null {
  if (!lista.length) return null;
  const nombres = lista.slice(0, 5).map((c) => c.nombre).join(", ");
  const resto = lista.length > 5 ? ` y ${lista.length - 5} más` : "";
  return `${PREFIJO_AVISO_IG} ${lista.length} cuenta${lista.length === 1 ? "" : "s"} sin medir Instagram: ${nombres}${resto}. Sin esto no hay datos reales para el cliente ni para el reporte.`;
}

/** La tarea de vincular, con los pasos completos. */
export function tareaVincular(c: SinMedir): { titulo: string; descripcion: string } {
  return {
    titulo: `🔗 Vincular Instagram y Facebook de ${c.nombre} a la plataforma`,
    descripcion: [
      `La plataforma todavía no puede leer el Instagram de ${c.nombre}${c.igUsername ? ` (@${c.igUsername})` : ""}. Sin esto no hay seguidores, alcance ni crecimiento para el cliente, el reporte ni la reunión mensual.`,
      "",
      "Pasos, en orden:",
      "1. Que la marca tenga página de Facebook y su Instagram esté VINCULADO a esa página (app de Instagram → Editar perfil → Página → Conectar). Se chequea en la página → Configuración → Cuentas vinculadas.",
      "2. Que el cliente comparta la página y el Instagram con el Business de JD Media (como socio, acceso total).",
      "3. En el Business de JD Media → Configuración → Usuarios del sistema → «jdmedia» → ··· → Asignar activos: tildar su Página de Facebook y su Cuenta de Instagram, con todos los permisos.",
      "4. En la plataforma: Clientes → Conectar Instagram → elegir la cuenta de la lista → Conectar.",
      "",
      "Esta tarea se cierra sola cuando la plataforma trae los datos. Mientras tanto, avisa todos los días.",
    ].join("\n"),
  };
}
