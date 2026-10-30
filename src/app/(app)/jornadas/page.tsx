import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { AREA_PM } from "@/lib/tareas/puerta";
import { cargarJornadas } from "@/lib/jornadas/cargar";
import { JornadasRegistro } from "@/components/jornadas-registro";

export const dynamic = "force-dynamic";

/**
 * Jornadas de producción (23/10/2026): el registro y el historial de cada
 * jornada con lo cobrado y lo pagado. Luz las carga y confirma; el dueño cobra
 * y paga. Antes vivían en /coordinacion/jornadas, que solo veía el dueño.
 */
export default async function JornadasPage({ searchParams }: { searchParams?: { ver?: string } }) {
  const me = await requireUser();
  const esDueno = me.rol === "admin";
  const coordina = me.rol === "coordinador" || me.rol_secundario === "coordinador";
  if (!esDueno && !coordina && me.area !== AREA_PM && me.area_secundaria !== AREA_PM) redirect("/dashboard");
  const admin = createAdmin();
  const [jornadas, { data: equipo }, { data: clientes }] = await Promise.all([
    cargarJornadas(admin),
    admin.from("users").select("id, nombre").eq("activo", true).order("nombre"),
    admin.from("clients").select("id, nombre").in("estado", ["activo", "en_pausa"]).order("nombre"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">🎬 Jornadas de producción</h1>
        <p className="text-sm text-muted-foreground">
          Se agendan en la Agenda y quedan acá. Después de cada jornada, {esDueno ? "Luz confirma" : "confirmás"} la duración y los viáticos de cada uno; {esDueno ? "vos cobrás y pagás" : "dirección cobra y paga"} y lo marca.
        </p>
      </div>
      <JornadasRegistro
        jornadas={jornadas}
        equipo={(equipo ?? []) as { id: string; nombre: string }[]}
        clientes={(clientes ?? []) as { id: string; nombre: string }[]}
        esDueno={esDueno}
        filtroInicial={searchParams?.ver === "completar" ? "completar" : "todas"}
      />
    </div>
  );
}
