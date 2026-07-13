// Qué roles de equipo necesita una cuenta según los SERVICIOS que contrató, y
// cuáles le faltan asignar. Una cuenta con equipo incompleto no genera ese
// costo en la nómina, así que su margen se ve inflado — por eso se marca.
//
// La clave: los roles requeridos dependen del servicio. Una cuenta de branding
// (diseño gráfico exclusivamente) necesita diseñador, NO editor ni CM; una de
// gestión de redes necesita CM + diseño + edición. Función pura → testeable.

export interface TeamCoverageClient {
  cm_id: string | null;
  disenador_id: string | null;
  audiovisual_id: string | null;
}

export interface TeamCoverageService {
  tipo: string; // gestion_redes | diseno_grafico | branding | paid_media | ...
  activo: boolean;
  facturacion: string | null;
  costo_override: number | null;
}

/**
 * Roles sin asignar que la cuenta necesita según sus servicios. Vacío = está
 * completa (o sus servicios no requieren equipo interno). Un acuerdo fijo en la
 * gestión de redes cubre todo con un monto, así que no exige equipo.
 */
export function missingTeam(
  client: TeamCoverageClient,
  services: TeamCoverageService[]
): string[] {
  const activos = services.filter((s) => s.activo);
  const gestion = activos.find((s) => s.tipo === "gestion_redes");
  const disenoStandalone = activos.some(
    (s) => s.tipo === "diseno_grafico" || s.tipo === "branding"
  );

  const need = { cm: false, diseno: false, edicion: false };

  // Gestión de redes (salvo acuerdo fijo): CM + diseño + edición.
  if (gestion && gestion.costo_override == null) {
    need.cm = true;
    need.diseno = true;
    need.edicion = true;
  }
  // Diseño gráfico / branding standalone: solo diseño.
  if (disenoStandalone) need.diseno = true;

  const falta: string[] = [];
  if (need.cm && !client.cm_id) falta.push("CM");
  if (need.diseno && !client.disenador_id) falta.push("diseño");
  if (need.edicion && !client.audiovisual_id) falta.push("edición");
  return falta;
}
