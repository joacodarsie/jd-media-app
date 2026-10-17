import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser, isStaffUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { cargarCrecimiento } from "@/lib/crecimiento/cargar";
import { CrecimientoVista } from "@/components/crecimiento-vista";
import { CrecimientoActualizar } from "@/components/crecimiento-actualizar";

export const dynamic = "force-dynamic";

/**
 * Crecimiento de la cuenta (17/10/2026): el antes y el después armado solo
 * con las fotos automáticas del Instagram. Pedido del dueño: dejar de depender
 * de sacar capturas para mostrar el progreso.
 */
export default async function CrecimientoPage({ params }: { params: { id: string } }) {
  const me = await requireUser();
  const admin = createAdmin();
  const { data } = await admin.from("clients").select("id, nombre, instagram_url, cm_id").eq("id", params.id).maybeSingle();
  if (!data) notFound();
  const c = data as { id: string; nombre: string; instagram_url: string | null; cm_id: string | null };
  if (!(isStaffUser(me) || userInRoles(me, ["paid_media"]) || c.cm_id === me.id)) notFound();

  const datos = await cargarCrecimiento(admin, c.id);
  const vacio = !datos.inicio && !datos.hoy;

  return (
    <div className="space-y-5">
      <Link href={`/clientes/${c.id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Volver a {c.nombre}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Crecimiento</h1>
          <p className="text-sm text-muted-foreground">
            El antes y el después de {c.nombre}, armado solo con su Instagram. Se actualiza una vez por mes.
          </p>
        </div>
        {me.rol === "admin" && c.instagram_url && <CrecimientoActualizar clienteId={c.id} />}
      </div>

      {vacio ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {c.instagram_url
            ? "La primera foto de la cuenta se saca sola esta noche."
            : "Cargá el Instagram en la ficha del cliente: con eso la plataforma saca sola la foto del arranque."}
        </div>
      ) : (
        <CrecimientoVista datos={datos} nombre={c.nombre} />
      )}
    </div>
  );
}
