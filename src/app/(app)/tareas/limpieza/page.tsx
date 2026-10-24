import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { diasVencida, opcionesDePase } from "@/lib/tareas/limpieza";
import { LimpiezaVencidas, type TareaALimpiar } from "@/components/limpieza-vencidas";

export const dynamic = "force-dynamic";

/**
 * La limpieza de vencidas (24/10/2026): las tareas vencidas de cada uno, de la
 * más vieja a la más nueva, con tres botones. Ver lib/tareas/limpieza.
 */
export default async function LimpiezaPage() {
  const me = await requireUser();
  const hoy = hoyYmd();
  const { data } = await createAdmin()
    .from("tasks")
    .select("id, numero, titulo, fecha_limite, cliente:clients(nombre)")
    .eq("asignado_a_id", me.id)
    .in("estado", ["pendiente", "en_progreso", "en_revision", "bloqueada"])
    .lt("fecha_limite", hoy)
    .order("fecha_limite", { ascending: true })
    .limit(300);
  const tareas: TareaALimpiar[] = ((data ?? []) as unknown as { id: string; numero: number | null; titulo: string; fecha_limite: string; cliente: { nombre: string } | null }[]).map(
    (t) => ({ id: t.id, numero: t.numero, titulo: t.titulo, cliente: t.cliente?.nombre ?? null, dias: diasVencida(t.fecha_limite.slice(0, 10), hoy) })
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/tareas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Tareas
        </Link>
        <h1 className="mt-1 text-2xl font-bold">🧹 Limpieza de vencidas</h1>
        <p className="text-sm text-muted-foreground">
          Tus tareas con la fecha pasada, de la más vieja a la más nueva. En cada una: <b>ya está</b>, <b>pasala</b> a otra fecha o <b>ya no va</b>. Con 5 minutos, tu lista vuelve a decir la verdad.
        </p>
      </div>
      <LimpiezaVencidas tareas={tareas} opciones={opcionesDePase(hoy)} />
    </div>
  );
}
