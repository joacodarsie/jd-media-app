/**
 * «Tu primera semana» (19/10/2026): el checklist de quien entra al equipo, en
 * su Mi día. Cada paso se marca SOLO con lo que la persona ya hizo (su foto,
 * las notificaciones, las secciones que abrió, su primera tarea cerrada): nadie
 * tiene que tildar nada. Se muestra los primeros 14 días o hasta completarlo.
 */
export interface DatosPrimeraSemana {
  tieneFoto: boolean;
  tienePush: boolean;
  /** Secciones del menú que ya abrió (uso_secciones, 0204). */
  secciones: Set<string>;
  cerroUnaTarea: boolean;
  escribioEnElChat: boolean;
  rol: string;
}

export interface PasoSemana {
  clave: string;
  titulo: string;
  detalle: string;
  href: string;
  hecho: boolean;
}

const vio = (d: DatosPrimeraSemana, ...s: string[]) => s.some((x) => d.secciones.has(x));

export function pasosPrimeraSemana(d: DatosPrimeraSemana): PasoSemana[] {
  const pasos: PasoSemana[] = [
    { clave: "foto", titulo: "Poné tu foto", detalle: "Así el equipo y los clientes saben quién sos.", href: "/mi-perfil", hecho: d.tieneFoto },
    {
      clave: "push",
      titulo: "Activá los avisos en el celular",
      detalle: "Te llegan las tareas nuevas y lo urgente al instante.",
      href: "/mi-perfil",
      hecho: d.tienePush,
    },
    {
      clave: "ayuda",
      titulo: "Leé cómo trabajamos",
      detalle: "La guía de la plataforma: tareas, calendario y aprobaciones.",
      href: "/ayuda",
      hecho: vio(d, "Ayuda"),
    },
    { clave: "equipo", titulo: "Conocé al equipo", detalle: "Quién es quién y qué hace cada uno.", href: "/equipo", hecho: vio(d, "Equipo") },
    { clave: "cuentas", titulo: "Mirá tus cuentas", detalle: "Las marcas que vas a llevar y en qué están.", href: "/clientes", hecho: vio(d, "Clientes") },
  ];
  if (["community_manager", "diseno", "audiovisual", "coordinador"].includes(d.rol)) {
    pasos.push({
      clave: "calendario",
      titulo: "Abrí el calendario de contenidos",
      detalle: "Lo que se publica en tus cuentas y qué pieza te toca.",
      href: "/contenidos",
      hecho: vio(d, "Contenidos"),
    });
  }
  if (d.rol === "paid_media") {
    pasos.push({ clave: "pauta", titulo: "Mirá la pauta de tus cuentas", detalle: "Campañas, gasto y resultados.", href: "/paid-media", hecho: vio(d, "Paid Media") });
  }
  pasos.push(
    {
      clave: "chat",
      titulo: "Presentate en el chat del equipo",
      detalle: "Un hola con tu nombre y qué vas a hacer.",
      href: "/chat",
      hecho: d.escribioEnElChat,
    },
    { clave: "tarea", titulo: "Cerrá tu primera tarea", detalle: "Tocá el círculo de la tarea cuando esté hecha.", href: "/tareas", hecho: d.cerroUnaTarea }
  );
  return pasos;
}

export const DIAS_PRIMERA_SEMANA = 14;

export function mostrarPrimeraSemana(creadoIso: string | null, ahora: number, pasos: PasoSemana[]): boolean {
  if (!creadoIso) return false;
  const dias = (ahora - Date.parse(creadoIso)) / 86_400_000;
  return dias <= DIAS_PRIMERA_SEMANA && pasos.some((p) => !p.hecho);
}
