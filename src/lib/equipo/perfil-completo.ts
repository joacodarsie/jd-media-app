/**
 * El perfil completo de cada persona del equipo (19/10/2026, pedido del dueño):
 * «cuando se creó la plataforma nadie tenía la obligación de cargar sus datos;
 * hoy hay que pedirlos». Cada dato se marca solo cuando está cargado.
 */
export interface DatosPerfil {
  nombre: string | null;
  avatar_url: string | null;
  telefono: string | null;
  whatsapp_phone: string | null;
  alias_cbu: string | null;
  cbu: string | null;
  titular_cuenta: string | null;
  dni_cuit: string | null;
  condicion_fiscal: string | null;
  domicilio: string | null;
  acceso_confirmado_at: string | null;
}

export interface DatoPerfil {
  clave: string;
  titulo: string;
  detalle: string;
  href: string;
  hecho: boolean;
}

const lleno = (v: string | null | undefined) => !!v && v.trim().length > 0;

export function datosDelPerfil(u: DatosPerfil): DatoPerfil[] {
  return [
    { clave: "foto", titulo: "Tu foto", detalle: "Así el equipo y los clientes te ponen cara.", href: "/mi-perfil#foto", hecho: lleno(u.avatar_url) },
    {
      clave: "nombre",
      titulo: "Tu nombre completo",
      detalle: "Nombre y apellido, como figura en tu documento.",
      href: "/mi-perfil#datos",
      hecho: lleno(u.nombre) && u.nombre!.trim().split(/\s+/).length >= 2,
    },
    {
      clave: "telefono",
      titulo: "Tu teléfono",
      detalle: "Para avisos urgentes y el grupo del equipo.",
      href: "/mi-perfil#datos",
      hecho: lleno(u.telefono) || lleno(u.whatsapp_phone),
    },
    {
      clave: "cobro",
      titulo: "Dónde te pagamos",
      detalle: "Alias o CBU y el titular de la cuenta.",
      href: "/mi-perfil#cobro",
      hecho: (lleno(u.alias_cbu) || lleno(u.cbu)) && lleno(u.titular_cuenta),
    },
    {
      clave: "facturacion",
      titulo: "Tus datos de facturación",
      detalle: "DNI o CUIT, condición fiscal y domicilio.",
      href: "/mi-perfil#datos",
      hecho: lleno(u.dni_cuit) && lleno(u.condicion_fiscal) && lleno(u.domicilio),
    },
    {
      clave: "acceso",
      titulo: "Tu mail y tu contraseña, anotados",
      detalle: "Que sepas con qué entrás, sin depender de nadie.",
      href: "/mi-perfil#acceso",
      hecho: lleno(u.acceso_confirmado_at),
    },
  ];
}

export function perfilCompleto(u: DatosPerfil): boolean {
  return datosDelPerfil(u).every((d) => d.hecho);
}

export const CLAVE_TAREA_PERFIL = (userId: string) => `perfil:${userId}`;
