import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Table2 } from "lucide-react";
import { requireRole, canUseProspectingAi } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { ProspectingContactsTable, type ContactRow } from "@/components/prospecting-contacts-table";

export const dynamic = "force-dynamic";

const ALLOWED = ["admin", "coordinador", "comercial", "prospecting"];

export default async function CampaignContactsPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireRole(ALLOWED);
  const admin = createAdmin();

  const { data: camp } = await admin
    .from("prospecting_campaigns")
    .select("id, nombre, rubro, ubicacion")
    .eq("id", params.id)
    .maybeSingle();
  if (!camp) notFound();
  const c = camp as { id: string; nombre: string; rubro: string; ubicacion: string | null };

  // Plantilla de mensajes de la campaña: se usa para precargar el WhatsApp de
  // cada fila con el texto ya personalizado (resiliente si falta la 0132).
  let primerMensaje: string | null = null;
  const mp = await admin
    .from("prospecting_campaigns")
    .select("mensajes_plantilla")
    .eq("id", c.id)
    .maybeSingle();
  if (!mp.error) {
    const tpl = (mp.data as { mensajes_plantilla?: { primer_mensaje?: string } | null } | null)
      ?.mensajes_plantilla;
    primerMensaje = tpl?.primer_mensaje ?? null;
  }

  // Contactos de la campaña. Resiliente si todavía no se aplicó la 0130/0131.
  const COLS =
    "id, empresa, contacto_nombre, contacto_rol, telefono, instagram, sitio_web, estado, asignado_a, notas, contactado_at, contactable, created_at";
  const first = await admin
    .from("prospecting_contacts")
    .select(COLS)
    .eq("campaign_id", c.id)
    .order("created_at", { ascending: false });
  let dataRows = first.data as unknown[] | null;
  let err = first.error;
  // Faltan 0131 (contactado_at) o 0136 (instagram/sitio_web): traemos sin ellas.
  if (err && (err as { code?: string }).code === "42703") {
    const second = await admin
      .from("prospecting_contacts")
      .select(
        COLS.replace(", contactado_at", "")
          .replace(", instagram", "")
          .replace(", sitio_web", "")
          .replace(", contactable", "")
      )
      .eq("campaign_id", c.id)
      .order("created_at", { ascending: false });
    dataRows = second.data as unknown[] | null;
    err = second.error;
  }
  const faltaMigracion = err && (err as { code?: string }).code === "42P01";
  const contacts = ((dataRows ?? []) as Record<string, unknown>[]).map(
    (r) => ({ contactado_at: null, instagram: null, sitio_web: null, contactable: null, ...r })
  ) as ContactRow[];

  // Equipo para el selector "quién contacta". Los COMERCIALES (los que
  // prospectan: dirección, comercial y prospecting) van primero; el resto queda
  // agrupado abajo en "Resto del equipo".
  const { data: team } = await admin
    .from("users")
    .select("id, nombre, rol, rol_secundario")
    .eq("activo", true)
    .order("nombre");
  const COMERCIAL_ROLES = ["admin", "comercial", "prospecting"];
  const equipo = ((team ?? []) as {
    id: string;
    nombre: string;
    rol: string;
    rol_secundario: string | null;
  }[]).map((u) => ({
    id: u.id,
    nombre: u.nombre,
    comercial:
      COMERCIAL_ROLES.includes(u.rol) ||
      (!!u.rol_secundario && COMERCIAL_ROLES.includes(u.rol_secundario)),
  }));

  return (
    <div className="space-y-5">
      <Link
        href={`/prospeccion/${c.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {c.nombre}
      </Link>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <Table2 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Contactos (modo rápido)</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Lista tipo Excel para escribir a mano en volumen. La IA trae empresa,
          persona, rol y teléfono con muy pocos tokens (sin mensajes ni
          verificación). Editá las celdas para clasificar y repartir quién
          contacta a cada uno, y exportala cuando quieras.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{c.rubro}</span>
          {c.ubicacion && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {c.ubicacion}
            </span>
          )}
        </div>
      </div>

      {faltaMigracion ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          Falta aplicar la migración <b>0130_prospecting_contacts</b> en Supabase.
          Avisale al admin y volvé a entrar.
        </div>
      ) : (
        <ProspectingContactsTable
          campaignId={c.id}
          campaignNombre={c.nombre}
          initialContacts={contacts}
          equipo={equipo}
          canUseAi={canUseProspectingAi(me)}
          currentUserId={me.id}
          primerMensaje={primerMensaje}
        />
      )}
    </div>
  );
}
