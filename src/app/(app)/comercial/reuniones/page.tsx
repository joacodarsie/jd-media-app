import { redirect } from "next/navigation";
import { requireUser, userHas } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { diaAr } from "@/lib/prospecting/reunion";
import { ReunionesPorCampania, type ReunionRow } from "@/components/reuniones-por-campania";

export const dynamic = "force-dynamic";

const COMERCIAL_ROLES = ["admin", "coordinador", "comercial", "prospecting"];

/**
 * Todas las reuniones con prospectos, agrupadas por campaña (pedido de Santi,
 * 24/9): hasta ahora había que entrar a cada campaña para ver cuáles tenía.
 * Muestra los contactos en "Reunión agendada" y "Propuesta enviada"; las
 * reuniones que ya pasaron quedan arriba de su campaña hasta que se resuelve
 * cómo salieron.
 */
export default async function ReunionesPage() {
  const me = await requireUser();
  const rolOk =
    COMERCIAL_ROLES.includes(me.rol) ||
    (!!me.rol_secundario && COMERCIAL_ROLES.includes(me.rol_secundario));
  if (!rolOk && !userHas(me, "comercial")) redirect("/dashboard");

  const admin = createAdmin();
  const { data: raw } = await admin
    .from("prospecting_contacts")
    .select(
      "id, estado, empresa, contacto_nombre, telefono, reunion_fecha, reunion_meeting_id, asignado_a, campaign_id, campania:prospecting_campaigns(id, nombre)"
    )
    .in("estado", ["reunion", "propuesta"]);

  const contactos = (raw ?? []) as unknown as {
    id: string;
    estado: string;
    empresa: string;
    contacto_nombre: string | null;
    telefono: string | null;
    reunion_fecha: string | null;
    reunion_meeting_id: string | null;
    asignado_a: string | null;
    campaign_id: string;
    campania: { id: string; nombre: string } | null;
  }[];

  const ids = contactos.map((c) => c.id);
  const meetingIds = contactos.map((c) => c.reunion_meeting_id).filter(Boolean) as string[];
  const userIds = [...new Set(contactos.map((c) => c.asignado_a).filter(Boolean))] as string[];
  const [{ data: meets }, { data: users }, { data: props }] = await Promise.all([
    meetingIds.length
      ? admin.from("internal_meetings").select("id, meet_link").in("id", meetingIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? admin.from("users").select("id, nombre").in("id", userIds)
      : Promise.resolve({ data: [] }),
    ids.length
      ? admin.from("proposals").select("contacto_id").in("contacto_id", ids)
      : Promise.resolve({ data: [] }),
  ]);
  const linkDe = new Map(
    ((meets ?? []) as { id: string; meet_link: string | null }[]).map((m) => [m.id, m.meet_link])
  );
  const nombreDe = new Map(
    ((users ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre.split(" ")[0]])
  );
  const conPropuesta = new Set(
    ((props ?? []) as { contacto_id: string }[]).map((p) => p.contacto_id)
  );

  const filas: ReunionRow[] = contactos.map((c) => ({
    id: c.id,
    empresa: c.empresa,
    propuestaEnviada: c.estado === "propuesta",
    contactoNombre: c.contacto_nombre,
    telefono: c.telefono,
    fecha: c.reunion_fecha,
    meetLink: c.reunion_meeting_id ? linkDe.get(c.reunion_meeting_id) ?? null : null,
    quien: c.asignado_a ? nombreDe.get(c.asignado_a) ?? null : null,
    campaniaId: c.campaign_id,
    campania: c.campania?.nombre ?? "Sin campaña",
    tienePropuesta: conPropuesta.has(c.id),
  }));

  return <ReunionesPorCampania filas={filas} hoy={diaAr(new Date())} ahora={new Date().toISOString()} />;
}
